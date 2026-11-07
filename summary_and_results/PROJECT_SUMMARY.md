# Project summary and results

Machine-learning prediction of LYVE1 and CCL19 expression in unseen endometriosis patients from single-cell RNA-seq.

This document collects what was done, every main number, the decisions taken along the way, and the limitations.
Numbers come from the outputs of the R pipeline and the Python notebook; the files that contain them are listed in section 12.

## 1. Question

Can machine learning predict the expression level of selected immune-regulatory genes (LYVE1 in macrophages, CCL19 in
perivascular/mural cells) in cells from patients that were not used for training, using the expression of other genes?

**Answer in one paragraph.** Partly. In held-out patients the models ranked cells by target-gene expression clearly better than
simple baselines (mean per-patient Spearman about 0.6 for LYVE1 and 0.57 for CCL19), and the LYVE1 result was supported in
an independent cohort (0.55 in five patients). Accuracy is moderate, varies strongly between patients, and the number of
patients is small. LYVE1 was predictable in several tissues; CCL19 only where it is expressed (mainly peritoneal lesions),
relied heavily on CCL21, and was not validated externally. All predictions are associations, not causal mechanisms.

## 2. Data

| Dataset | Content | Use |
|---|---|---|
| GSE179640 (Tan et al., 2022) | 39 files = 33 `.h5` + 2 samples as `mtx` (6 files); 35 samples | training and internal evaluation |
| GSE213216 (Fonseca et al., 2023) | 45 single-cell tissue samples from 19 patients (about 15 GB); 16 samples from 14 patients were screened | external validation (LYVE1) |
| GSE266265 (endometrial atlas) | one 38.9 GB `.rds` file | considered, not used (too large for the available machine) |

Samples used from GSE179640: 31 samples from 14 individuals (Ctrl 3, EuE 9, EcP 8, EcPA 7 including one technical replicate of
patient E09, EcO 4). The four EOR samples were excluded: EOR01 and EOR03 had zero detected CCL19/LYVE1 cells; EOR02 and EOR04 did
not contain the genes by name and had unusual cell numbers (100,000 and 249,996). The reason was not investigated.

## 3. Processing pipeline (R, Seurat)

| Step | Result |
|---|---|
| Cells before QC | 140,433 |
| QC per sample (at least 500 genes, at least 1,000 UMIs, at most 100,000 UMIs, below 25% mitochondrial) | 111,060 |
| Doublets removed (scDblFinder) | 6,717 removed, 104,343 cells |
| Genes | 27,722 shared by all samples, detected in at least 3 cells |
| Normalization | to the median UMI count (8,855), log; 1,937 variable genes after removing mitochondrial, ribosomal, hemoglobin, cell-cycle and stress genes |
| Dimensions | 30 PCs; Harmony on patient (for clustering only); 23 clusters (resolution 0.3) |

The memory limit (16 GB) made the standard `merge()` fail (`std::bad_alloc`), so QC was done per sample and count matrices were
combined with `cbind()`. One sample (GSM6595261, patient E10) used a different gene annotation, hence the common-gene set.
Patient and tissue labels come from file names because the GEO metadata download failed.

### Cell types (manual, from marker DotPlots; CCL19 and LYVE1 were not used as markers)

| Type | Cells |
|---|---|
| Stromal | 37,564 |
| Lymphocytes | 21,176 |
| Epithelial | 16,725 |
| Myeloid | 11,504 |
| Endothelial | 10,551 |
| Unassigned | 6,823 |

- Myeloid cells were re-clustered (14 clusters). Macrophages: clusters 1, 2, 5, 6, 8. Cluster 2 (1,289 cells; FOLR2+, MRC1+;
  55.7% LYVE1+) is called "Mac-LYVE1"; the other macrophages (3,473 cells) are "Other macrophage".
- Stromal cells were re-clustered (16 clusters). Mural clusters: 5 and 12. Cluster 5 (2,159 cells; MCAM, RGS5, GGT5, ABCC9,
  STEAP4 high; 22.1% CCL19+) is called "Prv-CCL19" in the code and should be described as a perivascular cluster, because it also
  contains cells from control and ovarian tissue where CCL19 is almost absent. Cluster 12 (378 cells) is "Other mural".
- Cluster numbers come from one run and must be re-checked against the DotPlots if the pipeline is repeated.

