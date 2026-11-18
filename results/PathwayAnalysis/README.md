# Pathway Analysis

This directory contains the results of differential gene expression and functional enrichment analyses performed on stromal cells from endometriosis samples.

## 1. Differential Gene Expression Analysis

Differential expression analysis was performed using DESeq2 on pseudobulk data, comparing ectopic lesions (EcP) with eutopic endometrium (EuE).

The comparison included 8 patients with paired EcP and EuE samples.

### Main Results

- 810 significantly differentially expressed genes were identified.
- 614 genes were upregulated in EcP.
- 196 genes were downregulated in EcP.

### Output Files

- `Stromal_EcP_vs_EuE_all_genes.csv`
- `Stromal_EcP_vs_EuE_significant_genes.csv`

## 2. Gene Ontology (GO) Enrichment

GO Biological Process enrichment was performed separately for upregulated and downregulated genes.

### Upregulated Biological Processes

Enriched terms included:

- Leukocyte migration
- Myeloid leukocyte migration
- Regulation of vasculature development
- Angiogenesis
- Chemotaxis
- Extracellular matrix organization
- Extracellular structure organization
- Epithelial cell proliferation

### Downregulated Biological Processes

Only a small number of significant terms were identified. These results should be interpreted cautiously.

### Output Files

- `GO_BP_Upregulated_all.csv`
- `GO_BP_Downregulated_all.csv`
- `GO_BP_Upregulated_top20.csv`
- `GO_BP_Downregulated_top20.csv`

## 3. KEGG Pathway Enrichment

KEGG enrichment analysis identified 18 significant pathways among upregulated genes. No significant pathways were detected among downregulated genes.

### Notable Enriched Pathways

- ECM-receptor interaction
- Complement and coagulation cascades
- Calcium signaling pathway
- Cytokine-cytokine receptor interaction
- Integrin signaling
- NF-kappa B signaling pathway
- TNF signaling pathway
- Leukocyte transendothelial migration

### Output Files

- `KEGG_Upregulated_all.csv`
- `KEGG_Upregulated_top20.csv`
- `KEGG_Downregulated_all.csv`

## Interpretation

The enrichment results suggest that stromal cells in ectopic lesions show transcriptional changes involving extracellular matrix organization, immune-cell migration, inflammatory signaling, and vascular development.

These findings describe associations in the analyzed samples and do not establish causal mechanisms.

## Important Note

EuE represents eutopic endometrium from patients with endometriosis; it is not equivalent to healthy control tissue. Therefore, the EcP versus EuE comparison should be interpreted as a comparison between two tissue sites within endometriosis patients, rather than a direct comparison between healthy and diseased samples.
