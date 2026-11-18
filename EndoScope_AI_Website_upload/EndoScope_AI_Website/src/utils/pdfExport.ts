import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { GeneAnalysisDossier } from '../types/dossier';

const ROSE_DARK: [number, number, number] = [190, 24, 93]; // #BE185D
const ROSE_ACCENT: [number, number, number] = [219, 39, 119]; // #DB2777
const ROSE_LIGHT_BG: [number, number, number] = [253, 242, 248]; // #FDF2F8
const ROSE_BORDER: [number, number, number] = [249, 168, 212]; // #F9A8D4
const SLATE_TEXT: [number, number, number] = [30, 41, 59];
const MUTED_TEXT: [number, number, number] = [100, 116, 139];

function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function addPageFooters(doc: jsPDF, title: string) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_TEXT);
    doc.text(`EndoScope Ai · ${title}`, 14, pageHeight - 9);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 9, { align: 'right' });
  }
}

function ensureSpace(doc: jsPDF, currentY: number, neededHeight: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + neededHeight > pageHeight - 22) {
    doc.addPage();
    return 18;
  }
  return currentY;
}

function getLastTableY(doc: jsPDF, fallbackY: number): number {
  const withTable = doc as jsPDF & { lastAutoTable?: { finalY?: number } };
  return withTable.lastAutoTable?.finalY ?? fallbackY;
}

/**
 * High-DPI Canvas-to-PDF renderer when dossier narrative is in Arabic so RTL Arabic glyphs
 * render cleanly without missing glyph boxes in standard PDF Helvetica fonts.
 */