## 4. Target screening (feasibility)

A patient counts as "usable" for a group if it has at least 50 cells and 10 expressing cells (thresholds taken from the pipeline
template, not a standard).

| Gene | Group | Cells | Expressing | Usable patients |
|---|---|---|---|---|
| LYVE1 | All macrophages | 4,762 | 1,431 (30.1%) | 10 |
| LYVE1 | Mac-LYVE1 only | 1,289 | 718 (55.7%) | 4 |
| CCL19 | All mural | 2,537 | 495 (19.5%) | 7 |
| CCL19 | Prv-CCL19 only | 2,159 | 478 (22.1%) | 7 |
| CCL19 | All stromal | 37,564 | 569 (1.5%) | 7 |

Usable patients per tissue (All macrophages for LYVE1, All mural for CCL19):

| | Ctrl | EuE | EcP | EcPA | EcO |
|---|---|---|---|---|---|
| LYVE1 | 0 | 4 | 8 | 3 | 4 |
| CCL19 | 1 | 0 | 3 | 5 | 0 |

Decision: the ML uses the broad groups (all macrophages, all mural cells) rather than Mac-LYVE1 or Prv-CCL19, because those
were partly defined by the target genes themselves.

## 5. Machine-learning design

- One regression model per target gene; Elastic Net, Random Forest, XGBoost (fixed settings, not tuned).
- Leave-one-patient-out evaluation: each test patient is completely absent from training. Only patients meeting the usable
  threshold are tested (10 for LYVE1, 7 for CCL19); the other patients stay in training.
- The target gene is removed from the inputs. The 2,000 most variable genes are chosen on training cells only.
- Inputs are the log-normalized values; the Harmony embedding is not used.
- Metrics: Spearman (main), R2, RMSE, MAE, bias, AUC (expressing versus zero), Spearman among expressing cells.
- Baselines: subtype mean, cluster mean, technical metrics only (UMI count, genes detected, mitochondrial fraction).
- Python notebook: `scripts/03_ml_python/03_ml_prediction_and_external_validation.ipynb` (Google Colab). It reproduced the earlier
  numbers exactly when re-run from the exported data.

## 6. Internal results

Mean over the test patients:

| Analysis | Model | Spearman | R2 | RMSE | MAE | AUC | Spearman among expressing |
|---|---|---|---|---|---|---|---|
| LYVE1, all macrophages (10 patients) | Subtype mean (baseline) | 0.478 | -0.033 | 0.991 | 0.744 | 0.722 | 0.385 |
| | Elastic Net | 0.601 | 0.402 | 0.698 | 0.540 | 0.864 | 0.689 |
| | Random Forest | 0.578 | 0.408 | 0.720 | 0.535 | 0.844 | 0.699 |
| | XGBoost | 0.597 | 0.471 | 0.653 | 0.468 | 0.859 | 0.710 |
| CCL19, all mural (7 patients) | Subtype mean (baseline) | 0.109 | -0.274 | 1.331 | 0.969 | 0.542 | 0.162 |
| | Elastic Net | 0.569 | 0.342 | 0.876 | 0.593 | 0.901 | 0.475 |
| | Random Forest | 0.555 | 0.249 | 1.016 | 0.662 | 0.892 | 0.399 |
| | XGBoost | 0.553 | 0.338 | 0.914 | 0.556 | 0.890 | 0.439 |

The three models are close; with this few patients and no tuning, no model is claimed to be better than another.

### Per-patient Spearman

LYVE1 (macrophages):

| Patient | E01 | E02 | E03 | E04 | E05 | E06 | E07 | E09 | E10 | E11 |
|---|---|---|---|---|---|---|---|---|---|---|
| Subtype mean | 0.124 | 0.553 | 0.663 | 0.506 | 0.424 | 0.617 | 0.469 | 0.566 | 0.727 | 0.132 |
| Elastic Net | 0.596 | 0.472 | 0.381 | 0.623 | 0.618 | 0.798 | 0.579 | 0.763 | 0.862 | 0.318 |
| Random Forest | 0.571 | 0.388 | 0.397 | 0.588 | 0.605 | 0.772 | 0.568 | 0.698 | 0.861 | 0.329 |
| XGBoost | 0.605 | 0.455 | 0.405 | 0.620 | 0.615 | 0.786 | 0.527 | 0.746 | 0.872 | 0.342 |

