# =====================================================================
# Endometriosis scRNA-seq (GSE179640, Tan et al. 2022)
# Main pipeline: QC -> clustering -> annotation -> target-gene screening -> ML export
# Project: machine-learning prediction of LYVE1 / CCL19 expression in unseen patients
# =====================================================================
# HOW TO USE
#  * Open the RStudio project (endo_ml.Rproj) first: all paths are relative to the project root
#    (no setwd). Folders: data/raw, data/external, results/*, figures.
#  * Run section by section. Every section saves its result in results/ and the next
#    section can start from that file.
#  * The heavy steps ran out of memory on a 16 GB machine when everything stayed in one
#    R session (std::bad_alloc). Restart R (Session > Restart R) between sections if needed.
#  * IMPORTANT: the cluster numbers used in Sections 6-8 (cluster_map, macrophage_clusters,
#    mural_clusters ...) were chosen by looking at the DotPlots of the ORIGINAL run.
#    Clustering is not guaranteed to give the same numbers on another machine or package
#    version, so re-check the DotPlots before reusing these numbers.
#  * This file was assembled from the code that was run step by step. It has not been run
#    end to end as a single script.
# =====================================================================


# =====================================================================
# SECTION 0 - Setup, helper functions
# =====================================================================
options(timeout = 7200)
set.seed(42)

pkgs_cran <- c("Seurat", "harmony", "tidyverse", "Matrix", "data.table", "hdf5r", "patchwork")
new_cran <- setdiff(pkgs_cran, rownames(installed.packages()))
if (length(new_cran)) install.packages(new_cran)

if (!requireNamespace("BiocManager", quietly = TRUE)) install.packages("BiocManager")
pkgs_bioc <- c("scDblFinder", "SingleCellExperiment")
new_bioc <- setdiff(pkgs_bioc, rownames(installed.packages()))
if (length(new_bioc)) BiocManager::install(new_bioc, ask = FALSE, update = FALSE)

suppressPackageStartupMessages({
  library(Seurat); library(harmony); library(tidyverse); library(Matrix)
  library(scDblFinder); library(SingleCellExperiment); library(patchwork)
})

for (d in c("figures", "results/01_processing", "results/02_annotation",
           "results/03_target_screening", "results/04_ml_export"))
  dir.create(d, recursive = TRUE, showWarnings = FALSE)

# genes excluded from the highly variable genes (mito, ribosomal, hemoglobin, cell cycle, stress)
stress_genes <- c("FOS", "FOSB", "JUN", "JUNB", "JUND", "HSPA1A", "HSPA1B", "DNAJB1",
                  "HSP90AA1", "DUSP1", "ATF3", "EGR1", "IER2")
clean_hvg <- function(genes) {
  bad <- c(grep("^MT-|^RP[SL][0-9]|^HB[AB]", genes, value = TRUE),
           cc.genes.updated.2019$s.genes, cc.genes.updated.2019$g2m.genes, stress_genes)
  setdiff(genes, bad)
}

# re-cluster a subset of cells (used for myeloid and stromal cells)
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


# =====================================================================
# SECTION 1 - Sample table (from file names)
#   Data: GSE179640_RAW.tar from GEO, extracted into data/raw/GSE179640_RAW/
#   The 31 single-cell tissue biopsies are the .h5 files without "EOR".
#   Excluded: the four EOR samples (EOR01 and EOR03 had no CCL19/LYVE1 signal; for EOR02 and
#   EOR04 the genes were not found by name and the cell numbers were unusual: 100,000 and
#   249,996). The reason was not investigated.
#   Patient / tissue labels come from the file names because the GEO download failed.
# =====================================================================
raw_dir <- "data/raw/GSE179640_RAW"
stopifnot(dir.exists(raw_dir))

h5 <- list.files(raw_dir, pattern = "\\.h5$")
b  <- sub("_filtered_feature_bc_matrix\\.h5$", "", h5)
parts <- strsplit(b, "_")

