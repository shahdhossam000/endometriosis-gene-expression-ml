# ===== Endometriosis scRNA-seq (GSE179640) =====
# STEP 0 - Setup: packages, folders, seed

options(timeout = 7200)
set.seed(42)

pkgs_cran <- c("Seurat", "harmony", "tidyverse", "Matrix", "data.table", "hdf5r", "patchwork")
new_cran <- setdiff(pkgs_cran, rownames(installed.packages()))
if (length(new_cran)) install.packages(new_cran)

if (!requireNamespace("BiocManager", quietly = TRUE)) install.packages("BiocManager")
pkgs_bioc <- c("GEOquery", "scDblFinder", "SingleCellExperiment")
new_bioc <- setdiff(pkgs_bioc, rownames(installed.packages()))
if (length(new_bioc)) BiocManager::install(new_bioc, ask = FALSE, update = FALSE)

suppressPackageStartupMessages({
  library(Seurat); library(harmony); library(tidyverse); library(Matrix)
  library(GEOquery); library(scDblFinder); library(SingleCellExperiment); library(patchwork)
})

for (d in c("data", "plots", "results")) dir.create(d, showWarnings = FALSE)
# STEP 1 - Raw data location (already extracted)
raw_dir <- "GSE179640_RAW"
stopifnot(dir.exists(raw_dir))

# STEP 2 - Inspect the files
files <- list.files(raw_dir)
length(files)                                   # should be 39
table(tools::file_ext(sub("\\.gz$", "", files)))
# STEP 3 - Sample metadata from file names (GEO download failed)
h5 <- list.files(raw_dir, pattern = "\\.h5$")
b  <- sub("_filtered_feature_bc_matrix\\.h5$", "", h5)
parts <- strsplit(b, "_")

meta <- tibble(
  gsm        = sapply(parts, `[`, 1),
  patient_id = sapply(parts, `[`, 2),
  tissue     = sapply(parts, `[`, 3),
  file       = file.path(raw_dir, h5)
) %>%
  filter(tissue != "EOR", !is.na(tissue)) %>%
  mutate(
    tissue    = ifelse(tissue == "EcPA2", "EcPA", tissue),
    condition = ifelse(grepl("^C", patient_id), "Control", "Endometriosis"),
    tissue    = factor(tissue, levels = c("Ctrl", "EuE", "EcP", "EcPA", "EcO"))
  )

nrow(meta)                    # expected: 31
table(meta$tissue)
n_distinct(meta$patient_id)   # expected: 14
write_csv(meta, "results/sample_metadata.csv")
# STEP 4 - Load every sample into a Seurat object
objs <- lapply(seq_len(nrow(meta)), function(i) {
  m <- Read10X_h5(meta$file[i])
  if (is.list(m)) m <- m[["Gene Expression"]]
  o <- CreateSeuratObject(m, project = meta$gsm[i], min.cells = 0, min.features = 1)
  o$gsm        <- meta$gsm[i]
  o$patient_id <- meta$patient_id[i]
  o$condition  <- meta$condition[i]
  o$tissue     <- as.character(meta$tissue[i])
  message(meta$gsm[i], " (", meta$patient_id[i], ", ", meta$tissue[i], "): ", ncol(o), " barcodes")
  o
})
names(objs) <- meta$gsm
length(objs)   # should be 31
# STEP 5 - Per-sample QC, then merge counts (memory-friendly)
#   cells: >=500 genes, >=1000 UMIs, <=100,000 UMIs, <25% mito
cells_before <- sum(sapply(objs, ncol))

qc_counts <- lapply(names(objs), function(g) {
  o <- objs[[g]]
  o[["percent.mt"]] <- PercentageFeatureSet(o, pattern = "^MT-")
  o <- subset(o, subset = nFeature_RNA >= 500 & nCount_RNA >= 1000 &
                nCount_RNA <= 100000 & percent.mt < 25)
  m <- GetAssayData(o, layer = "counts")
  colnames(m) <- paste0(g, "_", colnames(m))
  m
})
names(qc_counts) <- names(objs)

# cell-level metadata, one row per cell
md <- do.call(rbind, lapply(names(qc_counts), function(g) {
  i  <- match(g, meta$gsm)
  cn <- colnames(qc_counts[[g]])
  d  <- data.frame(gsm        = rep(g, length(cn)),
                   patient_id = rep(meta$patient_id[i], length(cn)),
                   condition  = rep(meta$condition[i], length(cn)),
                   tissue     = rep(as.character(meta$tissue[i]), length(cn)))
  rownames(d) <- cn
  d
}))

rm(objs); gc()

# use only genes present in ALL samples (one sample used a different annotation)
common <- Reduce(intersect, lapply(qc_counts, rownames))
length(common)                          # number of shared genes
all(c("CCL19", "LYVE1") %in% common)    # must be TRUE
qc_counts <- lapply(qc_counts, function(m) m[common, , drop = FALSE])
counts_all <- do.call(cbind, qc_counts)
rm(qc_counts); gc()

# keep genes detected in >= 3 cells
counts_all <- counts_all[Matrix::rowSums(counts_all > 0) >= 3, ]

