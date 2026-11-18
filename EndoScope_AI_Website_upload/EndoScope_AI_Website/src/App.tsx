import { useCallback, useEffect, useState } from 'react';
import { TopBar, type AppView } from './components/TopBar';
import { ResearchRail } from './components/ResearchRail';
import { DossierView } from './components/DossierView';
import { CompareView } from './components/CompareView';
import { HistoryView } from './components/HistoryView';
import { MethodologyView } from './components/MethodologyView';
import { EndoChatbot } from './components/EndoChatbot';
import type { AnalysisLanguage, GeneAnalysisDossier, LesionCompartment } from './types/dossier';
import {
  loadSavedDossiers,
  saveDossierToHistory,
  deleteDossierFromHistory,
  clearAllDossiers,
} from './utils/storage';
import { serializeDossierToMarkdown } from './utils/markdownExport';
import { exportDossierToPdf, exportComparisonToPdf } from './utils/pdfExport';

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('dossier');
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [queryInput, setQueryInput] = useState('');
  const [compartment, setCompartment] = useState<LesionCompartment>('All Compartments');
  const [language, setLanguage] = useState<AnalysisLanguage>('en');

  const [history, setHistory] = useState<GeneAnalysisDossier[]>(() => loadSavedDossiers());
  const [activeDossier, setActiveDossier] = useState<GeneAnalysisDossier | null>(() => {
    const saved = loadSavedDossiers();
    return saved[0] ?? null;
  });

  const [comparePrimaryId, setComparePrimaryId] = useState<string | null>(null);
  const [compareSecondaryId, setCompareSecondaryId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [pendingQuery, setPendingQuery] = useState('');
  const [pendingCompartment, setPendingCompartment] =
    useState<LesionCompartment>('All Compartments');
  const [error, setError] = useState<string | null>(null);
  const [activeModuleId, setActiveModuleId] = useState('module-cell-atlas');
  const [moduleOpenRequest, setModuleOpenRequest] = useState<{ id: string; seq: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 2600);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  useEffect(() => {
    if (!isSideMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSideMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSideMenuOpen]);

  const executeAnalysis = useCallback(
    async (
      query: string,
      selectedCompartment: LesionCompartment,
      selectedLanguage: AnalysisLanguage = language,
      options?: { assignToCompareSecondary?: boolean }
    ) => {
      const trimmed = query.trim();
      if (!trimmed) return;

      setIsLoading(true);
      setError(null);
      setPendingQuery(trimmed);
      setPendingCompartment(selectedCompartment);

      if (!options?.assignToCompareSecondary) {
        setActiveView('dossier');
      }

      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: trimmed,
            lesionCompartment: selectedCompartment,
            language: selectedLanguage,
          }),
        });

        const data = (await res.json()) as { dossier?: GeneAnalysisDossier; error?: string };
        if (!res.ok || !data.dossier) {
          throw new Error(data.error || `Server returned status ${res.status}`);
        }

        const newDossier = data.dossier;
        const updatedHistory = saveDossierToHistory(newDossier);
        setHistory(updatedHistory);
        setActiveDossier(newDossier);

        if (options?.assignToCompareSecondary) {
          setCompareSecondaryId(newDossier.id);
          showToast(`Added ${newDossier.geneSymbol} to comparison`);
        } else {
          if (!comparePrimaryId) {
            setComparePrimaryId(newDossier.id);
          }
          showToast(`Compiled ${newDossier.geneSymbol} dashboard`);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to complete bioinformatics analysis.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [comparePrimaryId, language, showToast]
  );

  const handleJumpToModule = (id: string) => {
    setActiveModuleId(id);
    setModuleOpenRequest((prev) => ({ id, seq: (prev?.seq ?? 0) + 1 }));
  };

  const handleCopyMarkdown = () => {
    if (!activeDossier) return;
    const md = serializeDossierToMarkdown(activeDossier);
    navigator.clipboard.writeText(md).then(
      () => showToast(`Copied ${activeDossier.geneSymbol} Markdown to clipboard`),
      () => showToast('Clipboard permission unavailable')
    );
  };

  const handleExportDossierPdf = (dossier: GeneAnalysisDossier) => {
    exportDossierToPdf(dossier);
    showToast(`Exported ${dossier.geneSymbol} PDF report`);
  };

  const handleExportComparisonPdf = (
    primary: GeneAnalysisDossier,
    secondary: GeneAnalysisDossier
  ) => {
    exportComparisonToPdf(primary, secondary);
    showToast(`Exported ${primary.geneSymbol} vs ${secondary.geneSymbol} PDF`);
  };

  const handleNewQuery = () => {
    setActiveView('dossier');
    setActiveDossier(null);
    setError(null);
    setQueryInput('');
    setIsSideMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteDossier = (id: string) => {
    const next = deleteDossierFromHistory(id);
    setHistory(next);
    if (activeDossier?.id === id) {
      setActiveDossier(next[0] ?? null);
    }
    if (comparePrimaryId === id) setComparePrimaryId(null);
    if (compareSecondaryId === id) setCompareSecondaryId(null);
    showToast('Removed dossier from history');
  };

  const handleClearAll = () => {
    const next = clearAllDossiers();
    setHistory(next);
    setActiveDossier(null);
    setComparePrimaryId(null);
    setCompareSecondaryId(null);
    showToast('Cleared research history');
  };

  return (
    <div className="min-h-screen bg-[#0B070B] text-[#FAF2F7] flex flex-col">
      <TopBar
        activeView={activeView}
        onSelectView={(v) => {
          setActiveView(v);
          setIsSideMenuOpen(false);
        }}
        onNewQuery={handleNewQuery}
        language={language}
        isSideMenuOpen={isSideMenuOpen}
        onToggleSideMenu={() => setIsSideMenuOpen((prev) => !prev)}
      />

      <ResearchRail
        isOpen={isSideMenuOpen}
        onClose={() => setIsSideMenuOpen(false)}
        queryInput={queryInput}
        onQueryInputChange={setQueryInput}
        compartment={compartment}
        onCompartmentChange={setCompartment}
        language={language}
        onLanguageChange={setLanguage}
        onSubmitQuery={(q, comp, lang) => void executeAnalysis(q, comp, lang)}
        isLoading={isLoading}
        hasActiveDossier={Boolean(activeDossier)}
        showModuleNav={activeView === 'dossier'}
        activeModuleId={activeModuleId}
        onJumpToModule={handleJumpToModule}
      />

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col">
        <main className="min-w-0 flex-1 pb-16">
          {activeView === 'dossier' && (
            <DossierView
              dossier={activeDossier}
              language={language}
              isLoading={isLoading}
              pendingQuery={pendingQuery}
              pendingCompartment={pendingCompartment}
              error={error}
              onRetry={() => void executeAnalysis(pendingQuery, pendingCompartment, language)}
              onQuickSearch={(q) => {
                setQueryInput(q);
                void executeAnalysis(q, compartment, language);
              }}
              onSelectBenchmark={(symbol) => {
                setQueryInput(symbol);
                void executeAnalysis(symbol, compartment, language);
              }}
              onCopyMarkdown={handleCopyMarkdown}
              onExportPdf={handleExportDossierPdf}
              onAddToCompare={(target) => {
                setComparePrimaryId(target.id);
                setActiveView('compare');
              }}
              onActiveModuleChange={setActiveModuleId}
              moduleOpenRequest={moduleOpenRequest}
            />
          )}

          {activeView === 'compare' && (
            <CompareView
              dossiers={history}
              language={language}
              primaryId={comparePrimaryId}
              secondaryId={compareSecondaryId}
              onSelectPrimary={setComparePrimaryId}
              onSelectSecondary={setCompareSecondaryId}
              onRunSecondaryAnalysis={async (q, comp) => {
                await executeAnalysis(q, comp, language, { assignToCompareSecondary: true });
              }}
              isLoading={isLoading}
              onOpenDossier={(target) => {
                setActiveDossier(target);
                setActiveView('dossier');
              }}
              onExportComparisonPdf={handleExportComparisonPdf}
            />
          )}

          {activeView === 'history' && (
            <HistoryView
              dossiers={history}
              activeDossierId={activeDossier?.id ?? null}
              onOpenDossier={(target) => {
                setActiveDossier(target);
                setActiveView('dossier');
              }}
              onAssignCompareA={(id) => {
                setComparePrimaryId(id);
                setActiveView('compare');
              }}
              onAssignCompareB={(id) => {
                setCompareSecondaryId(id);
                setActiveView('compare');
              }}
              onExportPdf={handleExportDossierPdf}
              onDeleteDossier={handleDeleteDossier}
              onClearAll={handleClearAll}
            />
          )}

          {activeView === 'methodology' && <MethodologyView />}
        </main>
      </div>

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-5 z-40 rounded-md border border-[#311C33] bg-[#160D17] px-4 py-2.5 text-xs font-medium text-[#FAF2F7] shadow-lg"
        >
          {toastMessage}
        </div>
      )}

      <EndoChatbot
        language={language}
        activeGene={activeDossier?.geneSymbol}
        activeCompartment={activeDossier?.lesionCompartment ?? compartment}
      />
    </div>
  );
}