meta <- tibble(
  gsm        = sapply(parts, `[`, 1),
  patient_id = sapply(parts, `[`, 2),
  tissue     = sapply(parts, `[`, 3),
  file       = file.path(raw_dir, h5)
) %>%
  filter(tissue != "EOR", !is.na(tissue)) %>%       # EOR01 / EOR03 have no tissue field
  mutate(
    tissue    = ifelse(tissue == "EcPA2", "EcPA", tissue),   # E09 technical replicate
    condition = ifelse(grepl("^C", patient_id), "Control", "Endometriosis"),
    tissue    = factor(tissue, levels = c("Ctrl", "EuE", "EcP", "EcPA", "EcO"))
  )

nrow(meta)                    # expected: 31
table(meta$tissue)            # Ctrl 3, EuE 9, EcP 8, EcPA 7, EcO 4
n_distinct(meta$patient_id)   # expected: 14
write_csv(meta, "results/01_processing/sample_metadata.csv")


# =====================================================================
# SECTION 2 - Load samples, per-sample QC, merge (memory-friendly)
#   QC as in the original study (preprint Methods): cells >= 500 genes, >= 1000 UMIs,
#   <= 100,000 UMIs, < 25% mitochondrial; genes detected in >= 3 cells.
#   merge() + JoinLayers() ran out of memory, so QC is done per sample and the count
#   matrices are combined with cbind() on the genes shared by all samples
#   (sample GSM6595261 / E10 used a different gene annotation).
# =====================================================================
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
length(objs)   # 31

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

# use only genes present in ALL samples
common <- Reduce(intersect, lapply(qc_counts, rownames))
length(common)
all(c("CCL19", "LYVE1") %in% common)    # must be TRUE
qc_counts  <- lapply(qc_counts, function(m) m[common, , drop = FALSE])
counts_all <- do.call(cbind, qc_counts)
rm(qc_counts); gc()

# keep genes detected in >= 3 cells
counts_all <- counts_all[Matrix::rowSums(counts_all > 0) >= 3, ]

obj <- CreateSeuratObject(counts_all, meta.data = md, project = "endo")
obj[["percent.mt"]] <- PercentageFeatureSet(obj, pattern = "^MT-")
rm(counts_all, md); gc()

c(before = cells_before, after = ncol(obj))   # 140,433 -> 111,060 (27,722 genes)
table(obj$patient_id, obj$tissue)
saveRDS(obj, "results/01_processing/01_qc_filtered_nodoublet.rds")


# =====================================================================
# SECTION 3 - Doublet removal (scDblFinder, per sample)
#   Note: the original study used Scrublet plus extra cluster-level filtering; only
#   scDblFinder was used here.
# =====================================================================
set.seed(42)
sce <- scDblFinder(GetAssayData(obj, layer = "counts"), samples = obj$gsm)
obj$doublet_class <- sce$scDblFinder.class
table(obj$doublet_class)                       # 6,717 doublets
obj <- subset(obj, subset = doublet_class == "singlet")
rm(sce); gc()
ncol(obj)                                      # 104,343
saveRDS(obj, "results/01_processing/01_qc_filtered.rds")


# =====================================================================
# SECTION 4 - Normalization, highly variable genes, PCA
#   normalize to the median UMI + log; 2000 HVGs minus mito/ribo/Hb/cell-cycle/stress genes
# =====================================================================
med_umi <- median(obj$nCount_RNA)              # 8855 in the original run
obj <- NormalizeData(obj, normalization.method = "LogNormalize", scale.factor = med_umi)
obj <- FindVariableFeatures(obj, nfeatures = 2000)
VariableFeatures(obj) <- clean_hvg(VariableFeatures(obj))
obj <- ScaleData(obj, features = VariableFeatures(obj))
obj <- RunPCA(obj, npcs = 50, verbose = FALSE)
ggsave("figures/02_elbow.png", ElbowPlot(obj, ndims = 50),
       width = 6, height = 4, dpi = 150, bg = "white")
saveRDS(obj, "results/01_processing/02_normalized_pca.rds")


# =====================================================================
# SECTION 5 - Batch correction (Harmony, for clustering only), clustering, UMAP
#   Harmony is used ONLY for clustering / annotation. The ML part uses the
#   log-normalized expression values, not the Harmony embedding.
# =====================================================================
obj <- RunHarmony(obj, group.by.vars = "patient_id", reduction.use = "pca",
                  reduction.save = "harmony", verbose = FALSE)
saveRDS(obj, "results/01_processing/03_harmony.rds")