obj <- CreateSeuratObject(counts_all, meta.data = md, project = "endo")
obj[["percent.mt"]] <- PercentageFeatureSet(obj, pattern = "^MT-")
rm(counts_all, md); gc()

c(before = cells_before, after = ncol(obj))
obj
table(obj$patient_id, obj$tissue)
saveRDS(obj, "results/01_qc_filtered_nodoublet.rds")
# STEP 7 - Doublet removal (scDblFinder, run per sample)
set.seed(42)
sce <- scDblFinder(GetAssayData(obj, layer = "counts"), samples = obj$gsm)
obj$doublet_class <- sce$scDblFinder.class
table(obj$doublet_class)
obj <- subset(obj, subset = doublet_class == "singlet")
rm(sce); gc()
ncol(obj)
saveRDS(obj, "results/01_qc_filtered.rds")
# STEP 8 - Normalization, HVGs, PCA
stress_genes <- c("FOS", "FOSB", "JUN", "JUNB", "JUND", "HSPA1A", "HSPA1B", "DNAJB1",
                  "HSP90AA1", "DUSP1", "ATF3", "EGR1", "IER2")
clean_hvg <- function(genes) {
  bad <- c(grep("^MT-|^RP[SL][0-9]|^HB[AB]", genes, value = TRUE),
           cc.genes.updated.2019$s.genes, cc.genes.updated.2019$g2m.genes, stress_genes)
  setdiff(genes, bad)
}

med_umi <- median(obj$nCount_RNA)
obj <- NormalizeData(obj, normalization.method = "LogNormalize", scale.factor = med_umi)
obj <- FindVariableFeatures(obj, nfeatures = 2000)
VariableFeatures(obj) <- clean_hvg(VariableFeatures(obj))
obj <- ScaleData(obj, features = VariableFeatures(obj))
obj <- RunPCA(obj, npcs = 50, verbose = FALSE)
ggsave("plots/02_elbow.png", ElbowPlot(obj, ndims = 50), width = 6, height = 4)
saveRDS(obj, "results/02_normalized_pca.rds")
# Re-save elbow plot with white background
ggsave("plots/02_elbow.png", ElbowPlot(obj, ndims = 50),
       width = 6, height = 4, dpi = 150, bg = "white")
# STEP 9 - Batch correction across patients (Harmony) - for clustering only
obj <- RunHarmony(obj, group.by.vars = "patient_id", reduction.use = "pca",
                  reduction.save = "harmony", verbose = FALSE)
Reductions(obj)
saveRDS(obj, "results/03_harmony.rds")
# STEP 10 - Neighbors, clustering, UMAP
obj <- FindNeighbors(obj, reduction = "harmony", dims = 1:30)
obj <- FindClusters(obj, resolution = 0.3)
obj <- RunUMAP(obj, reduction = "harmony", dims = 1:30)

p1 <- DimPlot(obj, group.by = "seurat_clusters", label = TRUE) + NoLegend()
p2 <- DimPlot(obj, group.by = "tissue")
p3 <- DimPlot(obj, group.by = "patient_id")
ggsave("plots/03_umap_overview.png", p1 + p2 + p3, width = 20, height = 6, dpi = 150)

table(obj$seurat_clusters)
saveRDS(obj, "results/04_clustered.rds")
# STEP 11 - Major cell-type markers (CCL19 / LYVE1 deliberately NOT used)
marker_list <- list(
  Epithelial  = c("EPCAM", "CDH1", "KRT8", "KRT18"),
  Stromal     = c("COL1A1", "PDGFRA", "DCN", "LUM"),
  Endothelial = c("VWF", "PECAM1", "CDH5", "CLDN5"),
  Myeloid     = c("CD68", "CD14", "LYZ", "C1QA"),
  Lymphocytes = c("CD2", "CD3G", "CD3D", "CD3E", "NKG7", "MS4A1")
)
all_markers <- unique(unlist(marker_list))
all_markers[!all_markers %in% rownames(obj)]   # should be empty

p_dot <- DotPlot(obj, features = all_markers, group.by = "seurat_clusters") + RotatedAxis()
ggsave("plots/04_major_celltype_dotplot.png", p_dot,
       width = 12, height = 8, dpi = 150, bg = "white")
p_dot
# STEP 11b - Assign major cell types (manual, from DotPlot)
cluster_map <- c(
  "0" = "Stromal", "1" = "Epithelial", "2" = "Lymphocytes", "3" = "Stromal",
  "4" = "Endothelial", "5" = "Myeloid", "6" = "Lymphocytes", "7" = "Myeloid",
  "9" = "Stromal", "10" = "Stromal", "11" = "Lymphocytes", "12" = "Lymphocytes",
  "14" = "Epithelial", "16" = "Epithelial", "17" = "Epithelial",
  "19" = "Endothelial", "22" = "Stromal"
)
obj$cell_type <- unname(cluster_map[as.character(obj$seurat_clusters)])
obj$cell_type[is.na(obj$cell_type)] <- "Unassigned"

table(obj$cell_type)
round(prop.table(table(obj$cell_type, obj$tissue), margin = 2) * 100)

