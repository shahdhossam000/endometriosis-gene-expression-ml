# Endometriosis Single-Cell Transcriptomic Analysis and Machine Learning

### Integrating Single-Cell RNA-seq, Bioinformatics, and Machine Learning to Explore Endometriosis

**Interactive Research Platform: [EndoScope AI](https://endoscope-ai.ai.studio/)**

---

## Project Overview

This project investigates cellular heterogeneity, gene expression patterns, and molecular changes associated with endometriosis using single-cell RNA sequencing (scRNA-seq) data.

It integrates transcriptomic analysis, functional enrichment, cell–cell communication analysis, and machine learning approaches to explore molecular differences across endometriosis-associated tissue types.

A major focus of the project is understanding differences between ectopic and eutopic endometrial tissues, identifying potentially relevant cellular and molecular patterns, and investigating whether machine learning models can predict gene-expression-related signals in previously unseen patients.

The project also introduces **EndoScope AI**, an interactive research-support web application developed to make single-cell analysis workflows more accessible and help researchers explore, visualize, and interpret their data.

**Explore the web application:** https://endoscope-ai.ai.studio/

---

## Research Objectives

The main objectives of this project are to:

- Investigate cellular composition and gene expression patterns across endometriosis-associated tissues.
- Identify differentially expressed genes in selected cell populations.
- Explore biological pathways associated with transcriptomic changes.
- Investigate potential communication patterns between immune and stromal cell populations.
- Develop machine learning models to investigate gene-expression-related prediction in unseen patients.
- Evaluate model generalizability using patient-level validation and independent external data where available.
- Provide an interactive platform that supports researchers in exploring single-cell transcriptomic data.

---

## Datasets

The project uses two publicly available single-cell RNA-seq datasets:

### Main Dataset: GSE179640

- **Genes:** 27,722
- **Cells:** 104,343
- **Individuals:** 14
- **Source:** Gene Expression Omnibus (GEO)

The dataset includes control and endometriosis-associated tissue samples, covering multiple tissue types.

### External Validation Dataset: GSE213216

An independent dataset used for external validation of the LYVE1 machine learning model.

**Important tissue distinction:** EuE represents eutopic endometrium collected from patients with endometriosis. It is not healthy control tissue.

### Tissue Types

The analysis considers several tissue categories, including:

- **Ctrl:** Control tissue.
- **EcO:** Ovarian endometriosis.
- **EcP:** Peritoneal endometriosis / ectopic lesion.
- **EcPA:** Peritoneal endometriosis-associated tissue category.
- **EuE:** Eutopic endometrium from patients with endometriosis.

---

## Bioinformatics Analysis Workflow

The project combines several analytical stages to investigate the cellular and molecular landscape of endometriosis.

### 1. Quality Control and Preprocessing

Assess the quality of the single-cell dataset and prepare the expression data for downstream analysis.

### 2. Normalization and Dimensionality Reduction

Normalize gene expression data and explore cellular variation using dimensionality reduction approaches.

### 3. Batch Correction and Clustering

Address technical variation where appropriate and identify distinct cell populations based on their transcriptomic profiles.

### 4. Cell Type Annotation

Identify cellular populations using gene-expression patterns and marker genes.

### 5. Cell Composition Analysis

Compare the proportions of different cell populations across tissue types and patients.

### 6. Differential Gene Expression Analysis

Identify genes with significant expression differences between selected biological conditions.

### 7. Functional Enrichment Analysis

Investigate enriched biological processes and molecular pathways using:

- Gene Ontology (GO) Biological Process.
- KEGG pathway enrichment.

### 8. Cell–Cell Communication Analysis

Explore potential ligand–receptor interactions and communication patterns between cellular populations using CellChat.

### 9. Machine Learning

Develop predictive models to investigate gene-expression-related patterns, assess their ability to generalize to unseen patients, and interpret model predictions using SHAP.

---

## Main Results

### Differential Gene Expression

A paired pseudobulk comparison of stromal cells between EcP and EuE samples identified **810 significantly differentially expressed genes**.

- **614 genes** were upregulated in EcP.
- **196 genes** were downregulated in EcP.

The analysis included eight patients with paired EcP and EuE samples.

These findings suggest differences in stromal transcriptional activity between ectopic lesions and eutopic endometrium from patients with endometriosis.

### Functional Enrichment Analysis

GO Biological Process analysis highlighted upregulated biological processes associated with:

- Leukocyte migration and chemotaxis.
- Myeloid leukocyte migration.
- Extracellular matrix organization.
- Regulation of vasculature development.
- Angiogenesis.

KEGG analysis identified **18 significantly enriched pathways** among upregulated genes.

Notable pathways included:

- ECM–receptor interaction.
- Cytokine–cytokine receptor interaction.
- Calcium signaling.
- Leukocyte transendothelial migration.
- Complement and coagulation-related pathways.

No significantly enriched downregulated KEGG pathways were detected.

### Cell Composition Analysis

Patient-level paired comparisons of EcP and EuE showed descriptive differences in the proportions of some cell populations.

However, no cell type remained statistically significant after multiple-testing correction.

These results should therefore be interpreted as exploratory rather than evidence of statistically confirmed changes in cell abundance.

### Cell–Cell Communication Analysis

CellChat was used to investigate potential communication patterns between:

- Lymphocytes.
- Myeloid cells.
- Stromal cells.

Several interaction patterns were observed across the analyzed tissues.

However, no paired comparison remained statistically significant after Benjamini–Hochberg correction. The findings are therefore considered exploratory and require further investigation.

---

## Machine Learning and Predictive Modeling

The machine learning component investigates whether gene-expression-related signals can be predicted in cells from patients not included in model training.

Rather than relying only on random cell-level train/test splitting, the project uses patient-level validation to reduce information leakage between training and testing data.

### Machine Learning Models

The modeling workflow includes:

- Elastic Net.
- Random Forest.
- XGBoost.

### Validation Strategy

**Leave-One-Patient-Out (LOPO) Cross-Validation**

Each patient is held out in turn for testing while the remaining eligible patients are used for model training.

This strategy evaluates how well models generalize to unseen patients.

**External Validation**

An independent dataset, GSE213216, was used to evaluate the LYVE1 model beyond the original training dataset.

### LYVE1 Prediction

LYVE1-related prediction was investigated in macrophages.

The analysis focused on identifying gene-expression patterns associated with LYVE1 and evaluating their predictive performance across unseen patients.

External validation was performed using GSE213216.

### CCL19 Detection Prediction

A separate machine learning analysis investigated CCL19 detection in stromal cells.

The target was defined as:

- **Detected:** CCL19 expression greater than zero.
- **Not detected:** CCL19 expression equal to zero.

Therefore, this model predicts the presence or absence of CCL19 expression in individual cells, rather than predicting its continuous expression level.

### Model Interpretation with SHAP

SHAP was used to investigate the contribution of input features to model predictions.

This approach helps identify influential features and explore patterns learned by the models.

**Important:** SHAP values explain model behavior. They do not establish biological causality, direct gene regulation, or biological activation and inhibition.

---

## EndoScope AI – Interactive Single-Cell Research Platform

**Website:** https://endoscope-ai.ai.studio/

### Bringing Single-Cell Analysis into an Accessible Research Environment

EndoScope AI is an AI-powered research-support web application developed to help researchers, bioinformaticians, and life science students explore and analyze single-cell RNA sequencing data.

Single-cell transcriptomic analysis often involves several computational steps, specialized tools, and complex data interpretation.

EndoScope AI aims to bring essential analytical workflows together in one interactive environment, helping researchers move from data exploration and quality assessment to downstream analysis and biological interpretation.

The platform is designed to support scientific investigation, simplify access to analytical workflows, and make complex single-cell results easier to explore.

### What Does EndoScope AI Offer?

The platform brings together several analytical modules and research-oriented features.

#### 1. Quality Control (QC)

Supports the assessment of single-cell data quality before downstream analysis.

Researchers can investigate quality-related metrics and identify potential low-quality cells that may affect subsequent analyses.

#### 2. Normalization and Clustering

Supports data preparation and exploration of cellular heterogeneity.

This stage helps researchers investigate distinct cell populations and identify clusters with similar gene-expression profiles.

#### 3. Cell Annotation

Supports the exploration and identification of cell populations using gene-expression patterns and marker genes.

Cell annotation helps researchers assign biological identities to clusters and understand the cellular landscape of their datasets.

#### 4. Cell Atlas

Provides an overview of cellular populations and their distribution within the analyzed dataset.

It helps users explore different cell types and investigate the organization of the cellular ecosystem.

#### 5. Differential Gene Expression

Helps identify genes with different expression patterns between selected cell populations, tissues, or biological conditions.

This feature supports the investigation of candidate genes and molecular differences associated with specific biological contexts.

#### 6. Pathway Analysis

Supports the investigation of biological processes and molecular pathways associated with gene-expression changes.

Researchers can explore enriched pathways to gain additional biological context and generate new research questions.

#### 7. Cell Composition Analysis

Helps compare the distribution and proportions of different cell populations across samples or conditions.

This allows researchers to investigate changes in cellular composition and explore differences in the tissue microenvironment.

#### 8. Cell–Cell Communication Analysis

Supports the exploration of potential interactions between different cellular populations.

By investigating ligand–receptor relationships and communication patterns, researchers can explore how cells may interact within a tissue ecosystem.

#### 9. Gene Expression Explorer

Provides an interactive way to investigate selected genes across cell types and tissues.

Researchers can explore expression levels, compare cellular populations, and investigate genes relevant to their research questions.

#### 10. AI and Machine Learning Insights

Provides access to machine learning-related findings and model-based insights where supported by the selected analysis.

These approaches can help researchers investigate predictive patterns and explore features contributing to computational model predictions.

### Who Can Benefit from EndoScope AI?

EndoScope AI is designed for:

- Biomedical and life science researchers.
- Bioinformatics researchers and analysts.
- Students working on single-cell RNA-seq projects.
- Research teams studying cellular heterogeneity.
- Scientists investigating disease-associated gene expression.
- Researchers exploring cell–cell communication and tissue microenvironments.

### Applications Beyond Endometriosis

Although this project focuses on endometriosis, EndoScope AI is intended as a research-support platform for single-cell analysis beyond one specific disease.

Depending on dataset compatibility and workflow requirements, its analytical approaches may support research in:

- Cancer biology.
- Immunology.
- Reproductive biology.
- Inflammatory diseases.
- Tissue development.
- Cellular microenvironments.
- Other areas of single-cell transcriptomic research.

### Why EndoScope AI?

**Research-focused:** Designed around common analytical questions in single-cell research.

**Integrated workflows:** Brings multiple analysis stages into one interactive environment.

**Accessible exploration:** Helps users navigate complex transcriptomic datasets.

**Biological interpretation:** Supports the exploration of cellular and molecular patterns.

**Research flexibility:** Designed to support investigation across different datasets and biological conditions, subject to data compatibility.

### Research Tool, Not a Diagnostic System

EndoScope AI is intended to support research and computational exploration. It does not replace scientific judgment, expert review, experimental validation, or clinical diagnosis.

Analytical outputs should always be interpreted in the context of the dataset, study design, statistical assumptions, and biological background.

### Explore the Platform

Visit EndoScope AI and explore its available research and analytical features:

**https://endoscope-ai.ai.studio/**

---

## Limitations and Considerations

- The main dataset contains a relatively limited number of individuals compared with the number of cells.
- EuE samples are derived from patients with endometriosis and should not be interpreted as healthy controls.
- Cell composition comparisons did not identify statistically significant cell-type differences after multiple-testing correction.
- CellChat comparisons did not show statistically significant differences after Benjamini–Hochberg correction.
- Aggregated gene-expression summaries are descriptive and do not replace patient-level statistical analysis.
- External validation was performed for the LYVE1 model; the CCL19 model requires further independent validation.
- Machine learning predictions and SHAP explanations do not establish biological causality or clinical validity.
- Results depend on dataset quality, preprocessing choices, metadata accuracy, and analytical assumptions.

---

## Repository Structure

```text
endometriosis-gene-expression-ml/
│
├── data/
│
├── scripts/
│   ├── 01_r_pipeline/
│   ├── 02_external_prep/
│   ├── 03_ml_python/
│   ├── Additional_R_Analysis/
│   ├── Additional_Machine_Learning/
│   └── archive/
│
├── results/
│   ├── pathway_analysis/
│   ├── New_Analysis_Results/
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

---

## How to Run the Analysis

### 1. Clone the Repository

```bash
git clone https://github.com/shahdhossam000/endometriosis-gene-expression-ml.git
cd endometriosis-gene-expression-ml
```

### 2. Prepare the Data

Download the required datasets from the Gene Expression Omnibus:

- GSE179640
- GSE213216

Place the processed data in the appropriate project directories.

### 3. Install Dependencies

Install the required R and Python packages according to the scripts and notebooks used in each analysis stage.

### 4. Run the Analysis

Follow the scripts and notebooks in the appropriate directories.

The main R pipeline, external validation preparation, and Python machine learning workflows are organized separately.

### 5. Explore the Results

The generated results, tables, and figures are organized in the repository's results and figures directories.

### 6. Explore EndoScope AI

The interactive research platform is also available directly online:

https://endoscope-ai.ai.studio/

---

## Acknowledgment

This project brings together single-cell transcriptomic analysis, bioinformatics, and machine learning to investigate molecular patterns associated with endometriosis and support further research exploration.

---

## Founder & Developer

**EndoScope AI — Founded & Developed by Shahd Hossam**

**Explore Cells. Discover Patterns. Advance Research.**
