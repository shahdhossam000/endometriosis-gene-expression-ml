import { useState, type FormEvent } from 'react';
import { ArrowRight, Loader2, FileDown } from 'lucide-react';
import type { AnalysisLanguage, GeneAnalysisDossier, LesionCompartment } from '../types/dossier';
import { UI_COPY } from '../utils/i18n';

interface CompareViewProps {
  dossiers: GeneAnalysisDossier[];
  language: AnalysisLanguage;
  primaryId: string | null;
  secondaryId: string | null;
  onSelectPrimary: (id: string) => void;
  onSelectSecondary: (id: string) => void;
  onRunSecondaryAnalysis: (query: string, compartment: LesionCompartment) => Promise<void>;
  isLoading: boolean;
  onOpenDossier: (dossier: GeneAnalysisDossier) => void;
  onExportComparisonPdf: (primary: GeneAnalysisDossier, secondary: GeneAnalysisDossier) => void;
}

export function CompareView({
  dossiers,
  language,
  primaryId,
  secondaryId,
  onSelectPrimary,
  onSelectSecondary,
  onRunSecondaryAnalysis,
  isLoading,
  onOpenDossier,
  onExportComparisonPdf,
}: CompareViewProps) {
  const [quickSymbol, setQuickSymbol] = useState('');
  const copy = UI_COPY[language];

  const primary = dossiers.find((d) => d.id === primaryId) ?? dossiers[0] ?? null;
  const secondary =
    dossiers.find((d) => d.id === secondaryId && d.id !== primary?.id) ??
    dossiers.find((d) => d.id !== primary?.id) ??
    null;

  const handleQuickAnalyze = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = quickSymbol.trim();
    if (trimmed.length < 2) return;
    await onRunSecondaryAnalysis(trimmed, primary?.lesionCompartment ?? 'All Compartments');
    setQuickSymbol('');
  };

  if (dossiers.length === 0) {
    return (
      <div className="mx-auto max-w-[1040px] px-6 py-12">
        <div className="rounded-md border border-[#311C33] bg-[#160D17] p-8 space-y-3">
          <h1 className="font-display text-2xl font-bold text-[#FAF2F7]">
            Side-by-Side Gene Comparison
          </h1>
          <p className="text-sm text-[#A98CA0] max-w-xl leading-relaxed">
            Run at least two gene or molecular mechanism analyses from the left research console to compare their single-cell expression deltas, enriched pathways, ligand–receptor crosstalk, and SHAP rankings side by side.
          </p>
        </div>
      </div>
    );
  }

  const primaryPathways = primary
    ? new Set(primary.modules.pathways.enrichmentResults.map((p) => p.pathwayName.toLowerCase()))
    : new Set<string>();
  const sharedPathways =
    primary && secondary
      ? secondary.modules.pathways.enrichmentResults.filter((p) =>
          primaryPathways.has(p.pathwayName.toLowerCase())
        )
      : [];

  return (
    <div className="mx-auto max-w-[1140px] px-6 py-8 space-y-8">
      <header className="space-y-4 border-b border-[#311C33] pb-6">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#FAF2F7]">
          Comparative Transcriptomic Analysis
        </h1>
        <p className="text-sm text-[#A98CA0] max-w-2xl">
          Contrast cellular specificity, ectopic log2 fold-change gradients, pathway enrichment convergence, and explainable ML feature priority across two analyzed targets.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="space-y-1.5">
            <label htmlFor="compare-slot-a" className="block text-xs font-mono text-[#F472B6]">
              Target A
            </label>
            <select
              id="compare-slot-a"
              value={primary?.id ?? ''}
              onChange={(e) => onSelectPrimary(e.target.value)}
              className="w-full rounded-md border border-[#311C33] bg-[#160D17] px-3 py-2 text-sm text-[#FAF2F7] focus:border-[#F472B6] focus:outline-none"
            >
              {dossiers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.geneSymbol} · {d.lesionCompartment}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="compare-slot-b" className="block text-xs font-mono text-[#FB7185]">
              Target B
            </label>
            <select
              id="compare-slot-b"
              value={secondary?.id ?? ''}
              onChange={(e) => onSelectSecondary(e.target.value)}
              disabled={dossiers.length < 2}
              className="w-full rounded-md border border-[#311C33] bg-[#160D17] px-3 py-2 text-sm text-[#FAF2F7] focus:border-[#F472B6] focus:outline-none disabled:opacity-50"
            >
              {dossiers.length < 2 ? (
                <option value="">Analyze a second gene to compare</option>
              ) : (
                dossiers
                  .filter((d) => d.id !== primary?.id)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.geneSymbol} · {d.lesionCompartment}
                    </option>
                  ))
              )}
            </select>
          </div>

          <form onSubmit={handleQuickAnalyze} className="space-y-1.5">
            <label htmlFor="compare-quick-add" className="block text-xs font-mono text-[#A98CA0]">
              Analyze New Gene for Target B
            </label>
            <div className="flex gap-2">
              <input
                id="compare-quick-add"
                type="text"
                value={quickSymbol}
                onChange={(e) => setQuickSymbol(e.target.value)}
                placeholder="e.g., VEGFA or CCL19"
                disabled={isLoading}
                className="min-w-0 flex-1 rounded-md border border-[#311C33] bg-[#160D17] px-3 py-2 font-mono text-sm text-[#FAF2F7] placeholder-[#7E6174] focus:border-[#F472B6] focus:outline-none"
              />
              <button
                type="submit"
                disabled={isLoading || quickSymbol.trim().length < 2}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#F472B6] px-3.5 py-2 text-xs font-semibold text-[#0B070B] hover:bg-[#F9A8D4] disabled:bg-[#311C33] disabled:text-[#7E6174] whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Compare</span>
              </button>
            </div>
          </form>
        </div>
      </header>

      {primary && secondary ? (
        <div className="space-y-8">
          <div className="overflow-x-auto rounded-md border border-[#311C33] bg-[#160D17]">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#311C33] bg-[#110A11]">
                  <th className="py-3 px-4 font-mono text-xs uppercase tracking-wider text-[#A98CA0]">
                    Analytical Dimension
                  </th>
                  <th className="py-3 px-4 font-mono text-sm font-semibold text-[#F472B6]">
                    {primary.geneSymbol}
                  </th>
                  <th className="py-3 px-4 font-mono text-sm font-semibold text-[#FB7185]">
                    {secondary.geneSymbol}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#311C33] text-xs sm:text-sm">
                <tr>
                  <td className="py-3 px-4 text-[#A98CA0]">Official Name</td>
                  <td className="py-3 px-4 text-[#FAF2F7]">{primary.fullName}</td>
                  <td className="py-3 px-4 text-[#FAF2F7]">{secondary.fullName}</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#A98CA0]">Lesion Compartment</td>
                  <td className="py-3 px-4 text-[#DFCBD8]">{primary.lesionCompartment}</td>
                  <td className="py-3 px-4 text-[#DFCBD8]">{secondary.lesionCompartment}</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#A98CA0]">Ectopic vs. Healthy log2FC</td>
                  <td className="py-3 px-4 font-mono tabular-nums font-semibold text-[#F472B6]">
                    {primary.summaryMetrics.ectopicLog2FC >= 0 ? '+' : ''}
                    {primary.summaryMetrics.ectopicLog2FC.toFixed(2)} ({primary.summaryMetrics.overallDirection})
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums font-semibold text-[#FB7185]">
                    {secondary.summaryMetrics.ectopicLog2FC >= 0 ? '+' : ''}
                    {secondary.summaryMetrics.ectopicLog2FC.toFixed(2)} ({secondary.summaryMetrics.overallDirection})
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#A98CA0]">Primary Expressing Cell Type</td>
                  <td className="py-3 px-4 text-[#FAF2F7]">
                    {primary.summaryMetrics.primaryCellPopulation}
                  </td>
                  <td className="py-3 px-4 text-[#FAF2F7]">
                    {secondary.summaryMetrics.primaryCellPopulation}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#A98CA0]">Dominant Enriched Hallmark</td>
                  <td className="py-3 px-4 text-[#DFCBD8]">
                    {primary.summaryMetrics.topPathway}
                  </td>
                  <td className="py-3 px-4 text-[#DFCBD8]">
                    {secondary.summaryMetrics.topPathway}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#A98CA0]">ML Rank &amp; Mean |SHAP|</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-[#F472B6]">
                    {primary.summaryMetrics.meanAbsShap.toFixed(3)} · {primary.summaryMetrics.mlFeatureRank}
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-[#FB7185]">
                    {secondary.summaryMetrics.meanAbsShap.toFixed(3)} · {secondary.summaryMetrics.mlFeatureRank}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[
              { target: primary, accent: '#F472B6', label: 'Target A' },
              { target: secondary, accent: '#FB7185', label: 'Target B' },
            ].map(({ target, accent, label }) => {
              const maxAbsFc = Math.max(
                2,
                ...target.modules.geneExplorer.expressionProfiles.map((p) =>
                  Math.abs(p.log2FoldChange)
                )
              );
              return (
                <div
                  key={target.id}
                  className="rounded-md border border-[#311C33] bg-[#160D17] p-5 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-[#311C33] pb-3">
                    <div>
                      <div className="font-mono text-[11px] text-[#A98CA0]">{label}</div>
                      <h2 className="font-display text-lg font-bold text-[#FAF2F7]">
                        <span className="font-mono" style={{ color: accent }}>
                          {target.geneSymbol}
                        </span>{' '}
                        Lineage log2FC
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenDossier(target)}
                      className="text-xs font-medium text-[#F472B6] hover:underline cursor-pointer"
                    >
                      Open Full Dashboard
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {target.modules.geneExplorer.expressionProfiles.map((ep) => {
                      const pct = Math.min(100, (Math.abs(ep.log2FoldChange) / maxAbsFc) * 100);
                      return (
                        <div key={ep.cellType} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[#DFCBD8] truncate">{ep.cellType}</span>
                            <span
                              className="font-mono tabular-nums shrink-0"
                              style={{ color: accent }}
                            >
                              {ep.log2FoldChange >= 0 ? '+' : ''}
                              {ep.log2FoldChange.toFixed(2)}
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-sm bg-[#110A11] overflow-hidden">
                            <div
                              className="h-full"
                              style={{ width: `${pct}%`, backgroundColor: accent }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-md border border-[#311C33] bg-[#160D17] p-5 space-y-3">
              <h3 className="font-display text-base font-semibold text-[#FAF2F7]">
                Pathway Convergence
              </h3>
              {sharedPathways.length > 0 ? (
                <ul className="space-y-2 text-xs text-[#DFCBD8]">
                  {sharedPathways.map((sp) => (
                    <li key={sp.pathwayName} className="border-b border-[#311C33] pb-2 last:border-0">
                      <div className="font-medium text-[#F472B6]">{sp.pathwayName}</div>
                      <div className="text-[#A98CA0] mt-0.5">{sp.mechanisticRole}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[#A98CA0] leading-relaxed">
                  {primary.geneSymbol} and {secondary.geneSymbol} operate across distinct top-ranked pathways ({primary.summaryMetrics.topPathway} vs. {secondary.summaryMetrics.topPathway}), suggesting complementary rather than redundant roles in lesion progression.
                </p>
              )}
            </div>

            <div className="rounded-md border border-[#311C33] bg-[#160D17] p-5 space-y-3">
              <h3 className="font-display text-base font-semibold text-[#FAF2F7]">
                Experimental Hypothesis Contrast
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <div className="font-mono text-[#F472B6] mb-0.5">
                    {primary.geneSymbol}: {primary.modules.explainableMl.hypothesis.title}
                  </div>
                  <p className="text-[#A98CA0] leading-relaxed">
                    {primary.modules.explainableMl.hypothesis.experimentalAssay}
                  </p>
                </div>
                <div className="border-t border-[#311C33] pt-3">
                  <div className="font-mono text-[#FB7185] mb-0.5">
                    {secondary.geneSymbol}: {secondary.modules.explainableMl.hypothesis.title}
                  </div>
                  <p className="text-[#A98CA0] leading-relaxed">
                    {secondary.modules.explainableMl.hypothesis.experimentalAssay}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Comparison PDF Export */}
          <footer className="rounded-md border border-[#311C33] bg-[#160D17] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-display text-sm font-semibold text-[#FAF2F7]">
                {copy.dashboard.exportComparisonPdf}
              </div>
              <p className="text-xs text-[#A98CA0]">
                Export a formatted side-by-side PDF report comparing {primary.geneSymbol} and {secondary.geneSymbol}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onExportComparisonPdf(primary, secondary)}
              className="inline-flex items-center gap-2 rounded-md bg-[#F472B6] px-5 py-2.5 text-xs font-semibold text-[#0B070B] transition-colors hover:bg-[#F9A8D4] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileDown className="h-4 w-4" aria-hidden="true" />
              <span>{copy.dashboard.exportComparisonPdf}</span>
            </button>
          </footer>
        </div>
      ) : (
        <div className="rounded-md border border-[#311C33] bg-[#160D17] p-6 text-sm text-[#A98CA0]">
          Select or analyze a second gene above to populate the comparative matrix.
        </div>
      )}
    </div>
  );
}