ggsave("plots/05_umap_celltype.png",
       DimPlot(obj, group.by = "cell_type", label = TRUE),
       width = 8, height = 6, bg = "white")
saveRDS(obj, "results/05_annotated_major.rds")
# STEP 13 - Myeloid sub-clustering (target: LYVE1)
recluster <- function(o, res = 0.5, dims = 1:20, nfeat = 2000) {
  o <- FindVariableFeatures(o, nfeatures = nfeat)
  VariableFeatures(o) <- clean_hvg(VariableFeatures(o))
  o <- ScaleData(o, features = VariableFeatures(o), verbose = FALSE)
  o <- RunPCA(o, npcs = 30, verbose = FALSE)
  o <- RunHarmony(o, group.by.vars = "patient_id", reduction.use = "pca",
                  reduction.save = "harmony", verbose = FALSE)
  o <- FindNeighbors(o, reduction = "harmony", dims = dims)
  o <- FindClusters(o, resolution = res)
  RunUMAP(o, reduction = "harmony", dims = dims)
}

myeloid <- subset(obj, subset = cell_type == "Myeloid")
myeloid <- recluster(myeloid, res = 0.5)

# LYVE1 is shown only to VALIDATE, not to define clusters
mac_markers <- c("CD68", "CD14", "C1QA", "C1QB", "FOLR2", "MRC1", "ICAM2", "CLEC5A",
                 "CCR2", "VEGFA", "APOE", "SPP1", "FCGR3A", "CD1C", "CLEC9A", "LYZ", "LYVE1")
mac_markers[!mac_markers %in% rownames(myeloid)]   # should be empty

ggsave("plots/08_myeloid_umap.png", DimPlot(myeloid, label = TRUE),
       width = 7, height = 6, bg = "white")
p_mac <- DotPlot(myeloid, features = mac_markers) + RotatedAxis()
ggsave("plots/09_myeloid_dotplot.png", p_mac, width = 12, height = 6, bg = "white")
p_mac

table(myeloid$seurat_clusters, myeloid$tissue)
saveRDS(myeloid, "results/06_myeloid.rds")
# STEP 13b - Assign myeloid subtypes (edit cluster numbers if needed)
macrophage_clusters <- c("1", "2", "5", "6", "8")
lyve1_mac_clusters  <- c("2")

cl <- as.character(myeloid$seurat_clusters)
myeloid$subtype <- case_when(
  cl %in% lyve1_mac_clusters  ~ "Mac-LYVE1",
  cl %in% macrophage_clusters ~ "Other macrophage",
  TRUE                        ~ "Other myeloid"
)

obj$subtype <- obj$cell_type
obj$subtype[match(colnames(myeloid), colnames(obj))] <- myeloid$subtype
table(obj$subtype)
saveRDS(obj, "results/06_annotated_subtypes.rds")
# STEP 12 - Stromal sub-clustering (target: CCL19)
stromal <- subset(obj, subset = cell_type == "Stromal")
stromal <- recluster(stromal, res = 0.5)

# CCL19 is shown only to VALIDATE, not to define clusters
mural_markers <- c("RERGL", "MCAM", "MYH11", "STEAP4", "RGS5", "ACTA2", "GGT5",
                   "ABCC9", "SUSD2", "DCN", "LUM", "MME", "CCL19")
mural_markers[!mural_markers %in% rownames(stromal)]   # should be empty

ggsave("plots/06_stromal_umap.png", DimPlot(stromal, label = TRUE),
       width = 7, height = 6, bg = "white")
p_str <- DotPlot(stromal, features = mural_markers) + RotatedAxis()
ggsave("plots/07_stromal_dotplot.png", p_str, width = 11, height = 6, bg = "white")
p_str

table(stromal$seurat_clusters, stromal$tissue)

lv <- GetAssayData(stromal, layer = "counts")["CCL19", ]
round(tapply(lv > 0, stromal$seurat_clusters, mean) * 100, 1)   # % CCL19+ per cluster
saveRDS(stromal, "results/07_stromal.rds")
# ---- Reload after restart (memory-friendly) ----
library(Seurat); library(harmony); library(tidyverse); library(Matrix)
set.seed(42)

stress_genes <- c("FOS", "FOSB", "JUN", "JUNB", "JUND", "HSPA1A", "HSPA1B", "DNAJB1",
                  "HSP90AA1", "DUSP1", "ATF3", "EGR1", "IER2")
clean_hvg <- function(genes) {
  bad <- c(grep("^MT-|^RP[SL][0-9]|^HB[AB]", genes, value = TRUE),
           cc.genes.updated.2019$s.genes, cc.genes.updated.2019$g2m.genes, stress_genes)
  setdiff(genes, bad)
}
recluster <- function(o, res = 0.5, dims = 1:20, nfeat = 2000) {
  o <- FindVariableFeatures(o, nfeatures = nfeat)
  VariableFeatures(o) <- clean_hvg(VariableFeatures(o))
  o <- ScaleData(o, features = VariableFeatures(o), verbose = FALSE)
  o <- RunPCA(o, npcs = 30, verbose = FALSE)
  o <- RunHarmony(o, group.by.vars = "patient_id", reduction.use = "pca",
                  reduction.save = "harmony", verbose = FALSE)
  o <- FindNeighbors(o, reduction = "harmony", dims = dims)
  o <- FindClusters(o, resolution = res)
  RunUMAP(o, reduction = "harmony", dims = dims)
}