function exportArabicDossierToPdf(dossier: GeneAnalysisDossier) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 1240;
  const pageH = 1754; // A4 proportion at ~150 DPI
  const margin = 76;
  const contentW = pageW - margin * 2;

  const pages: HTMLCanvasElement[] = [];
  let canvas = document.createElement('canvas');
  canvas.width = pageW;
  canvas.height = pageH;
  let ctx = canvas.getContext('2d')!;

  const initPage = () => {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, pageW, pageH);
    ctx.fillStyle = '#DB2777';
    ctx.fillRect(0, 0, pageW, 14);
    ctx.fillStyle = '#64748B';
    ctx.font = '600 18px "IBM Plex Sans", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('EndoScope Ai — Endometriosis Computational Pathology Report', margin, 52);
  };

  initPage();
  let y = 96;

  const newPage = () => {
    pages.push(canvas);
    canvas = document.createElement('canvas');
    canvas.width = pageW;
    canvas.height = pageH;
    ctx = canvas.getContext('2d')!;
    initPage();
    y = 92;
  };

  const drawWrappedText = (
    text: string,
    opts: {
      font: string;
      color: string;
      lineHeight: number;
      align?: 'left' | 'right';
      rtl?: boolean;
      indent?: number;
    }
  ) => {
    ctx.font = opts.font;
    ctx.fillStyle = opts.color;
    const align = opts.align ?? (opts.rtl ? 'right' : 'left');
    ctx.textAlign = align;
    const maxW = contentW - (opts.indent ?? 0);
    const words = text.split(/\s+/);
    let line = '';
    const lines: string[] = [];

    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);

    for (const l of lines) {
      if (y + opts.lineHeight > pageH - 80) {
        newPage();
        ctx.font = opts.font;
        ctx.fillStyle = opts.color;
        ctx.textAlign = align;
      }
      const x = align === 'right' ? pageW - margin - (opts.indent ?? 0) : margin + (opts.indent ?? 0);
      ctx.fillText(l, x, y);
      y += opts.lineHeight;
    }
  };

  const drawSectionHeader = (title: string) => {
    if (y + 90 > pageH - 80) newPage();
    y += 14;
    ctx.fillStyle = '#FDF2F8';
    ctx.fillRect(margin, y - 32, contentW, 44);
    ctx.fillStyle = '#BE185D';
    ctx.fillRect(pageW - margin - 6, y - 32, 6, 44);
    ctx.font = '700 24px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillStyle = '#831843';
    ctx.textAlign = containsArabic(title) ? 'right' : 'left';
    ctx.fillText(title, containsArabic(title) ? pageW - margin - 18 : margin + 14, y - 2);
    y += 32;
  };

  // Title block
  ctx.textAlign = 'left';
  ctx.font = '700 38px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.fillStyle = '#BE185D';
  ctx.fillText(`${dossier.geneSymbol}`, margin, y);
  const symW = ctx.measureText(`${dossier.geneSymbol}  `).width;
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 28px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.fillText(`— ${dossier.fullName}`, margin + symW, y);
  y += 38;

  ctx.font = '500 18px "IBM Plex Sans", Arial, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText(
    `${dossier.lesionCompartment}  |  Ectopic log2FC: ${dossier.summaryMetrics.ectopicLog2FC >= 0 ? '+' : ''}${dossier.summaryMetrics.ectopicLog2FC.toFixed(2)}  |  Mean |SHAP|: ${dossier.summaryMetrics.meanAbsShap.toFixed(3)}`,
    margin,
    y
  );
  y += 34;

  drawWrappedText(dossier.executiveSummary, {
    font: '400 20px "IBM Plex Sans", Arial, sans-serif',
    color: '#1E293B',
    lineHeight: 30,
    rtl: containsArabic(dossier.executiveSummary),
  });

  // Modules
  const { modules } = dossier;

  drawSectionHeader('01. خريطة الخلايا (Cell Atlas Integration)');
  drawWrappedText(modules.cellAtlas.overview, {
    font: '400 19px "IBM Plex Sans", Arial, sans-serif',
    color: '#1E293B',
    lineHeight: 28,
    rtl: containsArabic(modules.cellAtlas.overview),
  });
  y += 8;
  modules.cellAtlas.populations.forEach((p) => {
    drawWrappedText(
      `• ${p.cellType} (${p.status ?? 'Altered'}) — Perturbation: ${p.perturbationScore.toFixed(1)}, Shift: ${p.abundanceDeltaPct >= 0 ? '+' : ''}${p.abundanceDeltaPct.toFixed(1)}% | ${p.dysregulationSummary}`,
      {
        font: '400 17px "IBM Plex Sans", Arial, sans-serif',
        color: '#334155',
        lineHeight: 25,
        rtl: containsArabic(p.dysregulationSummary),
        indent: 14,
      }
    );
  });

  drawSectionHeader('02. بحث الجينات (Gene Explorer)');
  drawWrappedText(modules.geneExplorer.tissueComparisonNarrative, {
    font: '400 19px "IBM Plex Sans", Arial, sans-serif',
    color: '#1E293B',
    lineHeight: 28,
    rtl: containsArabic(modules.geneExplorer.tissueComparisonNarrative),
  });
  y += 8;
  modules.geneExplorer.expressionProfiles.forEach((ep) => {
    drawWrappedText(
      `${ep.cellType}: Healthy ${ep.healthyCpm.toFixed(2)} | Eutopic ${ep.eutopicCpm.toFixed(2)} | Ectopic ${ep.ectopicCpm.toFixed(2)} (log2FC ${ep.log2FoldChange >= 0 ? '+' : ''}${ep.log2FoldChange.toFixed(2)}, adj.P ${ep.adjustedPValue})`,
      {
        font: '500 17px "JetBrains Mono", monospace',
        color: '#334155',
        lineHeight: 25,
        align: 'left',
        indent: 14,
      }
    );
  });

  drawSectionHeader('03. المسارات الحيوية (Biological Pathways)');
  drawWrappedText(modules.pathways.overview, {
    font: '400 19px "IBM Plex Sans", Arial, sans-serif',
    color: '#1E293B',
    lineHeight: 28,
    rtl: containsArabic(modules.pathways.overview),
  });
  y += 8;
  modules.pathways.enrichmentResults.forEach((er) => {
    drawWrappedText(
      `• ${er.pathwayName} [${er.direction}, NES ${er.nesScore >= 0 ? '+' : ''}${er.nesScore.toFixed(2)}]: ${er.mechanisticRole}`,
      {
        font: '400 17px "IBM Plex Sans", Arial, sans-serif',
        color: '#334155',
        lineHeight: 25,
        rtl: containsArabic(er.mechanisticRole),
        indent: 14,
      }
    );
  });

  drawSectionHeader('04. تواصل الخلايا (Cell-Cell Communication)');
  drawWrappedText(modules.cellCommunication.overview, {
    font: '400 19px "IBM Plex Sans", Arial, sans-serif',
    color: '#1E293B',
    lineHeight: 28,
    rtl: containsArabic(modules.cellCommunication.overview),
  });
  y += 8;
  modules.cellCommunication.interactions.forEach((edge) => {
    drawWrappedText(
      `• ${edge.senderCell} [${edge.ligand} → ${edge.receptor}] ${edge.receiverCell} (w=${edge.interactionWeight.toFixed(2)}): ${edge.pathologicalEffect}`,
      {
        font: '400 17px "IBM Plex Sans", Arial, sans-serif',
        color: '#334155',
        lineHeight: 25,
        rtl: containsArabic(edge.pathologicalEffect),
        indent: 14,
      }
    );
  });

  drawSectionHeader('05. الذكاء الاصطناعي القابل للتفسير وفرضية المعمل (Explainable ML)');
  drawWrappedText(modules.explainableMl.shapRationale, {
    font: '400 19px "IBM Plex Sans", Arial, sans-serif',
    color: '#1E293B',
    lineHeight: 28,
    rtl: containsArabic(modules.explainableMl.shapRationale),
  });
  y += 8;
  (modules.explainableMl.candidateGenes ?? []).forEach((cg) => {
    drawWrappedText(
      `#${cg.rank} ${cg.geneSymbol} (SHAP ${cg.shapScore.toFixed(3)}, ${cg.predictedDirection}): ${cg.selectionRationale}`,
      {
        font: '400 17px "IBM Plex Sans", Arial, sans-serif',
        color: '#334155',
        lineHeight: 25,
        rtl: containsArabic(cg.selectionRationale),
        indent: 14,
      }
    );
  });

  y += 12;
  drawWrappedText(modules.explainableMl.hypothesis.title, {
    font: '700 20px "IBM Plex Sans", Arial, sans-serif',
    color: '#BE185D',
    lineHeight: 28,
    rtl: containsArabic(modules.explainableMl.hypothesis.title),
  });
  drawWrappedText(modules.explainableMl.hypothesis.testableStatement, {
    font: '400 18px "IBM Plex Sans", Arial, sans-serif',
    color: '#0F172A',
    lineHeight: 26,
    rtl: containsArabic(modules.explainableMl.hypothesis.testableStatement),
  });
  drawWrappedText(
    `${modules.explainableMl.hypothesis.targetModelSystem} — ${modules.explainableMl.hypothesis.experimentalAssay}`,
    {
      font: '400 17px "IBM Plex Sans", Arial, sans-serif',
      color: '#334155',
      lineHeight: 25,
      rtl: containsArabic(modules.explainableMl.hypothesis.experimentalAssay),
    }
  );
  drawWrappedText(modules.explainableMl.hypothesis.expectedOutcome, {
    font: '400 17px "IBM Plex Sans", Arial, sans-serif',
    color: '#334155',
    lineHeight: 25,
    rtl: containsArabic(modules.explainableMl.hypothesis.expectedOutcome),
  });

  pages.push(canvas);

  pages.forEach((pg, idx) => {
    if (idx > 0) doc.addPage();
    const imgData = pg.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', 0, 0, 210, 297);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_TEXT);
    doc.text(`EndoScope Ai · ${dossier.geneSymbol} Report`, 14, 291);
    doc.text(`Page ${idx + 1} of ${pages.length}`, 196, 291, { align: 'right' });
  });

  const safeSymbol = dossier.geneSymbol.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  doc.save(`endoscope_ai_${safeSymbol}_report.pdf`);
}

