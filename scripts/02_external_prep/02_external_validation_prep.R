# =====================================================================
# External validation data preparation (GSE213216, Fonseca et al. 2023)
# Goal: macrophage-like cells from an independent cohort, processed like the training data,
#       to test the LYVE1 models trained on GSE179640.
# =====================================================================
# DATA (downloaded in three batches with the GEO "custom download" of GSE213216_RAW.tar,
# NOT the 15.7 GB full archive): the sample archives (*.tar.gz) end up in
# data/external/GSE213216/ (batch2/ and batch3/ hold the later downloads).
# Open the RStudio project (endo_ml.Rproj) first: paths are relative to the project root.
#   screened (16 samples from 14 patients): sample1, 5, 8, 12, 15, 21, 24, 29, 33, 35, 38,
#   40, 42, 44, 45, 46 -> see the table in Section A.
# A first candidate (GSE266265, one 38.9 GB .rds file) was too large to use.
#
# RULES FIXED BEFORE LOOKING AT THE RESULTS
#   * a patient is used for testing only if it has >= 10 LYVE1+ macrophage-like cells
#     (so test patients are selected for detectable LYVE1; this must be stated in the report)
#   * macrophage-like cell = at least 2 of C1QA, C1QB, C1QC, CD68, CD163, MS4A7 detected;
#     LYVE1, FOLR2 and MRC1 are NOT used to select cells
#   * same QC thresholds, doublet removal and normalization scale factor as the training data
# This file was assembled from code that was run step by step; it has not been run end to end.
# =====================================================================
library(Seurat); library(hdf5r); library(Matrix); library(dplyr)
library(scDblFinder); library(SingleCellExperiment)
set.seed(42)

ext_dir <- "data/external/GSE213216"
ext_tar <- list.files(ext_dir, pattern = "sample[0-9]+\\.tar\\.gz$",
                      recursive = TRUE, full.names = TRUE)
length(ext_tar)    # 16 in the original run

# read one sample: filtered h5 if present, otherwise the mtx folder (sample35 has no h5)
get_counts <- function(f) {
  s   <- sub(".*_(sample[0-9]+)\\.tar\\.gz$", "\\1", basename(f))
  lst <- untar(f, list = TRUE)
  h5  <- paste0(s, "/outs/filtered_feature_bc_matrix.h5")
  if (h5 %in% lst) {
    untar(f, files = h5, exdir = file.path(ext_dir, "h5"))
    m <- Read10X_h5(file.path(ext_dir, "h5", h5))
  } else {
    d <- paste0(s, "/outs/filtered_feature_bc_matrix")
    untar(f, files = paste0(d, "/", c("barcodes.tsv.gz", "features.tsv.gz", "matrix.mtx.gz")),
          exdir = file.path(ext_dir, "h5"))
    m <- Read10X(file.path(ext_dir, "h5", d))
  }
  if (is.list(m)) m <- m[["Gene Expression"]]
  m
}


# =====================================================================
# SECTION A - Screening: which patients have enough LYVE1+ macrophage-like cells?
#   (lenient definition: CD68 or C1QA or FOLR2 detected; counts before QC)
# =====================================================================
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
tab <- do.call(rbind, lapply(ext_tar, summ))

# GEO patient id and tissue of each screened sample (from the series matrix of GSE213216)
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
dir.create("results/06_external_validation", recursive = TRUE, showWarnings = FALSE)
write.csv(ext_all, "results/06_external_validation/external_all_samples.csv", row.names = FALSE)
options(width = 200)
ext_all[order(ext_all$tissue, ext_all$patient), ]

pp <- aggregate(LYVE1_in_mac_like ~ patient, data = ext_all, FUN = sum)
pp[order(-pp$LYVE1_in_mac_like), ]
sum(pp$LYVE1_in_mac_like >= 10)    # 5 patients passed (7, 8, 9, 11, 14) out of 14 screened


# =====================================================================
# SECTION B - Extract macrophage-like cells from the 6 samples of the 5 passing patients
# =====================================================================
train_genes <- readLines("results/04_ml_export/macrophages_LYVE1/genes.txt")
length(train_genes)                                  # 27722
med_umi   <- 8855                                    # median UMI of the training data
mac_genes <- c("C1QA", "C1QB", "C1QC", "CD68", "CD163", "MS4A7")
stopifnot(all(c("LYVE1", "CCL19", mac_genes) %in% train_genes))

# patients are labelled X07 ... X14 (GEO patient ids) so they are not confused with E07 ... E14
ext_samples <- data.frame(
  sample  = c("sample12", "sample15", "sample21", "sample29", "sample35", "sample33"),
  patient = c("X07", "X08", "X09", "X11", "X14", "X14"),
  tissue  = c("Endometrioma", "Endometrioma", "Endometrioma", "Endometrioma",
              "Eutopic", "Endometriosis_ovary"),
  stringsAsFactors = FALSE)

align_genes <- function(m, genes) {          # same genes and order as training; missing genes = 0
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
  f <- ext_tar[grepl(paste0("_", s, "\\.tar\\.gz$"), ext_tar)]
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
stats
per_patient <- aggregate(LYVE1_pos ~ patient, data = stats, FUN = sum)
per_patient[order(-per_patient$LYVE1_pos), ]      # all 5 patients >= 10

# save (genes x cells, same gene order as training): 27,722 genes x 1,663 cells
out_dir <- "results/04_ml_export/external_macrophages"
dir.create(out_dir, showWarnings = FALSE, recursive = TRUE)
norm_all <- do.call(cbind, lapply(res, `[[`, "mat"))
meta_all <- do.call(rbind, lapply(res, `[[`, "meta"))
stopifnot(identical(colnames(norm_all), meta_all$barcode))
writeMM(norm_all, file.path(out_dir, "lognorm.mtx"))
writeLines(rownames(norm_all), file.path(out_dir, "genes.txt"))
writeLines(colnames(norm_all), file.path(out_dir, "barcodes.txt"))
write.csv(meta_all, file.path(out_dir, "cell_metadata.csv"), row.names = FALSE)
dim(norm_all)