obj <- readRDS("results/06_annotated_subtypes.rds")
obj <- DietSeurat(obj, scale.data = FALSE)   # drop the big scale.data matrix
gc()
obj
table(obj$subtype)
mural_markers <- c("RERGL", "MCAM", "MYH11", "STEAP4", "RGS5", "ACTA2", "GGT5",
                   "ABCC9", "SUSD2", "DCN", "LUM", "MME", "CCL19")
p_str <- DotPlot(stromal, features = mural_markers, group.by = "seurat_clusters") + RotatedAxis()
ggsave("plots/07_stromal_dotplot_v2.png", p_str, width = 11, height = 7, dpi = 150, bg = "white")
# STEP 12b - Assign stromal subtypes (from DotPlot)
mural_clusters     <- c("5", "12")
prv_ccl19_clusters <- c("5")

stopifnot(all(colnames(stromal) %in% colnames(obj)))
cl <- as.character(stromal$seurat_clusters)
stromal$subtype <- case_when(
  cl %in% prv_ccl19_clusters ~ "Prv-CCL19",
  cl %in% mural_clusters     ~ "Other mural",
  TRUE                       ~ "Other stromal"
)
obj$subtype[match(colnames(stromal), colnames(obj))] <- stromal$subtype
table(obj$subtype)
saveRDS(obj, "results/07_annotated_subtypes_all.rds")
# STEP 14 - Target-gene screening (go / no-go)
counts <- GetAssayData(obj, assay = "RNA", layer = "counts")
stopifnot(all(c("CCL19", "LYVE1") %in% rownames(counts)))
stopifnot(identical(colnames(counts), rownames(obj@meta.data)))

df <- obj@meta.data %>%
  dplyr::select(patient_id, tissue, condition, cell_type, subtype) %>%
  mutate(CCL19 = as.numeric(counts["CCL19", ]),
         LYVE1 = as.numeric(counts["LYVE1", ]))

groups <- list(
  CCL19 = list("All stromal" = df$cell_type == "Stromal",
               "All mural"   = df$subtype %in% c("Prv-CCL19", "Other mural"),
               "Prv-CCL19"   = df$subtype == "Prv-CCL19"),
  LYVE1 = list("All myeloid"     = df$cell_type == "Myeloid",
               "All macrophages" = df$subtype %in% c("Mac-LYVE1", "Other macrophage"),
               "Mac-LYVE1"       = df$subtype == "Mac-LYVE1")
)

screen <- map_dfr(names(groups), function(g) {
  map_dfr(names(groups[[g]]), function(grp) {
    df[groups[[g]][[grp]], ] %>%
      group_by(patient_id, tissue) %>%
      summarise(n_cells = n(), n_expr = sum(.data[[g]] > 0),
                pct_expr = 100 * n_expr / n_cells, .groups = "drop") %>%
      mutate(gene = g, group = grp)
  })
})
write_csv(screen, "results/target_screen_per_patient.csv")

min_cells <- 50
min_expr  <- 10

summary_overall <- screen %>%
  group_by(gene, group) %>%
  summarise(usable_patients = n_distinct(patient_id[n_cells >= min_cells & n_expr >= min_expr]),
            total_cells = sum(n_cells), expr_cells = sum(n_expr),
            pooled_pct_expr = round(100 * expr_cells / total_cells, 1), .groups = "drop")

summary_by_tissue <- screen %>%
  group_by(gene, group, tissue) %>%
  summarise(usable_patients = sum(n_cells >= min_cells & n_expr >= min_expr),
            total_cells = sum(n_cells), expr_cells = sum(n_expr), .groups = "drop")

write_csv(summary_overall,   "results/target_screen_summary_overall.csv")
write_csv(summary_by_tissue, "results/target_screen_summary_by_tissue.csv")
print(summary_overall, n = Inf)
print(summary_by_tissue, n = Inf)
# STEP 15 - Export ML datasets (only the two target groups)
dir.create("results/ml_export", showWarnings = FALSE)