The models beat the subtype baseline in 8 of 10 patients; in E02 and E03 the baseline was higher. E10 has only 54 macrophages.
Patient E11 is the weakest: all models over-predict its mean expression (bias +0.68 to +0.81), but the simple subtype baseline
over-predicts it too (+0.58), so this reflects a lower LYVE1 level in E11 cells than in same-type cells of other patients.

CCL19 (mural cells):

| Patient | C02 | E01 | E02 | E03 | E04 | E05 | E06 |
|---|---|---|---|---|---|---|---|
| Subtype mean | 0.034 | 0.035 | 0.160 | 0.339 | 0.180 | -0.107 | 0.120 |
| Elastic Net | 0.225 | 0.609 | 0.594 | 0.771 | 0.487 | 0.789 | 0.504 |
| Random Forest | 0.210 | 0.569 | 0.540 | 0.786 | 0.484 | 0.772 | 0.525 |
| XGBoost | 0.223 | 0.593 | 0.547 | 0.768 | 0.446 | 0.791 | 0.505 |

All seven patients are above the baseline. C02 is the only control and has just 13 CCL19+ cells. Patient E03 alone contributes
258 of the 495 CCL19+ cells.

## 7. Robustness checks

| Check | Result |
|---|---|
| LYVE1 without the LYVE1-defined cluster (Other macrophages only; 9 patients) | Elastic Net 0.381, XGBoost 0.371, versus 0.037 for a cluster-mean baseline; inside every remaining cluster the correlation stayed positive (0.29 to 0.55) |
| Technical metrics only, LYVE1 | pooled Spearman 0.158 (with genes: 0.584) |
| Technical metrics only, CCL19 inside Prv-CCL19 | pooled Spearman 0.085 (with genes: 0.668) |
| CCL19 without CCL21 as input | Elastic Net 0.548 (R2 0.076), XGBoost 0.535 (R2 0.190): ranking changed little, absolute level got worse |
| Elastic Net tuned (nested, setting chosen inside training patients) | LYVE1 0.602 (R2 0.405); CCL19 0.564 (R2 0.339): no gain over defaults |
| Expressing versus zero (AUC) | LYVE1 0.86; CCL19 0.89 to 0.90 |
| Ranking among expressing cells | LYVE1 0.69 to 0.71; CCL19 0.44 to 0.48 |

The AUC is computed on all cells of the group, so part of it reflects membership of the expression-rich subtype.
The Spearman among expressing cells may partly reflect raw counts and cell depth; this was not tested.

## 8. Genes that drive the predictions (Elastic Net)

Genes with a non-zero coefficient in every leave-one-patient-out fold, always with the same sign. The folds overlap heavily, so
this is weak evidence of stability. A large coefficient means association with the target gene, not a cause.

- **LYVE1:** 59 genes. Positive, largest: RNASE1, LILRB5, COLEC12, MARCO, AGFG1, EMB, CLEC10A, CYBB, FCGR2B, C1QC. Negative,
  largest: APOE, GPNMB, ALCAM, LGALS1, IGSF6, HLA-DQA1. FOLR2 was not selected in any fold; MRC1 and C1QA in 9 of 10 folds.
- **CCL19:** 54 genes. CCL21 dominates (coefficient 0.568, about 3.5 times the next gene CXCL12 at 0.160), then CFD, DEPP1, TNC,
  NBL1. Negative, largest: TCF21, ZFP36, IGFBP2, MT2A, NRP1. Mural markers other than GGT5 were barely used.
- The original study (preprint) reports that Prv-CCL19 cells also express CCL21, consistent with the CCL21 dependence. The
  biological interpretation of the LYVE1 genes has not been checked against the literature.

## 9. External validation (LYVE1, GSE213216)

- Samples were downloaded in three small batches (selected files only). 16 samples from 14 patients were screened; 5 patients had at
  least 10 LYVE1+ macrophage-like cells: GEO patients 7, 8, 9, 11, 14 (labelled X07 to X14 in the files).
- Macrophage-like cell rule (fixed before looking at results): at least 2 of C1QA, C1QB, C1QC, CD68, CD163, MS4A7 detected;
  LYVE1, FOLR2 and MRC1 were not used. Same QC, doublet removal and normalization scale factor as training. Result: 1,663 cells.