obj <- FindNeighbors(obj, reduction = "harmony", dims = 1:30)
obj <- FindClusters(obj, resolution = 0.3)
obj <- RunUMAP(obj, reduction = "harmony", dims = 1:30)

p1 <- DimPlot(obj, group.by = "seurat_clusters", label = TRUE) + NoLegend()
p2 <- DimPlot(obj, group.by = "tissue")
p3 <- DimPlot(obj, group.by = "patient_id")
ggsave("figures/03_umap_overview.png", p1 + p2 + p3, width = 20, height = 6, dpi = 150, bg = "white")

table(obj$seurat_clusters)                     # 23 clusters (0-22)
saveRDS(obj, "results/01_processing/04_clustered.rds")


# =====================================================================
# SECTION 6 - Major cell types (manual, from the DotPlot)
#   CCL19 / LYVE1 are deliberately NOT used as markers.
# =====================================================================
# obj <- readRDS("results/01_processing/04_clustered.rds")
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
ggsave("figures/04_major_celltype_dotplot.png", p_dot, width = 12, height = 8, dpi = 150, bg = "white")

# >>> cluster numbers from the ORIGINAL run: re-check against the DotPlot before reusing <<<
# unclear clusters (8, 13, 15, 18, 20, 21) are left "Unassigned"
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

ggsave("figures/05_umap_celltype.png", DimPlot(obj, group.by = "cell_type", label = TRUE),
       width = 8, height = 6, bg = "white")
saveRDS(obj, "results/02_annotation/05_annotated_major.rds")


# =====================================================================
# SECTION 7 - Myeloid sub-clustering -> macrophages (target: LYVE1)
#   LYVE1 is shown in the DotPlot only to validate, not to define clusters.
#   Caveat: Mac-LYVE1 (cluster 2) is partly defined by LYVE1-related clustering, so the
#   ML uses the broader group "All macrophages" (Mac-LYVE1 + Other macrophage).
# =====================================================================
# obj <- readRDS("results/02_annotation/05_annotated_major.rds")     # after a restart, start from here
# obj <- DietSeurat(obj, scale.data = FALSE)           # drops the big scale.data matrix

myeloid <- subset(obj, subset = cell_type == "Myeloid")
myeloid <- recluster(myeloid, res = 0.5)               # 14 clusters in the original run

mac_markers <- c("CD68", "CD14", "C1QA", "C1QB", "FOLR2", "MRC1", "ICAM2", "CLEC5A",
                 "CCR2", "VEGFA", "APOE", "SPP1", "FCGR3A", "CD1C", "CLEC9A", "LYZ", "LYVE1")
mac_markers[!mac_markers %in% rownames(myeloid)]       # should be empty

ggsave("figures/08_myeloid_umap.png", DimPlot(myeloid, label = TRUE), width = 7, height = 6, bg = "white")
p_mac <- DotPlot(myeloid, features = mac_markers) + RotatedAxis()
ggsave("figures/09_myeloid_dotplot.png", p_mac, width = 12, height = 6, bg = "white")

table(myeloid$seurat_clusters, myeloid$tissue)
saveRDS(myeloid, "results/02_annotation/06_myeloid.rds")

# >>> cluster numbers from the ORIGINAL run: re-check against the DotPlot <<<
macrophage_clusters <- c("1", "2", "5", "6", "8")      # C1QA / C1QB high
lyve1_mac_clusters  <- c("2")                          # FOLR2+ MRC1+ cluster

cl <- as.character(myeloid$seurat_clusters)
myeloid$subtype <- case_when(
  cl %in% lyve1_mac_clusters  ~ "Mac-LYVE1",
  cl %in% macrophage_clusters ~ "Other macrophage",
  TRUE                        ~ "Other myeloid"
)
obj$subtype <- obj$cell_type
obj$subtype[match(colnames(myeloid), colnames(obj))] <- myeloid$subtype
table(obj$subtype)
saveRDS(obj, "results/02_annotation/06_annotated_subtypes.rds")


# =====================================================================
# SECTION 8 - Stromal sub-clustering -> mural cells (target: CCL19)
#   Run this after a restart: keeping the full object in memory caused std::bad_alloc.
#   Caveat: cluster 5 is called "Prv-CCL19" in the code but should be described as a
#   "perivascular cluster" in the report: it also contains cells from Ctrl and EcO where
#   CCL19 is almost absent.
# =====================================================================
# obj <- readRDS("results/02_annotation/06_annotated_subtypes.rds")
# obj <- DietSeurat(obj, scale.data = FALSE)