export_group <- function(name, subtypes) {
  cells <- colnames(obj)[obj$subtype %in% subtypes]
  sub <- subset(obj, cells = cells)
  d <- file.path("results/ml_export", name)
  dir.create(d, showWarnings = FALSE)
  writeMM(GetAssayData(sub, layer = "data"),   file.path(d, "lognorm.mtx"))
  writeMM(GetAssayData(sub, layer = "counts"), file.path(d, "counts.mtx"))
  writeLines(rownames(sub), file.path(d, "genes.txt"))
  writeLines(colnames(sub), file.path(d, "barcodes.txt"))
  sub@meta.data %>%
    tibble::rownames_to_column("barcode") %>%
    dplyr::select(barcode, gsm, patient_id, condition, tissue, cell_type,
                  subtype, nCount_RNA, nFeature_RNA, percent.mt) %>%
    write_csv(file.path(d, "cell_metadata.csv"))
  length(cells)
}
export_group("macrophages_LYVE1", c("Mac-LYVE1", "Other macrophage"))   # expect 4762
export_group("mural_CCL19",       c("Prv-CCL19", "Other mural"))        # expect 2537
# STEP 15b - Export myeloid cluster labels for the macrophage cells
myeloid <- readRDS("results/06_myeloid.rds")
mac <- myeloid@meta.data %>%
  tibble::rownames_to_column("barcode") %>%
  dplyr::filter(seurat_clusters %in% c("1", "2", "5", "6", "8")) %>%
  dplyr::transmute(barcode, myeloid_cluster = as.character(seurat_clusters))
nrow(mac)                     # expect 4762
table(mac$myeloid_cluster)    # cluster 2 should be 1289
write_csv(mac, "results/ml_export/macrophages_LYVE1/myeloid_clusters.csv")
rm(myeloid); gc()
# ===== External validation: GSE213216 (pilot) =====
ext_files <- list.files("external", pattern = "\\.tar\\.gz$",
                        recursive = TRUE, full.names = TRUE)
length(ext_files)          # expect 6
basename(ext_files)

for (f in ext_files) {
  cat("\n", basename(f), "\n")
  print(untar(f, list = TRUE))
}
# ===== External validation: GSE213216 (pilot) =====
dir.exists("external")
list.files("external", recursive = TRUE)

# if the six sample archives are not there yet, extract the big tar into external/
pat <- "sample[0-9]+\\.tar(\\.gz)?$"
if (length(list.files("external", pattern = pat, recursive = TRUE)) == 0) {
  untar("external/GSE213216_RAW.tar", exdir = "external")
}

ext_files <- list.files("external", pattern = pat, recursive = TRUE, full.names = TRUE)
length(ext_files)          # expect 6
for (f in ext_files) {
  cat("\n", basename(f), "\n")
  print(untar(f, list = TRUE))
}
# ===== External validation pilot: quick look at 6 samples =====
library(Seurat); library(hdf5r)

ext_files <- list.files("external", pattern = "sample[0-9]+\\.tar\\.gz$", full.names = TRUE)
dir.create("external/h5", showWarnings = FALSE)

res <- lapply(ext_files, function(f) {
  s     <- sub(".*_(sample[0-9]+)\\.tar\\.gz$", "\\1", basename(f))
  inner <- paste0(s, "/outs/filtered_feature_bc_matrix.h5")
  untar(f, files = inner, exdir = "external/h5")          # extract only this one file
  m <- Read10X_h5(file.path("external/h5", inner))
  if (is.list(m)) m <- m[["Gene Expression"]]
  pos <- function(g) if (g %in% rownames(m)) sum(m[g, ] > 0) else NA
  data.frame(sample = s, n_genes = nrow(m), n_cells = ncol(m),
             LYVE1 = pos("LYVE1"), CCL19 = pos("CCL19"),
             CD68 = pos("CD68"), C1QA = pos("C1QA"),
             FOLR2 = pos("FOLR2"), MRC1 = pos("MRC1"))
})

info <- data.frame(
  sample  = c("sample1", "sample5", "sample24", "sample44", "sample45", "sample46"),
  patient = c(1, 4, 10, 20, 21, 21),
  tissue  = c("Endometrioma", "Endometriosis", "Eutopic", "Endometriosis",
              "Endometriosis", "Endometriosis"))

ext_tab <- merge(info, do.call(rbind, res), by = "sample")
dir.create("results", showWarnings = FALSE)
write.csv(ext_tab, "results/external_pilot_table.csv", row.names = FALSE)
ext_tab
# ===== External validation: batch 2 (4 eutopic samples) + summary of all 10 =====
library(Seurat); library(hdf5r)

big <- list.files("external/batch2", pattern = "\\.tar$", full.names = TRUE)
big                                   # expect 1 file
untar(big[1], exdir = "external/batch2")

ext2 <- list.files("external/batch2", pattern = "sample[0-9]+\\.tar\\.gz$", full.names = TRUE)
length(ext2)                          # expect 4
dir.create("external/h5", showWarnings = FALSE)
for (f in ext2) {
  s <- sub(".*_(sample[0-9]+)\\.tar\\.gz$", "\\1", basename(f))
  untar(f, files = paste0(s, "/outs/filtered_feature_bc_matrix.h5"), exdir = "external/h5")
}

h5s <- list.files("external/h5", pattern = "filtered_feature_bc_matrix\\.h5$",
                  recursive = TRUE, full.names = TRUE)
length(h5s)                           # expect 10