function appendDossierSectionsToDoc(doc: jsPDF, dossier: GeneAnalysisDossier, startY: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - 28;
  const { summaryMetrics, modules } = dossier;

  let y = startY;

  // Title Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...ROSE_DARK);
  doc.text(dossier.geneSymbol, 14, y);
  const symbolWidth = doc.getTextWidth(`${dossier.geneSymbol} `);
  doc.setTextColor(...SLATE_TEXT);
  doc.setFontSize(15);
  const titleLines = doc.splitTextToSize(`— ${dossier.fullName}`, contentWidth - symbolWidth);
  doc.text(titleLines, 14 + symbolWidth, y);
  y += Math.max(8, titleLines.length * 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED_TEXT);
  doc.text(
    `Compartment: ${dossier.lesionCompartment}   |   Query: ${dossier.query}   |   Generated: ${new Date(
      dossier.createdAt
    ).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`,
    14,
    y
  );
  y += 6;

  // Executive Summary Box
  const execLines = doc.splitTextToSize(dossier.executiveSummary, contentWidth - 10);
  const execBoxH = execLines.length * 4.8 + 10;
  y = ensureSpace(doc, y, execBoxH + 6);
  doc.setFillColor(...ROSE_LIGHT_BG);
  doc.setDrawColor(...ROSE_BORDER);
  doc.roundedRect(14, y, contentWidth, execBoxH, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...ROSE_DARK);
  doc.text('EXECUTIVE ABSTRACT', 18, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...SLATE_TEXT);
  doc.text(execLines, 18, y + 11);
  y += execBoxH + 6;

  // Quantitative Summary Table
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Metric', 'Value', 'Metric', 'Value']],
    body: [
      [
        'Overall Directionality',
        summaryMetrics.overallDirection,
        'Ectopic vs. Healthy log2FC',
        `${summaryMetrics.ectopicLog2FC >= 0 ? '+' : ''}${summaryMetrics.ectopicLog2FC.toFixed(2)}`,
      ],
      [
        'Primary Cell Lineage',
        summaryMetrics.primaryCellPopulation,
        'Top Enriched Hallmark',
        summaryMetrics.topPathway,
      ],
      [
        'ML Priority Rank',
        summaryMetrics.mlFeatureRank,
        'Mean |SHAP| Attribution',
        summaryMetrics.meanAbsShap.toFixed(3),
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: ROSE_DARK, textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    styles: { fontSize: 8.5, textColor: SLATE_TEXT, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: ROSE_LIGHT_BG },
      2: { fontStyle: 'bold', fillColor: ROSE_LIGHT_BG },
    },
  });
  y = getLastTableY(doc, y + 30) + 8;

  const drawSectionBanner = (label: string) => {
    y = ensureSpace(doc, y, 24);
    doc.setFillColor(...ROSE_ACCENT);
    doc.rect(14, y, 2.2, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...ROSE_DARK);
    doc.text(label, 19, y + 5.2);
    y += 11;
  };

  const drawProse = (text: string) => {
    const lines = doc.splitTextToSize(text, contentWidth);
    y = ensureSpace(doc, y, lines.length * 4.6 + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...SLATE_TEXT);
    doc.text(lines, 14, y);
    y += lines.length * 4.6 + 4;
  };

  const drawBullets = (items: string[]) => {
    items.forEach((item) => {
      const lines = doc.splitTextToSize(`• ${item}`, contentWidth - 4);
      y = ensureSpace(doc, y, lines.length * 4.4 + 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...SLATE_TEXT);
      doc.text(lines, 16, y);
      y += lines.length * 4.4 + 1.5;
    });
    y += 3;
  };

  // Module 01
  drawSectionBanner('01. Cell Atlas Integration');
  drawProse(modules.cellAtlas.overview);
  drawBullets(modules.cellAtlas.keyFindings);
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Cell Population', 'Lineage', 'Status', 'Perturbation', 'Delta %', 'Dysregulation Summary']],
    body: modules.cellAtlas.populations.map((p) => [
      p.cellType,
      p.lineage,
      p.status ?? 'Altered',
      p.perturbationScore.toFixed(1),
      `${p.abundanceDeltaPct >= 0 ? '+' : ''}${p.abundanceDeltaPct.toFixed(1)}%`,
      p.dysregulationSummary,
    ]),
    theme: 'striped',
    headStyles: { fillColor: ROSE_DARK, textColor: 255, fontSize: 8 },
    styles: { fontSize: 8, textColor: SLATE_TEXT, cellPadding: 2.2 },
  });
  y = getLastTableY(doc, y + 30) + 8;

  // Module 02
  drawSectionBanner('02. Gene Explorer (Healthy vs. Eutopic vs. Ectopic)');
  drawProse(modules.geneExplorer.overview);
  drawProse(modules.geneExplorer.tissueComparisonNarrative);
  drawBullets(modules.geneExplorer.transcriptomicTrends);
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Cell Type', 'Healthy', 'Eutopic', 'Ectopic', 'log2FC', 'adj. P']],
    body: modules.geneExplorer.expressionProfiles.map((ep) => [
      ep.cellType,
      ep.healthyCpm.toFixed(2),
      ep.eutopicCpm.toFixed(2),
      ep.ectopicCpm.toFixed(2),
      `${ep.log2FoldChange >= 0 ? '+' : ''}${ep.log2FoldChange.toFixed(2)}`,
      ep.adjustedPValue,
    ]),
    theme: 'striped',
    headStyles: { fillColor: ROSE_DARK, textColor: 255, fontSize: 8 },
    styles: { fontSize: 8, textColor: SLATE_TEXT, cellPadding: 2.2 },
  });
  y = getLastTableY(doc, y + 30) + 8;

  // Module 03
  drawSectionBanner('03. Biological Pathways & Functional Enrichment');
  drawProse(modules.pathways.overview);
  drawBullets(modules.pathways.keyMechanisms);
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Pathway', 'Category', 'NES', '-log10(FDR)', 'State', 'Mechanistic Role']],
    body: modules.pathways.enrichmentResults.map((er) => [
      er.pathwayName,
      er.category,
      `${er.nesScore >= 0 ? '+' : ''}${er.nesScore.toFixed(2)}`,
      er.negLog10Fdr.toFixed(2),
      er.direction,
      er.mechanisticRole,
    ]),
    theme: 'striped',
    headStyles: { fillColor: ROSE_DARK, textColor: 255, fontSize: 8 },
    styles: { fontSize: 8, textColor: SLATE_TEXT, cellPadding: 2.2 },
  });
  y = getLastTableY(doc, y + 30) + 8;

  // Module 04
  drawSectionBanner('04. Cell-Cell Communication & Ligand-Receptor Interactions');
  drawProse(modules.cellCommunication.overview);
  drawBullets(modules.cellCommunication.crosstalkMechanisms);
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Sender', 'Ligand → Receptor', 'Receiver', 'Weight', 'Signaling Axis', 'Pathological Effect']],
    body: modules.cellCommunication.interactions.map((edge) => [
      edge.senderCell,
      `${edge.ligand} → ${edge.receptor}`,
      edge.receiverCell,
      edge.interactionWeight.toFixed(2),
      edge.signalingAxis,
      edge.pathologicalEffect,
    ]),
    theme: 'striped',
    headStyles: { fillColor: ROSE_DARK, textColor: 255, fontSize: 8 },
    styles: { fontSize: 8, textColor: SLATE_TEXT, cellPadding: 2.2 },
  });
  y = getLastTableY(doc, y + 30) + 8;

  // Module 05
  drawSectionBanner('05. Explainable ML & Wet-Lab Hypothesis');
  drawProse(modules.explainableMl.overview);
  if (typeof modules.explainableMl.predictedExpressionScore === 'number') {
    drawProse(
      `ML Predicted Disease Association: ${modules.explainableMl.predictedExpressionScore.toFixed(1)}% — ${modules.explainableMl.predictedExpressionSummary ?? ''}`
    );
  }
  drawProse(`Model Context: ${modules.explainableMl.modelContext}. ${modules.explainableMl.shapRationale}`);

  if (modules.explainableMl.candidateGenes && modules.explainableMl.candidateGenes.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Rank', 'Candidate Gene', 'SHAP', 'Direction', 'Model Selection Rationale']],
      body: modules.explainableMl.candidateGenes.map((cg) => [
        `#${cg.rank}`,
        cg.geneSymbol,
        cg.shapScore.toFixed(3),
        cg.predictedDirection,
        cg.selectionRationale,
      ]),
      theme: 'striped',
      headStyles: { fillColor: ROSE_DARK, textColor: 255, fontSize: 8 },
      styles: { fontSize: 8, textColor: SLATE_TEXT, cellPadding: 2.2 },
    });
    y = getLastTableY(doc, y + 25) + 6;
  }

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['SHAP Feature', 'Impact (log-odds)', 'Direction', 'Biological Interpretation']],
    body: modules.explainableMl.shapContributions.map((sc) => [
      sc.featureName,
      `${sc.shapImpact >= 0 ? '+' : ''}${sc.shapImpact.toFixed(3)}`,
      sc.direction,
      sc.biologicalInterpretation,
    ]),
    theme: 'striped',
    headStyles: { fillColor: ROSE_DARK, textColor: 255, fontSize: 8 },
    styles: { fontSize: 8, textColor: SLATE_TEXT, cellPadding: 2.2 },
  });
  y = getLastTableY(doc, y + 25) + 8;

  // Wet-Lab Protocol Box
  const hyp = modules.explainableMl.hypothesis;
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [[`Actionable Wet-Lab Experimental Protocol: ${hyp.title}`]],
    body: [
      [`Testable Statement: ${hyp.testableStatement}`],
      [`Target Model System: ${hyp.targetModelSystem}`],
      [`Experimental Assay: ${hyp.experimentalAssay}`],
      [`Primary Readouts: ${hyp.primaryReadouts.join(' · ')}`],
      [`Expected Outcome: ${hyp.expectedOutcome}`],
    ],
    theme: 'grid',
    headStyles: { fillColor: ROSE_ACCENT, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    styles: { fontSize: 8.5, textColor: SLATE_TEXT, fillColor: ROSE_LIGHT_BG, cellPadding: 3 },
  });

  return getLastTableY(doc, y + 40);
}

