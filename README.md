# Predicting LYVE1 and CCL19 expression in unseen endometriosis patients from single-cell RNA-seq

**Question:** can machine learning predict the expression level of selected immune-regulatory genes
(LYVE1 in macrophages, CCL19 in perivascular/mural cells) in cells from patients that were not used for training,
using the expression of other genes?

**Short answer from this analysis:** partly. Ranking of cells by expression of the target gene was predicted
better than simple baselines in held-out patients, and the LYVE1 result was supported in an independent cohort.
Accuracy is moderate, varies a lot between patients, and the number of patients is small (see *Limitations*).
Predictions reflect association, not a causal mechanism.

> Status: work in progress. The Python/ML notebook is being added (`scripts/03_ml_python/`).

## Data

| Dataset | Use | Source |
|---|---|---|
| GSE179640 (Tan et al., 2022, Nature Cell Biology) | training and internal evaluation: 31 single-cell biopsies from 14 individuals (control, eutopic, peritoneal and ovarian lesions) | GEO |
| GSE213216 (Fonseca et al., 2023, Nature Genetics) | external validation (LYVE1 only): samples screened from 14 patients, 5 used for testing | GEO |

Raw data and large intermediate files are **not** in this repository (see `.gitignore`).
Download the data from GEO and place it as shown below.

## Analysis overview

1. **Quality control** per sample: cells with at least 500 genes, at least 1,000 UMIs, at most 100,000 UMIs, and less than 25% mitochondrial reads;
   genes detected in at least 3 cells. Doublets removed with scDblFinder. Result: 104,343 cells, 27,722 genes shared by all samples.
2. **Normalization** to the median UMI count (log), 2,000 variable genes, PCA, Harmony (patient) for clustering only, 23 clusters.
3. **Annotation** (manual, from marker DotPlots): five major cell types; myeloid cells re-clustered to find macrophages;
   stromal cells re-clustered to find mural cells.
4. **Target screening:** per gene, group, tissue and patient, how many patients have enough expressing cells.
   Target groups: all macrophages for LYVE1 (4,762 cells, 10 usable patients) and all mural cells for CCL19 (2,537 cells, 7 usable patients).
5. **Machine learning (Python):** Elastic Net, Random Forest and XGBoost regression, one model per target gene,
   leave-one-patient-out evaluation. The target gene is excluded from the inputs and feature selection uses training cells only.
   Baselines: subtype mean, cluster mean, technical metrics only (UMI count, genes detected, mitochondrial fraction).
6. **External validation** (LYVE1): macrophage-like cells from an independent cohort, processed with the same QC, doublet removal
   and normalization; models were applied without retuning.

## Main results

Mean of the per-patient Spearman correlation between predicted and observed expression (test patients only):

| Setting | Elastic Net | Random Forest | XGBoost | Baseline |
|---|---|---|---|---|
| LYVE1, internal (10 patients) | 0.60 | 0.58 | 0.60 | 0.48 (subtype mean) |
| LYVE1, internal, without the LYVE1-defined cluster | 0.38 | - | 0.37 | 0.04 (cluster mean) |
| CCL19, internal (7 patients) | 0.57 | 0.56 | 0.55 | 0.11 (subtype mean) |
| LYVE1, external (5 patients, 1,663 cells) | 0.55 | - | 0.55 | 0.14 (technical metrics only) |

Additional checks: technical metrics alone predicted poorly; tuning Elastic Net hyperparameters did not improve performance;
CCL19 prediction relied strongly on CCL21 (R2 fell from 0.34 to 0.08 without it, ranking changed little).

## Limitations

- Few patients (10 internal for LYVE1, 7 for CCL19, 5 external); per-patient performance varies widely.
- Test patients were selected for detectable expression of the target gene, in both internal and external evaluation.
- External validation covers LYVE1 only; 4 of 5 external patients are endometrioma samples. CCL19 was not validated externally.
- Cell annotation was done on all patients before the train/test split. Clusters used for the target groups were partly defined by genes
  related to the targets (partial circularity); an analysis without the LYVE1-defined cluster is reported above.
- Doublet removal differs from the original study (scDblFinder only). Four EOR samples were excluded without investigating why.
- Hyperparameters of Random Forest and XGBoost were not tuned.
- Hormonal treatment and cycle phase were not available for the external samples.

## Repository structure

```
endo_ml/
├── README.md
├── endo_ml.Rproj
├── scripts/
│   ├── 01_r_pipeline/        01_endometriosis_pipeline.R
│   ├── 02_external_prep/     02_external_validation_prep.R
│   ├── 03_ml_python/         ML notebook (to be added)
│   └── archive/              early exploratory scripts
├── data/                     not tracked: raw/GSE179640_RAW, external/GSE213216
├── results/
│   ├── 01_processing/        QC and normalization checkpoints (not tracked)
│   ├── 02_annotation/        annotated objects (not tracked)
│   ├── 03_target_screening/  tables: patients with enough expressing cells
│   ├── 04_ml_export/         inputs for the ML part (not tracked)
│   ├── 05_ml_results/        predictions and tables from the ML notebook
│   └── 06_external_validation/
├── figures/
└── summary_and_results/
```

## How to run

1. Open `endo_ml.Rproj` in RStudio (R 4.6; Seurat, harmony, scDblFinder, tidyverse, hdf5r).
2. Download GSE179640_RAW from GEO and extract it into `data/raw/GSE179640_RAW/`.
3. Run `scripts/01_r_pipeline/01_endometriosis_pipeline.R` section by section (restart R between sections on a 16 GB machine).
   Cluster numbers used for annotation come from the original run and should be re-checked against the DotPlots.
4. For external validation, download the selected GSE213216 samples into `data/external/GSE213216/` and run
   `scripts/02_external_prep/02_external_validation_prep.R`.
5. Run the Python notebook (Google Colab) on the exported files.

## References

- Tan Y, et al. Single-cell analysis of endometriosis reveals a coordinated transcriptional programme driving immunotolerance and angiogenesis across eutopic and ectopic tissues. Nat Cell Biol. 2022.
- Fonseca MAS, et al. Single-cell transcriptomic analysis of endometriosis. Nat Genet. 2023.