summ <- function(path) {
  s <- basename(dirname(dirname(path)))
  m <- Read10X_h5(path)
  if (is.list(m)) m <- m[["Gene Expression"]]
  pos <- function(g) if (g %in% rownames(m)) as.vector(m[g, ] > 0) else rep(NA, ncol(m))
  mac <- pos("CD68"); lv <- pos("LYVE1")
  data.frame(sample = s, n_genes = nrow(m), n_cells = ncol(m),
             CD68 = sum(mac, na.rm = TRUE), C1QA = sum(pos("C1QA"), na.rm = TRUE),
             FOLR2 = sum(pos("FOLR2"), na.rm = TRUE), MRC1 = sum(pos("MRC1"), na.rm = TRUE),
             LYVE1 = sum(lv, na.rm = TRUE), LYVE1_in_CD68 = sum(lv & mac, na.rm = TRUE),
             CCL19 = sum(pos("CCL19"), na.rm = TRUE))
}

info <- data.frame(
  sample  = c("sample1", "sample5", "sample24", "sample44", "sample45", "sample46",
              "sample35", "sample40", "sample38", "sample8"),
  patient = c(1, 4, 10, 20, 21, 21, 14, 18, 16, 6),
  tissue  = c("Endometrioma", "Endometriosis", "Eutopic", "Endometriosis", "Endometriosis",
              "Endometriosis", "Eutopic", "Eutopic", "Eutopic", "Eutopic"))

ext_tab <- merge(info, do.call(rbind, lapply(h5s, summ)), by = "sample")
write.csv(ext_tab, "results/external_pilot_table.csv", row.names = FALSE)
options(width = 200)
ext_tab[order(ext_tab$tissue, ext_tab$patient), ]
# ===== External validation: batch 2 (4 eutopic samples) + summary of all 10 =====
library(Seurat); library(hdf5r)

big <- list.files("external/batch2", pattern = "\\.tar$", full.names = TRUE)
big                                   # expect 1 file
untar(big[1], exdir = "external/batch2")

ext2 <- list.files("external/batch2", pattern = "sample[0-9]+\\.tar\\.gz$", full.names = TRUE)
length(ext2)                          # expect 4
dir.create("external/h5", showWarnings = FALSE)
for (f in ext2) {
  s <- sub(".*_(sample[0-9]+)\\.tar\\.gz$", "\\1", basename(f))
  untar(f, files = paste0(s, "/outs/filtered_feature_bc_matrix.h5"), exdir = "external/h5")
}

h5s <- list.files("external/h5", pattern = "filtered_feature_bc_matrix\\.h5$",
                  recursive = TRUE, full.names = TRUE)
length(h5s)                           # expect 10

summ <- function(path) {
  s <- basename(dirname(dirname(path)))
  m <- Read10X_h5(path)
  if (is.list(m)) m <- m[["Gene Expression"]]
  pos <- function(g) if (g %in% rownames(m)) as.vector(m[g, ] > 0) else rep(NA, ncol(m))
  mac <- pos("CD68"); lv <- pos("LYVE1")
  data.frame(sample = s, n_genes = nrow(m), n_cells = ncol(m),
             CD68 = sum(mac, na.rm = TRUE), C1QA = sum(pos("C1QA"), na.rm = TRUE),
             FOLR2 = sum(pos("FOLR2"), na.rm = TRUE), MRC1 = sum(pos("MRC1"), na.rm = TRUE),
             LYVE1 = sum(lv, na.rm = TRUE), LYVE1_in_CD68 = sum(lv & mac, na.rm = TRUE),
             CCL19 = sum(pos("CCL19"), na.rm = TRUE))
}

info <- data.frame(
  sample  = c("sample1", "sample5", "sample24", "sample44", "sample45", "sample46",
              "sample35", "sample40", "sample38", "sample8"),
  patient = c(1, 4, 10, 20, 21, 21, 14, 18, 16, 6),
  tissue  = c("Endometrioma", "Endometriosis", "Eutopic", "Endometriosis", "Endometriosis",
              "Endometriosis", "Eutopic", "Eutopic", "Eutopic", "Eutopic"))

ext_tab <- merge(info, do.call(rbind, lapply(h5s, summ)), by = "sample")
write.csv(ext_tab, "results/external_pilot_table.csv", row.names = FALSE)
options(width = 200)
ext_tab[order(ext_tab$tissue, ext_tab$patient), ]
# lenient macrophage-like definition: CD68 or C1QA or FOLR2 positive
h5s <- list.files("external/h5", pattern = "filtered_feature_bc_matrix\\.h5$",
                  recursive = TRUE, full.names = TRUE)
lenient <- function(path) {
  s <- basename(dirname(dirname(path)))
  m <- Read10X_h5(path)
  if (is.list(m)) m <- m[["Gene Expression"]]
  g <- function(x) as.vector(m[x, ] > 0)
  mac <- g("CD68") | g("C1QA") | g("FOLR2")
  data.frame(sample = s, mac_like = sum(mac),
             LYVE1_in_mac_like = sum(g("LYVE1") & mac), LYVE1_total = sum(g("LYVE1")))
}
lenient_tab <- do.call(rbind, lapply(h5s, lenient))
lenient_tab[order(-lenient_tab$LYVE1_in_mac_like), ]

# why did sample35 fail?
f35 <- list.files("external/batch2", pattern = "sample35\\.tar\\.gz$", full.names = TRUE)
untar(f35, list = TRUE)
# ===== External validation: batch 3 (ovarian samples) + all samples summary =====
library(Seurat); library(hdf5r)