stromal <- subset(obj, subset = cell_type == "Stromal")
stromal <- recluster(stromal, res = 0.5)               # 16 clusters in the original run

mural_markers <- c("RERGL", "MCAM", "MYH11", "STEAP4", "RGS5", "ACTA2", "GGT5",
                   "ABCC9", "SUSD2", "DCN", "LUM", "MME", "CCL19")
mural_markers[!mural_markers %in% rownames(stromal)]   # should be empty

ggsave("figures/06_stromal_umap.png", DimPlot(stromal, label = TRUE), width = 7, height = 6, bg = "white")
p_str <- DotPlot(stromal, features = mural_markers, group.by = "seurat_clusters") + RotatedAxis()
ggsave("figures/07_stromal_dotplot_v2.png", p_str, width = 11, height = 7, dpi = 150, bg = "white")

table(stromal$seurat_clusters, stromal$tissue)
lv <- GetAssayData(stromal, layer = "counts")["CCL19", ]
round(tapply(lv > 0, stromal$seurat_clusters, mean) * 100, 1)   # % CCL19+ per cluster
saveRDS(stromal, "results/02_annotation/07_stromal.rds")

# >>> cluster numbers from the ORIGINAL run: re-check against the DotPlot <<<
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
saveRDS(obj, "results/02_annotation/07_annotated_subtypes_all.rds")


# =====================================================================
# SECTION 9 - Target-gene screening (the feasibility / go-no-go analysis)
#   A patient is "usable" for a group if it has >= 50 cells and >= 10 expressing cells
#   (thresholds from the pipeline template, not a standard).
# =====================================================================
# obj <- readRDS("results/02_annotation/07_annotated_subtypes_all.rds")
counts  <- GetAssayData(obj, assay = "RNA", layer = "counts")
targets <- c("CCL19", "LYVE1")
stopifnot(all(targets %in% rownames(counts)))
stopifnot(identical(colnames(counts), rownames(obj@meta.data)))

df <- obj@meta.data %>%
  dplyr::select(patient_id, tissue, condition, cell_type, subtype) %>%
  mutate(CCL19 = as.numeric(counts["CCL19", ]), LYVE1 = as.numeric(counts["LYVE1", ]))

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
write_csv(screen, "results/03_target_screening/target_screen_per_patient.csv")

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

write_csv(summary_overall,   "results/03_target_screening/target_screen_summary_overall.csv")
write_csv(summary_by_tissue, "results/03_target_screening/target_screen_summary_by_tissue.csv")
options(width = 200)
as.data.frame(summary_overall)

summary_by_tissue %>%
  dplyr::select(gene, group, tissue, usable_patients) %>%
  tidyr::pivot_wider(names_from = tissue, values_from = usable_patients)


# =====================================================================
# SECTION 10 - Export the two ML datasets (only the two target groups)
#   LYVE1: all macrophages (4,762 cells)    CCL19: all mural cells (2,537 cells)
#   The ML (Python) uses the log-normalized values ("data" layer), target gene excluded
#   from the inputs there. Large .mtx files are NOT meant for GitHub (100 MB file limit).
# =====================================================================
dir.create("results/04_ml_export", recursive = TRUE, showWarnings = FALSE)

export_group <- function(name, subtypes) {
  cells <- colnames(obj)[obj$subtype %in% subtypes]
  sub <- subset(obj, cells = cells)
  d <- file.path("results/04_ml_export", name)
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

# myeloid cluster label of every macrophage cell (used for the cluster-mean baseline)
myeloid <- readRDS("results/02_annotation/06_myeloid.rds")
mac <- myeloid@meta.data %>%
  tibble::rownames_to_column("barcode") %>%
  dplyr::filter(seurat_clusters %in% c("1", "2", "5", "6", "8")) %>%
  dplyr::transmute(barcode, myeloid_cluster = as.character(seurat_clusters))
nrow(mac)                     # expect 4762
write_csv(mac, "results/04_ml_export/macrophages_LYVE1/myeloid_clusters.csv")
rm(myeloid); gc()

sessionInfo()
