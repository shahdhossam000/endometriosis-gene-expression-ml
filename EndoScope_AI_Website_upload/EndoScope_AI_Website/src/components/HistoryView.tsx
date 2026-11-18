import { useState } from 'react';
import { Search, Trash2, FileDown, ExternalLink } from 'lucide-react';
import type { GeneAnalysisDossier } from '../types/dossier';

interface HistoryViewProps {
  dossiers: GeneAnalysisDossier[];
  activeDossierId: string | null;
  onOpenDossier: (dossier: GeneAnalysisDossier) => void;
  onAssignCompareA: (id: string) => void;
  onAssignCompareB: (id: string) => void;
  onExportPdf: (dossier: GeneAnalysisDossier) => void;
  onDeleteDossier: (id: string) => void;
  onClearAll: () => void;
}

export function HistoryView({
  dossiers,
  activeDossierId,
  onOpenDossier,
  onAssignCompareA,
  onAssignCompareB,
  onExportPdf,
  onDeleteDossier,
  onClearAll,
}: HistoryViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const filtered = dossiers.filter((d) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      d.geneSymbol.toLowerCase().includes(q) ||
      d.fullName.toLowerCase().includes(q) ||
      d.query.toLowerCase().includes(q) ||
      d.lesionCompartment.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-[1040px] px-6 py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#311C33] pb-6">
        <div className="space-y-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#FAF2F7]">
            Saved Research History
          </h1>
          <p className="text-sm text-[#A98CA0]">
            {dossiers.length} archived {dossiers.length === 1 ? 'dossier' : 'dossiers'} stored locally for instant recall and comparison.
          </p>
        </div>

        {dossiers.length > 0 && (
          <div className="flex items-center gap-2">
            {confirmClear ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClearAll();
                    setConfirmClear(false);
                  }}
                  className="rounded-md bg-[#9D174D] px-3 py-2 text-xs font-medium text-[#FCE7F3] hover:bg-[#BE185D] cursor-pointer whitespace-nowrap"
                >
                  Confirm Clear All
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="rounded-md border border-[#311C33] px-3 py-2 text-xs text-[#A98CA0] hover:text-[#FAF2F7] cursor-pointer whitespace-nowrap"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="rounded-md border border-[#311C33] bg-[#160D17] px-3 py-2 text-xs font-medium text-[#A98CA0] hover:border-[#F472B6] hover:text-[#FAF2F7] cursor-pointer whitespace-nowrap"
              >
                Clear History
              </button>
            )}
          </div>
        )}
      </header>

      {dossiers.length > 0 && (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7E6174]"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter saved dossiers by gene symbol, pathway, or compartment..."
            className="w-full rounded-md border border-[#311C33] bg-[#160D17] py-2.5 pl-9 pr-4 text-sm text-[#FAF2F7] placeholder-[#7E6174] focus:border-[#F472B6] focus:outline-none"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-md border border-[#311C33] bg-[#160D17] p-8 text-sm text-[#A98CA0]">
          {dossiers.length === 0
            ? 'No dossiers have been saved yet. Run a gene or mechanism query from the left console to start building your research archive.'
            : 'No saved dossiers match your current filter.'}
        </div>
      ) : (
        <div className="divide-y divide-[#311C33] rounded-md border border-[#311C33] bg-[#160D17]">
          {filtered.map((item) => {
            const isCurrent = item.id === activeDossierId;
            return (
              <div
                key={item.id}
                className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 hover:bg-[#1F1221]/60 transition-colors"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#A98CA0]">
                    <span className="font-mono text-sm font-semibold text-[#F472B6]">
                      {item.geneSymbol}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#FAF2F7] font-medium truncate">{item.fullName}</span>
                    {isCurrent && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-[#EC4899]">Active</span>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#7E6174]">
                    <span>{item.lesionCompartment}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      log2FC {item.summaryMetrics.ectopicLog2FC >= 0 ? '+' : ''}
                      {item.summaryMetrics.ectopicLog2FC.toFixed(2)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{item.summaryMetrics.primaryCellPopulation}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {new Date(item.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenDossier(item)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#1F1221] border border-[#311C33] px-3 py-1.5 text-xs font-medium text-[#FAF2F7] hover:border-[#F472B6] cursor-pointer whitespace-nowrap"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Open Dashboard</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onAssignCompareA(item.id)}
                    className="rounded-md border border-[#311C33] px-2.5 py-1.5 font-mono text-xs text-[#DFCBD8] hover:border-[#F472B6] hover:text-[#F472B6] cursor-pointer whitespace-nowrap"
                  >
                    Compare A
                  </button>
                  <button
                    type="button"
                    onClick={() => onAssignCompareB(item.id)}
                    className="rounded-md border border-[#311C33] px-2.5 py-1.5 font-mono text-xs text-[#DFCBD8] hover:border-[#FB7185] hover:text-[#FB7185] cursor-pointer whitespace-nowrap"
                  >
                    Compare B
                  </button>
                  <button
                    type="button"
                    onClick={() => onExportPdf(item)}
                    aria-label={`Export ${item.geneSymbol} PDF`}
                    className="rounded-md border border-[#311C33] p-1.5 text-[#A98CA0] hover:border-[#F472B6] hover:text-[#FAF2F7] cursor-pointer"
                  >
                    <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteDossier(item.id)}
                    aria-label={`Delete ${item.geneSymbol}`}
                    className="rounded-md border border-[#311C33] p-1.5 text-[#A98CA0] hover:border-[#9D174D] hover:text-[#FDA4AF] cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