export function exportDossierToPdf(dossier: GeneAnalysisDossier): void {
  if (
    dossier.language === 'ar' ||
    containsArabic(dossier.executiveSummary) ||
    containsArabic(dossier.modules.cellAtlas.overview)
  ) {
    exportArabicDossierToPdf(dossier);
    return;
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Top rose masthead strip
  doc.setFillColor(...ROSE_ACCENT);
  doc.rect(0, 0, pageWidth, 4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...ROSE_ACCENT);
  doc.text('ENDOSCOPE AI  ·  ENDOMETRIOSIS COMPUTATIONAL PATHOLOGY DOSSIER', 14, 13);

  appendDossierSectionsToDoc(doc, dossier, 22);
  addPageFooters(doc, `${dossier.geneSymbol} Computational Pathology Report`);

  const safeSymbol = dossier.geneSymbol.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  doc.save(`endoscope_ai_${safeSymbol}_report.pdf`);
}

export function exportComparisonToPdf(
  primary: GeneAnalysisDossier,
  secondary: GeneAnalysisDossier
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...ROSE_ACCENT);
  doc.rect(0, 0, pageWidth, 4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...ROSE_ACCENT);
  doc.text('ENDOSCOPE AI  ·  COMPARATIVE TRANSCRIPTOMIC REPORT', 14, 13);

  doc.setFontSize(18);
  doc.setTextColor(...SLATE_TEXT);
  doc.text(`${primary.geneSymbol} vs. ${secondary.geneSymbol}`, 14, 23);

  autoTable(doc, {
    startY: 29,
    margin: { left: 14, right: 14 },
    head: [['Dimension', primary.geneSymbol, secondary.geneSymbol]],
    body: [
      ['Full Name', primary.fullName, secondary.fullName],
      ['Compartment', primary.lesionCompartment, secondary.lesionCompartment],
      [
        'Ectopic log2FC',
        `${primary.summaryMetrics.ectopicLog2FC >= 0 ? '+' : ''}${primary.summaryMetrics.ectopicLog2FC.toFixed(2)} (${primary.summaryMetrics.overallDirection})`,
        `${secondary.summaryMetrics.ectopicLog2FC >= 0 ? '+' : ''}${secondary.summaryMetrics.ectopicLog2FC.toFixed(2)} (${secondary.summaryMetrics.overallDirection})`,
      ],
      [
        'Primary Cell Type',
        primary.summaryMetrics.primaryCellPopulation,
        secondary.summaryMetrics.primaryCellPopulation,
      ],
      ['Top Pathway', primary.summaryMetrics.topPathway, secondary.summaryMetrics.topPathway],
      [
        'ML Rank & |SHAP|',
        `${primary.summaryMetrics.meanAbsShap.toFixed(3)} · ${primary.summaryMetrics.mlFeatureRank}`,
        `${secondary.summaryMetrics.meanAbsShap.toFixed(3)} · ${secondary.summaryMetrics.mlFeatureRank}`,
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: ROSE_DARK, textColor: 255, fontSize: 8.5 },
    styles: { fontSize: 8.5, textColor: SLATE_TEXT, cellPadding: 2.5 },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: ROSE_LIGHT_BG } },
  });

  if (
    primary.language !== 'ar' &&
    secondary.language !== 'ar' &&
    !containsArabic(primary.executiveSummary) &&
    !containsArabic(secondary.executiveSummary)
  ) {
    doc.addPage();
    appendDossierSectionsToDoc(doc, primary, 18);
    doc.addPage();
    appendDossierSectionsToDoc(doc, secondary, 18);
  }

  addPageFooters(doc, `${primary.geneSymbol} vs. ${secondary.geneSymbol}`);
  const f1 = primary.geneSymbol.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const f2 = secondary.geneSymbol.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  doc.save(`endoscope_ai_${f1}_vs_${f2}_comparison.pdf`);
}