- Models were trained on all GSE179640 macrophages with fixed settings and applied without any tuning on external data.

| Patient | Cells | LYVE1+ | Elastic Net | XGBoost | Technical only |
|---|---|---|---|---|---|
| X07 | 198 | 48 | 0.510 | 0.529 | 0.107 |
| X08 | 346 | 154 | 0.695 | 0.703 | 0.210 |
| X09 | 362 | 138 | 0.592 | 0.577 | 0.077 |
| X11 | 667 | 108 | 0.465 | 0.502 | 0.104 |
| X14 | 90 | 19 | 0.505 | 0.426 | 0.213 |
| **Mean** | | | **0.553** | **0.547** | **0.142** |

Mean R2: Elastic Net 0.323, XGBoost 0.354 (constant training-mean prediction: -0.055). AUC about 0.85; pooled Spearman 0.58.
Success criterion defined in advance: Spearman positive and higher than the technical-only model in at least 4 of 5 patients.
It was met in 5 of 5.

Caveats: test patients were selected for detectable LYVE1; 4 of 5 are endometrioma samples; X14 has only 90 cells; hormonal treatment
and cycle phase are unknown; the macrophage definition differs from the training clusters. CCL19 was not validated externally.

## 10. Limitations

1. Few patients (10, 7 and 5); per-patient performance varies widely.
2. Test patients were selected for detectable expression of the target gene (internally and externally).
3. External validation: LYVE1 only, mostly endometrioma, tiny number of cells for one patient.
4. Annotation was done on all patients before the train/test split.
5. Partial circularity: Mac-LYVE1 and Prv-CCL19 clusters were partly shaped by the target genes. The analysis without the LYVE1
   cluster addresses this for LYVE1 only.
6. Doublet removal differs from the original study (scDblFinder only); residual doublets are possible.
7. Four EOR samples excluded without finding the reason.
8. Random Forest and XGBoost were not tuned (XGBoost tuning was too slow on the available machine).
9. The Elastic Net shrinks predictions toward the mean: the highest expression values are under-estimated.
10. Association, not causation.

## 11. Differences from the original study's methods (preprint Methods, compared)

| Item | Original (preprint) | This project |
|---|---|---|
| QC thresholds | same (500 genes, 1,000 UMIs, 100,000 UMIs, 25% mitochondrial, genes in at least 3 cells) | same |
| Normalization and variable genes | median UMI, log, 2,000 genes, same exclusions | same |
| Doublets | Scrublet plus cluster-level filtering | scDblFinder only |
| Harmony | patient, tissue type and stage | patient only (clustering only) |
| Clustering | Leiden (Scanpy) | Louvain (Seurat) |
| Annotation | marker thresholds, statistical | manual from DotPlots |

The number 108,497 cells for the study comes from a secondary table, not the paper itself; this project has 104,343 cells.
Only the preprint Methods were read; the published version could not be opened.

## 12. Literature check

A short search (two queries, not systematic) found machine-learning work on endometriosis diagnosis (bulk RNA-seq classifiers,
foundation models, CNN on an atlas) and one study that used GSE179640 for deconvolution and a diagnosis classifier. It did not
find work that predicts the expression of a specific gene in unseen patients on these data. This is not proof that none exists; a
proper PubMed search is needed before claiming novelty.

## 13. Where everything is

| What | Where |
|---|---|
| R pipeline | `scripts/01_r_pipeline/01_endometriosis_pipeline.R` |
| External data preparation | `scripts/02_external_prep/02_external_validation_prep.R` |
| ML notebook (Colab) | `scripts/03_ml_python/03_ml_prediction_and_external_validation.ipynb` |
| Target screening tables | `results/03_target_screening/` |
| ML tables and predictions | `results/05_ml_results/` (summary: `summary_all_analyses.csv`) |
| Figures | `figures/` (final selection in `summary_and_results/figures/`) |
| Early exploratory scripts | `scripts/archive/` |

The R scripts were assembled from code that was run step by step and have not been run end to end as single files.
Large files (`.rds`, `.mtx`, raw data) are not tracked in Git.

## 14. Not done

- External validation of CCL19.
- Systematic literature review.
- Tuning of Random Forest and XGBoost.
- Investigation of the four excluded EOR samples.
- Check of the LYVE1-associated genes in the literature.
