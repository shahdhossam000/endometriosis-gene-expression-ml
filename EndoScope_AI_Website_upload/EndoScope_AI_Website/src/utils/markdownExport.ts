import type { GeneAnalysisDossier } from '../types/dossier';

export function serializeDossierToMarkdown(dossier: GeneAnalysisDossier): string {
  const { summaryMetrics, modules } = dossier;
  const lines: string[] = [];

  lines.push(`# ${dossier.geneSymbol} — ${dossier.fullName}`);
  lines.push('');
  lines.push(
    `**Compartment Focus:** ${dossier.lesionCompartment} · **Query:** \`${dossier.query}\` · **Generated:** ${new Date(dossier.createdAt).toUTCString()}`
  );
  lines.push('');
  lines.push('## Executive Abstract');
  lines.push('');
  lines.push(dossier.executiveSummary);
  lines.push('');
  lines.push('## Quantitative Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('| :--- | :--- |');
  lines.push(`| Overall Directionality | ${summaryMetrics.overallDirection} |`);
  lines.push(`| Ectopic vs. Healthy log2FC | ${summaryMetrics.ectopicLog2FC >= 0 ? '+' : ''}${summaryMetrics.ectopicLog2FC.toFixed(2)} |`);
  lines.push(`| Primary Expressing Population | ${summaryMetrics.primaryCellPopulation} |`);
  lines.push(`| Top Enriched Hallmark | ${summaryMetrics.topPathway} |`);
  lines.push(`| ML Priority Rank | ${summaryMetrics.mlFeatureRank} |`);
  lines.push(`| Mean |SHAP| Attribution | ${summaryMetrics.meanAbsShap.toFixed(3)} |`);
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('## 01. Cell Atlas Integration');
  lines.push('');
  lines.push(modules.cellAtlas.overview);
  lines.push('');
  lines.push('### Key Microenvironment Findings');
  modules.cellAtlas.keyFindings.forEach((finding) => {
    lines.push(`- ${finding}`);
  });
  lines.push('');
  lines.push('| Cell Type | Lineage | Disease Status | Perturbation Index | Abundance Delta | Dysregulation Summary |');
  lines.push('| :--- | :--- | :--- | ---: | ---: | :--- |');
  modules.cellAtlas.populations.forEach((p) => {
    const delta = `${p.abundanceDeltaPct >= 0 ? '+' : ''}${p.abundanceDeltaPct.toFixed(1)}%`;
    lines.push(`| ${p.cellType} | ${p.lineage} | ${p.status ?? 'Altered'} | ${p.perturbationScore.toFixed(1)} | ${delta} | ${p.dysregulationSummary} |`);
  });
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('## 02. Gene Explorer');
  lines.push('');
  lines.push(modules.geneExplorer.overview);
  lines.push('');
  lines.push('### Healthy vs. Eutopic vs. Ectopic Lesion Comparison');
  lines.push('');
  lines.push(modules.geneExplorer.tissueComparisonNarrative);
  lines.push('');
  modules.geneExplorer.transcriptomicTrends.forEach((trend) => {
    lines.push(`- ${trend}`);
  });
  lines.push('');
  lines.push('| Cell Population | Healthy (log2 CPM) | Eutopic (log2 CPM) | Ectopic (log2 CPM) | Ectopic log2FC | Adj. P-Value |');
  lines.push('| :--- | ---: | ---: | ---: | ---: | ---: |');
  modules.geneExplorer.expressionProfiles.forEach((ep) => {
    lines.push(
      `| ${ep.cellType} | ${ep.healthyCpm.toFixed(2)} | ${ep.eutopicCpm.toFixed(2)} | ${ep.ectopicCpm.toFixed(2)} | ${ep.log2FoldChange >= 0 ? '+' : ''}${ep.log2FoldChange.toFixed(2)} | ${ep.adjustedPValue} |`
    );
  });
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('## 03. Biological Pathways & Functional Enrichment');
  lines.push('');
  lines.push(modules.pathways.overview);
  lines.push('');
  modules.pathways.keyMechanisms.forEach((mech) => {
    lines.push(`- ${mech}`);
  });
  lines.push('');
  lines.push('| Pathway | Category | NES | -log10(FDR) | State | Mechanistic Role |');
  lines.push('| :--- | :--- | ---: | ---: | :--- | :--- |');
  modules.pathways.enrichmentResults.forEach((er) => {
    lines.push(
      `| ${er.pathwayName} | ${er.category} | ${er.nesScore >= 0 ? '+' : ''}${er.nesScore.toFixed(2)} | ${er.negLog10Fdr.toFixed(2)} | ${er.direction} | ${er.mechanisticRole} |`
    );
  });
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('## 04. Cell-Cell Communication & Ligand-Receptor Interactions');
  lines.push('');
  lines.push(modules.cellCommunication.overview);
  lines.push('');
  modules.cellCommunication.crosstalkMechanisms.forEach((cm) => {
    lines.push(`- ${cm}`);
  });
  lines.push('');
  lines.push('| Sender Cell | Ligand | Receptor | Receiver Cell | Weight | Signaling Axis | Pathological Effect |');
  lines.push('| :--- | :--- | :--- | :--- | ---: | :--- | :--- |');
  modules.cellCommunication.interactions.forEach((edge) => {
    lines.push(
      `| ${edge.senderCell} | ${edge.ligand} | ${edge.receptor} | ${edge.receiverCell} | ${edge.interactionWeight.toFixed(2)} | ${edge.signalingAxis} | ${edge.pathologicalEffect} |`
    );
  });
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('## 05. Explainable ML & Hypothesis Generation');
  lines.push('');
  lines.push(modules.explainableMl.overview);
  lines.push('');
  if (typeof modules.explainableMl.predictedExpressionScore === 'number') {
    lines.push(
      `**Predicted Disease Association Score:** ${modules.explainableMl.predictedExpressionScore.toFixed(1)}% — ${modules.explainableMl.predictedExpressionSummary ?? ''}`
    );
    lines.push('');
  }
  if (modules.explainableMl.candidateGenes && modules.explainableMl.candidateGenes.length > 0) {
    lines.push('### Ranked Candidate Genes for Study');
    lines.push('');
    lines.push('| Rank | Gene Symbol | SHAP Importance | Predicted Direction | Selection Rationale |');
    lines.push('| ---: | :--- | ---: | :--- | :--- |');
    modules.explainableMl.candidateGenes.forEach((cg) => {
      lines.push(
        `| #${cg.rank} | ${cg.geneSymbol} | ${cg.shapScore.toFixed(3)} | ${cg.predictedDirection} | ${cg.selectionRationale} |`
      );
    });
    lines.push('');
  }
  lines.push('### SHAP Feature Attribution Rationale');
  lines.push('');
  lines.push(`*Model Context:* ${modules.explainableMl.modelContext}`);
  lines.push('');
  lines.push(modules.explainableMl.shapRationale);
  lines.push('');
  lines.push('| Feature | SHAP Impact (log-odds) | Direction | Interpretation |');
  lines.push('| :--- | ---: | :--- | :--- |');
  modules.explainableMl.shapContributions.forEach((sc) => {
    lines.push(
      `| ${sc.featureName} | ${sc.shapImpact >= 0 ? '+' : ''}${sc.shapImpact.toFixed(3)} | ${sc.direction} | ${sc.biologicalInterpretation} |`
    );
  });
  lines.push('');
  lines.push('### Actionable Wet-Lab Hypothesis');
  lines.push('');
  lines.push(`**${modules.explainableMl.hypothesis.title}**`);
  lines.push('');
  lines.push(`- **Testable Statement:** ${modules.explainableMl.hypothesis.testableStatement}`);
  lines.push(`- **Target Model System:** ${modules.explainableMl.hypothesis.targetModelSystem}`);
  lines.push(`- **Experimental Assay:** ${modules.explainableMl.hypothesis.experimentalAssay}`);
  lines.push(`- **Primary Readouts:** ${modules.explainableMl.hypothesis.primaryReadouts.join('; ')}`);
  lines.push(`- **Expected Outcome:** ${modules.explainableMl.hypothesis.expectedOutcome}`);
  lines.push('');

  return lines.join('\n');
}

export function serializeComparisonToMarkdown(
  primary: GeneAnalysisDossier,
  secondary: GeneAnalysisDossier
): string {
  const lines: string[] = [];
  lines.push(`# Comparative Endometriosis Dossier: ${primary.geneSymbol} vs. ${secondary.geneSymbol}`);
  lines.push('');
  lines.push(`Generated: ${new Date().toUTCString()}`);
  lines.push('');
  lines.push('| Dimension | ' + primary.geneSymbol + ' | ' + secondary.geneSymbol + ' |');
  lines.push('| :--- | :--- | :--- |');
  lines.push(`| Full Name | ${primary.fullName} | ${secondary.fullName} |`);
  lines.push(`| Compartment | ${primary.lesionCompartment} | ${secondary.lesionCompartment} |`);
  lines.push(`| Directionality | ${primary.summaryMetrics.overallDirection} | ${secondary.summaryMetrics.overallDirection} |`);
  lines.push(
    `| Ectopic log2FC | ${primary.summaryMetrics.ectopicLog2FC >= 0 ? '+' : ''}${primary.summaryMetrics.ectopicLog2FC.toFixed(2)} | ${secondary.summaryMetrics.ectopicLog2FC >= 0 ? '+' : ''}${secondary.summaryMetrics.ectopicLog2FC.toFixed(2)} |`
  );
  lines.push(
    `| Primary Cell Type | ${primary.summaryMetrics.primaryCellPopulation} | ${secondary.summaryMetrics.primaryCellPopulation} |`
  );
  lines.push(`| Top Pathway | ${primary.summaryMetrics.topPathway} | ${secondary.summaryMetrics.topPathway} |`);
  lines.push(`| ML Priority Rank | ${primary.summaryMetrics.mlFeatureRank} | ${secondary.summaryMetrics.mlFeatureRank} |`);
  lines.push(
    `| Mean |SHAP| | ${primary.summaryMetrics.meanAbsShap.toFixed(3)} | ${secondary.summaryMetrics.meanAbsShap.toFixed(3)} |`
  );
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(serializeDossierToMarkdown(primary));
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(serializeDossierToMarkdown(secondary));
  return lines.join('\n');
}

export function downloadMarkdownFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
