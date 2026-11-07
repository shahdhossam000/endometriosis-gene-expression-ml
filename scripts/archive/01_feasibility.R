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