# 1) find the new download (newest GSE213216_RAW*.tar in Downloads)
dl <- list.files("C:/Users/ATG/Downloads", pattern = "^GSE213216_RAW.*\\.tar$", full.names = TRUE)
fi <- file.info(dl)
data.frame(file = basename(dl), GB = round(fi$size / 1e9, 2), time = fi$mtime)
src <- dl[which.max(fi$mtime)]
stopifnot(file.info(src)$size > 2.5e9, file.info(src)$size < 3.6e9)   # ~3 GB expected

# 2) copy into external/batch3 and extract
dir.create("external/batch3", showWarnings = FALSE)
file.copy(src, "external/batch3/GSE213216_RAW_batch3.tar")
untar("external/batch3/GSE213216_RAW_batch3.tar", exdir = "external/batch3")
length(list.files("external/batch3", pattern = "sample[0-9]+\\.tar\\.gz$"))   # expect 6

# 3) read every sample (h5 if available, otherwise the mtx folder)
get_counts <- function(f) {
  s   <- sub(".*_(sample[0-9]+)\\.tar\\.gz$", "\\1", basename(f))
  lst <- untar(f, list = TRUE)
  h5  <- paste0(s, "/outs/filtered_feature_bc_matrix.h5")
  if (h5 %in% lst) {
    untar(f, files = h5, exdir = "external/h5")
    m <- Read10X_h5(file.path("external/h5", h5))
  } else {
    d <- paste0(s, "/outs/filtered_feature_bc_matrix")
    untar(f, files = paste0(d, "/", c("barcodes.tsv.gz", "features.tsv.gz", "matrix.mtx.gz")),
          exdir = "external/h5")
    m <- Read10X(file.path("external/h5", d))
  }
  if (is.list(m)) m <- m[["Gene Expression"]]
  m
}

all_tar <- list.files("external", pattern = "sample[0-9]+\\.tar\\.gz$",
                      recursive = TRUE, full.names = TRUE)
length(all_tar)    # expect 16

summ <- function(f) {
  s <- sub(".*_(sample[0-9]+)\\.tar\\.gz$", "\\1", basename(f))
  m <- get_counts(f)
  g <- function(x) if (x %in% rownames(m)) as.vector(m[x, ] > 0) else rep(FALSE, ncol(m))
  mac <- g("CD68") | g("C1QA") | g("FOLR2")
  out <- data.frame(sample = s, n_cells = ncol(m), mac_like = sum(mac),
                    LYVE1_in_mac_like = sum(g("LYVE1") & mac), LYVE1_total = sum(g("LYVE1")),
                    CCL19_total = sum(g("CCL19")))
  rm(m); gc(verbose = FALSE)
  out
}
tab <- do.call(rbind, lapply(all_tar, summ))

info <- data.frame(
  sample  = c("sample1", "sample5", "sample24", "sample44", "sample45", "sample46",
              "sample35", "sample40", "sample38", "sample8",
              "sample12", "sample15", "sample21", "sample29", "sample42", "sample33"),
  patient = c(1, 4, 10, 20, 21, 21, 14, 18, 16, 6, 7, 8, 9, 11, 19, 14),
  tissue  = c("Endometrioma", "Endometriosis", "Eutopic", "Endometriosis", "Endometriosis",
              "Endometriosis", "Eutopic", "Eutopic", "Eutopic", "Eutopic",
              "Endometrioma", "Endometrioma", "Endometrioma", "Endometrioma", "Endometrioma",
              "Endometriosis (ovary)"))
ext_all <- merge(info, tab, by = "sample")
write.csv(ext_all, "results/external_all_samples.csv", row.names = FALSE)
options(width = 200)
ext_all[order(ext_all$tissue, ext_all$patient), ]

# 4) decision rule: patients with >= 10 LYVE1+ macrophage-like cells
pp <- aggregate(LYVE1_in_mac_like ~ patient, data = ext_all, FUN = sum)
pp[order(-pp$LYVE1_in_mac_like), ]
sum(pp$LYVE1_in_mac_like >= 10)   # need >= 5
# ===== External validation (GSE213216): extract macrophage-like cells =====
# Rule fixed BEFORE looking at results: LYVE1, FOLR2 and MRC1 are NOT used to select cells.
library(Seurat); library(hdf5r); library(Matrix); library(dplyr)
library(scDblFinder); library(SingleCellExperiment)
set.seed(42)

train_genes <- readLines("results/ml_export/macrophages_LYVE1/genes.txt")
length(train_genes)                                  # expect 27722
med_umi   <- 8855                                    # training scale factor (median UMI)
mac_genes <- c("C1QA", "C1QB", "C1QC", "CD68", "CD163", "MS4A7")
stopifnot(all(c("LYVE1", "CCL19", mac_genes) %in% train_genes))

ext_samples <- data.frame(
  sample  = c("sample12", "sample15", "sample21", "sample29", "sample35", "sample33"),
  patient = c("X07", "X08", "X09", "X11", "X14", "X14"),
  tissue  = c("Endometrioma", "Endometrioma", "Endometrioma", "Endometrioma",
              "Eutopic", "Endometriosis_ovary"),
  stringsAsFactors = FALSE)

