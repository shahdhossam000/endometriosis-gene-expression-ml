# Endometriosis Single-Cell Transcriptomic Analysis and Machine Learning

This project explores gene expression patterns and cellular changes associated with endometriosis using single-cell RNA sequencing (scRNA-seq) data. It combines transcriptomic analysis, pathway enrichment, cell-cell communication analysis, and machine learning approaches to investigate molecular differences across tissue types.

The project also includes **EndoScope AI**, an interactive web application developed to make the analysis results easier to explore and interpret.

## Data

The main dataset used in this project is:

- **GSE179640** – Single-cell RNA-seq dataset containing 104,343 cells and 27,722 genes from 14 individuals.
- **GSE213216** – An independent dataset used for external validation.

The analysis includes control and endometriosis-associated tissue samples, including ectopic lesions (EcP), eutopic endometrium (EuE), and other tissue types.

**Note:** EuE represents eutopic endometrium from patients with endometriosis, not healthy control tissue.

## Analysis Overview

The workflow includes:

- Quality control and preprocessing
- Normalization and dimensionality reduction
- Batch correction and clustering
- Cell type annotation
- Cell composition analysis
- Differential gene expression analysis
- GO and KEGG pathway enrichment
- Cell-cell communication analysis using CellChat
- Machine learning for gene-expression-related prediction
- Model interpretation using SHAP
- External validation using an independent dataset

## Main Results

### Differential Expression

A paired pseudobulk comparison of stromal cells between EcP and EuE samples identified **810 significantly differentially expressed genes**:

- 614 upregulated genes in EcP
- 196 downregulated genes in EcP

The comparison included eight patients with paired samples.

### Functional Enrichment

GO Biological Process analysis highlighted upregulated terms related to:

- Leukocyte migration and chemotaxis
- Myeloid leukocyte migration
- Extracellular matrix organization
- Regulation of vasculature development
- Angiogenesis

KEGG analysis identified 18 significantly enriched pathways among upregulated genes, including ECM-receptor interaction, cytokine-cytokine receptor interaction, calcium signaling, and leukocyte transendothelial migration.

No significantly enriched downregulated KEGG pathways were detected.

### Cell Composition

Patient-level paired comparisons of EcP and EuE showed differences in the proportions of some cell populations. However, no cell type remained statistically significant after multiple-testing correction.

### Cell-Cell Communication

CellChat was used to explore communication patterns between lymphocytes, myeloid cells, and stromal cells.

Although several interaction patterns were observed, no paired comparison remained statistically significant after Benjamini-Hochberg correction. These findings are therefore considered exploratory.

## Machine Learning

Machine learning models were developed to investigate gene-expression-related patterns in selected cell populations.

The workflow includes:

- Elastic Net
- Random Forest
- XGBoost
- Leave-One-Patient-Out (LOPO) validation
- External validation
- SHAP-based model interpretation

LYVE1 prediction was investigated in macrophages, with external validation using GSE213216.

A separate CCL19 detection model was developed in stromal cells. This model predicts whether CCL19 is detected in a cell (zero versus non-zero expression), rather than predicting its continuous expression level.

SHAP values were used to understand how features contribute to model predictions. They should not be interpreted as evidence of biological causality or direct gene regulation.

## EndoScope AI – Interactive Web Application

**Website:** https://endoscope-ai.ai.studio/

EndoScope AI is an interactive platform developed as part of this project to help users explore single-cell transcriptomic data and the resulting analyses.

The application provides access to:

- Gene Explorer
- Cell Atlas
- Differential Expression
- Pathway Analysis
- Cell-Cell Communication
- AI and Machine Learning Insights

The website presents analytical outputs in an accessible format, allowing users to explore gene expression, cell populations, and molecular findings.

## Limitations

- The main dataset contains a relatively limited number of individuals.
- EuE samples are derived from endometriosis patients and should not be treated as healthy controls.
- Cell composition and CellChat comparisons did not show statistically significant results after multiple-testing correction.
- Gene expression summaries aggregated across cells are descriptive and do not replace patient-level statistical analysis.
- External validation was performed for the LYVE1 model; the CCL19 model requires further independent validation.
- Machine learning predictions and SHAP explanations do not establish biological causality or clinical validity.

## Repository Structure

```text
endometriosis-gene-expression-ml/
│
├── data/
│
├── scripts/
│   └── 03_ml_python/
│
├── results/
│   ├── pathway_analysis/
│   └── ...
│
├── figures/
│
├── summary_and_results/
│
├── EndoScope_AI_Website/
│
└── README.md
```

## How to Run

The analysis scripts and notebooks are organized in the repository.

1. Clone or download the repository.
2. Install the required R and Python packages.
3. Download the datasets from GEO.
4. Run the analysis scripts in the appropriate order.
5. Explore the results and visualizations.

The interactive web application can also be accessed directly through the website link above.

## References

- GSE179640 – Gene Expression Omnibus.
- GSE213216 – Gene Expression Omnibus.
- Relevant publications associated with the datasets are available through the NCBI GEO records.