all_tar <- list.files("external", pattern = "sample[0-9]+\\.tar\\.gz$",
                      recursive = TRUE, full.names = TRUE)

get_counts <- function(f) {
  s   <- sub(".*_(sample[0-9]+)\\.tar\\.gz$", "\\1", basename(f))
  lst <- untar(f, list = TRUE)
  h5  <- paste0(s, "/outs/filtered_feature_bc_matrix.h5")
  if (h5 %in% lst) {
    untar(f, files = h5, exdir = "external/h5")
    m <- Read10X_h5(file.path("external/h5", h5))
  } else {
    d <- paste0(s, "/outs/filtered_feature_bc_matrix")
    untar(f, files = paste0(d, "/", c("barcodes.tsv.gz", "features.tsv.gz", "matrix.mtx.gz")),
          exdir = "external/h5")
    m <- Read10X(file.path("external/h5", d))
  }
  if (is.list(m)) m <- m[["Gene Expression"]]
  m
}

align_genes <- function(m, genes) {          # same genes, same order as training; missing genes = 0
  ok <- genes %in% rownames(m)
  m2 <- m[genes[ok], , drop = FALSE]
  if (any(!ok)) {
    z <- sparseMatrix(i = integer(0), j = integer(0), x = numeric(0),
                      dims = c(sum(!ok), ncol(m)), dimnames = list(genes[!ok], colnames(m)))
    m2 <- rbind(m2, z)
  }
  m2[genes, , drop = FALSE]
}

process_sample <- function(i) {
  s <- ext_samples$sample[i]
  f <- all_tar[grepl(paste0("_", s, "\\.tar\\.gz$"), all_tar)]
  stopifnot(length(f) == 1)
  m <- get_counts(f); n0 <- ncol(m)
  
  # QC (same thresholds as training)
  nC <- Matrix::colSums(m); nF <- Matrix::colSums(m > 0)
  mt <- Matrix::colSums(m[grepl("^MT-", rownames(m)), , drop = FALSE]) / nC * 100
  keep <- nF >= 500 & nC >= 1000 & nC <= 100000 & mt < 25
  m <- m[, keep, drop = FALSE]; mt <- mt[keep]; n1 <- ncol(m)
  
  m <- align_genes(m, train_genes)
  sce <- scDblFinder(m)
  single <- sce$scDblFinder.class == "singlet"
  m <- m[, single, drop = FALSE]; mt <- mt[single]; n2 <- ncol(m)
  
  nCount <- Matrix::colSums(m); nFeat <- Matrix::colSums(m > 0)
  n_mac  <- Matrix::colSums(m[mac_genes, , drop = FALSE] > 0)
  is_mac <- n_mac >= 2
  m <- m[, is_mac, drop = FALSE]
  
  norm <- as(m %*% Diagonal(x = med_umi / nCount[is_mac]), "CsparseMatrix")
  norm@x <- log1p(norm@x)
  colnames(norm) <- paste0(s, "_", colnames(m))
  
  meta <- data.frame(barcode = colnames(norm), sample = s,
                     patient_id = ext_samples$patient[i], tissue = ext_samples$tissue[i],
                     nCount_RNA = nCount[is_mac], nFeature_RNA = nFeat[is_mac],
                     percent.mt = mt[is_mac], n_mac_markers = n_mac[is_mac],
                     stringsAsFactors = FALSE)
  stats <- data.frame(sample = s, patient = ext_samples$patient[i], raw = n0, after_QC = n1,
                      singlets = n2, mac_like = sum(is_mac),
                      LYVE1_pos = sum(norm["LYVE1", ] > 0))
  rm(m, sce); gc(verbose = FALSE)
  list(mat = norm, meta = meta, stats = stats)
}

res <- lapply(seq_len(nrow(ext_samples)), process_sample)
stats <- do.call(rbind, lapply(res, `[[`, "stats"))
stats$pct_LYVE1 <- round(100 * stats$LYVE1_pos / stats$mac_like, 1)
options(width = 200)
stats

per_patient <- aggregate(LYVE1_pos ~ patient, data = stats, FUN = sum)
per_patient[order(-per_patient$LYVE1_pos), ]

# save (genes x cells, same gene order as training)
out_dir <- "results/ml_export/external_macrophages"
dir.create(out_dir, showWarnings = FALSE, recursive = TRUE)
norm_all <- do.call(cbind, lapply(res, `[[`, "mat"))
meta_all <- do.call(rbind, lapply(res, `[[`, "meta"))
stopifnot(identical(colnames(norm_all), meta_all$barcode))
writeMM(norm_all, file.path(out_dir, "lognorm.mtx"))
writeLines(rownames(norm_all), file.path(out_dir, "genes.txt"))
writeLines(colnames(norm_all), file.path(out_dir, "barcodes.txt"))
write.csv(meta_all, file.path(out_dir, "cell_metadata.csv"), row.names = FALSE)
dim(norm_all)