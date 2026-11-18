import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  Copy,
  Check,
  GitCompare,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Search,
  FileDown,
  ChevronDown,
} from 'lucide-react';
import type { AnalysisLanguage, GeneAnalysisDossier, LesionCompartment } from '../types/dossier';
import { BENCHMARK_TARGETS } from './ResearchRail';
import { UI_COPY } from '../utils/i18n';
import {
  CellAtlasUmapPlot,
  CellAtlasPerturbationPlot,
  TissueExpressionPlot,
  PathwayEnrichmentPlot,
  LigandReceptorNetworkPlot,
  ShapWaterfallPlot,
} from './charts/ScientificPlots';

interface DossierViewProps {
  dossier: GeneAnalysisDossier | null;
  language: AnalysisLanguage;
  isLoading: boolean;
  pendingQuery: string;
  pendingCompartment: LesionCompartment;
  error: string | null;
  onRetry: () => void;
  onQuickSearch: (query: string) => void;
  onSelectBenchmark: (symbol: string) => void;
  onCopyMarkdown: () => void;
  onExportPdf: (dossier: GeneAnalysisDossier) => void;
  onAddToCompare: (dossier: GeneAnalysisDossier) => void;
  onActiveModuleChange: (moduleId: string) => void;
  moduleOpenRequest: { id: string; seq: number } | null;
}

const ALL_MODULE_IDS = [
  'module-cell-atlas',
  'module-gene-explorer',
  'module-pathways',
  'module-cell-comm',
  'module-explainable-ml',
] as const;

const COMPILING_STAGES_EN = [
  'Mapping single-cell lineage dysregulation and UMAP clusters',
  'Computing Healthy vs. Eutopic vs. Ectopic expression profiles',
  'Evaluating pathway enrichment across inflammation, fibrosis, and angiogenesis',
  'Reconstructing sender–receiver ligand–receptor crosstalk axes',
  'Ranking candidate genes via SHAP attribution and designing wet-lab hypothesis',
];

const COMPILING_STAGES_AR = [
  'تحليل خريطة الخلايا (Cell Atlas) وتحديد الخلايا متغيرة النشاط في المرض',
  'مقارنة مستوى التعبير الجيني بين الأنسجة السليمة والمصابة في كل نوع خلية',
  'تحليل المسارات الحيوية (الالتهاب، التليف، تكوين الأوعية، استجابة الهرمونات)',
  'إعادة بناء شبكة تواصل الخلايا وإشارات Ligand-Receptor في بيئة المرض',
  'ترتيب الجينات المرشحة وتفسير قرارات الذكاء الاصطناعي عبر SHAP وبناء فرضية المعمل',
];

interface AccordionModuleProps {
  id: string;
  index: string;
  title: string;
  subtitle: string;
  summaryHint: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function AccordionModule({
  id,
  index,
  title,
  subtitle,
  summaryHint,
  isOpen,
  onToggle,
  children,
}: AccordionModuleProps) {
  const cleanTitle = title.replace(/^\d+\.\s*/, '');

  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-md border border-[#311C33] bg-[#160D17] overflow-hidden transition-colors duration-150"
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={`${id}-panel`}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 sm:px-6 text-left transition-colors duration-150 hover:bg-[#1F1221] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#F472B6]"
      >
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <span
            className="font-mono text-sm font-semibold text-[#F472B6] shrink-0 pt-0.5 sm:pt-0"
            dir="ltr"
          >
            {index}
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base sm:text-lg font-bold text-[#FAF2F7] truncate">
              {cleanTitle}
            </h2>
            <p className="text-xs text-[#A98CA0] mt-0.5 line-clamp-1">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0" dir="ltr">
          <span className="hidden md:inline font-mono text-xs text-[#A98CA0] tabular-nums">
            {summaryHint}
          </span>
          <span
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors duration-150 ${
              isOpen
                ? 'border-[#F472B6] bg-[#261428] text-[#F472B6]'
                : 'border-[#311C33] bg-[#110A11] text-[#F472B6]'
            }`}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-150 ${
                isOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </span>
        </div>
      </button>

      {isOpen && (
        <div
          id={`${id}-panel`}
          className="border-t border-[#311C33] bg-[#140B15] p-5 sm:p-7 space-y-6"
        >
          {children}
        </div>
      )}
    </section>
  );
}

export function DossierView({
  dossier,
  language,
  isLoading,
  pendingQuery,
  pendingCompartment,
  error,
  onRetry,
  onQuickSearch,
  onSelectBenchmark,
  onCopyMarkdown,
  onExportPdf,
  onAddToCompare,
  onActiveModuleChange,
  moduleOpenRequest,
}: DossierViewProps) {
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [topSearch, setTopSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);

  const activeLang: AnalysisLanguage = dossier?.language ?? language;
  const copy = UI_COPY[activeLang];
  const isRtl = activeLang === 'ar';

  // Reset collapsed state cleanly when switching to a newly analyzed dossier
  useEffect(() => {
    setExpandedModules({});
  }, [dossier?.id]);

  // Open & scroll when user jumps from the top-left menu
  useEffect(() => {
    if (!moduleOpenRequest) return;
    const { id } = moduleOpenRequest;
    setExpandedModules((prev) => ({ ...prev, [id]: true }));
    onActiveModuleChange(id);
    window.setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 40);
  }, [moduleOpenRequest, onActiveModuleChange]);

  useEffect(() => {
    if (!isLoading) {
      setStageIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setStageIndex((prev) => (prev < 4 ? prev + 1 : prev));
    }, 1600);
    return () => window.clearInterval(timer);
  }, [isLoading]);

  const toggleModule = (id: string) => {
    setExpandedModules((prev) => {
      const nextOpen = !prev[id];
      if (nextOpen) {
        onActiveModuleChange(id);
      }
      return { ...prev, [id]: nextOpen };
    });
  };

  const allExpanded = ALL_MODULE_IDS.every((id) => Boolean(expandedModules[id]));

  const handleToggleAll = () => {
    if (allExpanded) {
      setExpandedModules({});
    } else {
      const next: Record<string, boolean> = {};
      ALL_MODULE_IDS.forEach((id) => {
        next[id] = true;
      });
      setExpandedModules(next);
    }
  };

  const handleCopy = () => {
    onCopyMarkdown();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleTopSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = topSearch.trim();
    if (trimmed.length < 2) return;
    onQuickSearch(trimmed);
  };

  const renderTopSearchBar = () => (
    <form
      onSubmit={handleTopSearchSubmit}
      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-md border border-[#311C33] bg-[#160D17] p-3"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7E6174]"
          aria-hidden="true"
        />
        <input
          type="text"
          dir="ltr"
          value={topSearch}
          onChange={(e) => setTopSearch(e.target.value)}
          placeholder={copy.dashboard.searchPlaceholder}
          disabled={isLoading}
          className="w-full rounded-md border border-[#311C33] bg-[#0B070B] py-2 pl-9 pr-3 font-mono text-sm text-[#FAF2F7] placeholder-[#7E6174] focus:border-[#F472B6] focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="submit"
          disabled={isLoading || topSearch.trim().length < 2}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-[#F472B6] px-4 py-2 text-xs font-semibold text-[#0B070B] transition-colors hover:bg-[#F9A8D4] disabled:bg-[#311C33] disabled:text-[#7E6174] whitespace-nowrap cursor-pointer"
        >
          <span>{copy.dashboard.analyzeBtn}</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </form>
  );

  if (isLoading) {
    const stages = language === 'ar' ? COMPILING_STAGES_AR : COMPILING_STAGES_EN;
    return (
      <div className="mx-auto max-w-[1160px] px-6 py-8 space-y-6">
        {renderTopSearchBar()}
        <div
          className="rounded-md border border-[#311C33] bg-[#160D17] p-8 space-y-6"
          dir={language === 'ar' ? 'rtl' : 'ltr'}
        >
          <div className="space-y-2">
            <div className="font-mono text-xs uppercase tracking-wider text-[#F472B6]">
              {language === 'ar' ? 'جاري بناء لوحة التحليل الجيني' : 'Synthesizing Gene Dashboard'}
            </div>
            <h1 className="font-display text-2xl font-bold text-[#FAF2F7]">
              {language === 'ar' ? 'تحليل الجين:' : 'Analyzing'}{' '}
              <span className="font-mono text-[#F472B6]">{pendingQuery}</span>
            </h1>
            <p className="text-sm text-[#A98CA0]">{pendingCompartment}</p>
          </div>

          <div className="space-y-3 border-t border-[#311C33] pt-6">
            {stages.map((label, idx) => {
              const isDone = idx < stageIndex;
              const isCurrent = idx === stageIndex;
              return (
                <div
                  key={label}
                  className={`flex items-center gap-3 text-sm transition-opacity duration-200 ${
                    isCurrent
                      ? 'text-[#FAF2F7]'
                      : isDone
                      ? 'text-[#A98CA0]'
                      : 'text-[#7E6174]'
                  }`}
                >
                  <span className="font-mono text-xs w-6 shrink-0 text-[#F472B6]">
                    0{idx + 1}
                  </span>
                  <span>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[1160px] px-6 py-8 space-y-6">
        {renderTopSearchBar()}
        <div className="rounded-md border border-[#9D174D] bg-[#160D17] p-8 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-[#FB7185] mt-0.5" aria-hidden="true" />
            <div className="space-y-2">
              <h2 className="font-display text-lg font-semibold text-[#FAF2F7]">
                Analysis Request Could Not Be Completed
              </h2>
              <p className="text-sm text-[#DFCBD8] leading-relaxed">{error}</p>
            </div>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-md border border-[#311C33] bg-[#1F1221] px-4 py-2 text-xs font-medium text-[#FAF2F7] transition-colors hover:border-[#F472B6] cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Retry Query</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="mx-auto max-w-[1160px] px-6 py-8 space-y-8" dir={isRtl ? 'rtl' : 'ltr'}>
        <section className="space-y-4 border-b border-[#311C33] pb-8">
          <div className="font-mono text-xs uppercase tracking-wider text-[#F472B6]">
            {language === 'ar'
              ? 'منصة EndoScope Ai لتحليل بطانة الرحم المهاجرة'
              : 'EndoScope Ai · Endometriosis Transcriptomics & Pathology'}
          </div>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight leading-[1.15] text-[#FAF2F7] max-w-3xl">
            {language === 'ar' ? (
              <>
                استكشف بيولوجيا بطانة الرحم المهاجرة{' '}
                <span className="text-[#F472B6]">بدقة الخلية الواحدة</span>
              </>
            ) : (
              <>
                Decode Endometriosis Biology at{' '}
                <span className="text-[#F472B6]">Single-Cell Resolution</span>
              </>
            )}
          </h1>
          <p className="text-base text-[#C8B0BF] max-w-2xl leading-relaxed">
            {language === 'ar'
              ? 'اكتب رمز أي جين مثل LYVE1 أو VEGFA في شريط البحث أدناه لعرض داش بورد تفاعلي متكامل يضم خريطة الخلايا، مقارنة الأنسجة السليمة والمصابة، المسارات الحيوية، تواصل الخلايا، وتوقعات الذكاء الاصطناعي (SHAP) مع تصدير تقرير PDF احترافي في النهاية.'
              : 'Enter any human gene symbol below (e.g., LYVE1, VEGFA, CCL19) to generate a synchronized five-panel dashboard covering Cell Atlas clusters, Healthy vs. Diseased Gene Explorer, Biological Pathways, Ligand–Receptor communication, and Explainable ML candidate rankings with a publication-grade PDF report.'}
          </p>
        </section>

        {renderTopSearchBar()}

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-lg font-semibold text-[#FAF2F7]">
              {language === 'ar' ? 'جينات مرجعية جاهزة للتحليل الفوري' : 'Select a Gene to Launch Dashboard'}
            </h2>
            <span className="text-xs text-[#7E6174]">
              {language === 'ar' ? 'تحليل فوري لـ 5 لوحات' : 'Compiles all 5 analytical modules'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" dir="ltr">
            {BENCHMARK_TARGETS.map((target) => (
              <button
                key={target.symbol}
                type="button"
                onClick={() => onSelectBenchmark(target.symbol)}
                className="group flex flex-col justify-between rounded-md border border-[#311C33] bg-[#160D17] p-5 text-left transition-colors duration-150 hover:border-[#F472B6] hover:bg-[#1F1221] cursor-pointer"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-base font-semibold text-[#F472B6]">
                      {target.symbol}
                    </span>
                    <ArrowRight
                      className="h-4 w-4 text-[#7E6174] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[#F472B6]"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="text-sm text-[#DFCBD8] leading-snug">{target.axis}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#311C33] text-xs text-[#7E6174]">
                  Cell Atlas · Explorer · Pathways · Crosstalk · SHAP
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  const { summaryMetrics, modules } = dossier;
  const formattedFc = `${summaryMetrics.ectopicLog2FC >= 0 ? '+' : ''}${summaryMetrics.ectopicLog2FC.toFixed(2)}`;
  const isUp = summaryMetrics.ectopicLog2FC >= 0;
  const candidateGenes = modules.explainableMl.candidateGenes ?? [];
  const predictedScore =
    modules.explainableMl.predictedExpressionScore ?? Math.round(summaryMetrics.meanAbsShap * 100);

  return (
    <div className="mx-auto max-w-[1160px] px-6 py-6 space-y-6">
      {renderTopSearchBar()}

      <article className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
        {/* Dossier Title & 4-Column Quantitative Summary Strip */}
        <header className="space-y-5 border-b border-[#311C33] pb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#A98CA0]" dir="ltr">
                <span>{dossier.lesionCompartment}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{dossier.query}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {new Date(dossier.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <h1
                className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#FAF2F7]"
                dir="ltr"
              >
                <span className="font-mono text-[#F472B6]">{dossier.geneSymbol}</span>
                <span className="text-[#7E6174] mx-2.5 font-normal">—</span>
                <span>{dossier.fullName}</span>
              </h1>
            </div>

            <div className="flex items-center gap-2 shrink-0" dir="ltr">
              <button
                type="button"
                onClick={() => onAddToCompare(dossier)}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#311C33] bg-[#160D17] px-3 py-2 text-xs font-medium text-[#DFCBD8] transition-colors hover:border-[#F472B6] hover:text-[#FAF2F7] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <GitCompare className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Compare Target</span>
              </button>
            </div>
          </div>

          <p className="text-[15px] text-[#DFCBD8] leading-[1.68] max-w-[82ch]">
            {dossier.executiveSummary}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-px rounded-md border border-[#311C33] bg-[#311C33] overflow-hidden">
            <div className="bg-[#160D17] p-4 space-y-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-[#A98CA0]">
                {copy.dashboard.ectopicFc}
              </div>
              <div className="flex items-baseline gap-2" dir="ltr">
                <span
                  className={`font-mono text-2xl font-semibold tabular-nums ${
                    isUp ? 'text-[#EC4899]' : 'text-[#F9A8D4]'
                  }`}
                >
                  {formattedFc}
                </span>
                <span className="font-mono text-xs text-[#7E6174]">log2FC</span>
              </div>
              <div className="text-xs text-[#A98CA0]">{summaryMetrics.overallDirection}</div>
            </div>

            <div className="bg-[#160D17] p-4 space-y-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-[#A98CA0]">
                {copy.dashboard.primaryLineage}
              </div>
              <div className="text-sm font-semibold text-[#FAF2F7] leading-snug pt-0.5">
                {summaryMetrics.primaryCellPopulation}
              </div>
              <div className="text-xs text-[#7E6174]">{dossier.lesionCompartment}</div>
            </div>

            <div className="bg-[#160D17] p-4 space-y-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-[#A98CA0]">
                {copy.dashboard.enrichedHallmark}
              </div>
              <div className="text-sm font-semibold text-[#FAF2F7] leading-snug pt-0.5">
                {summaryMetrics.topPathway}
              </div>
              <div className="text-xs text-[#7E6174]">GSEA / Functional axis</div>
            </div>

            <div className="bg-[#160D17] p-4 space-y-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-[#A98CA0]">
                {copy.dashboard.mlPriority}
              </div>
              <div className="flex items-baseline gap-2" dir="ltr">
                <span className="font-mono text-2xl font-semibold tabular-nums text-[#F472B6]">
                  {summaryMetrics.meanAbsShap.toFixed(3)}
                </span>
                <span className="font-mono text-xs text-[#7E6174]">|SHAP|</span>
              </div>
              <div className="font-mono text-xs text-[#A98CA0] truncate" dir="ltr">
                {summaryMetrics.mlFeatureRank}
              </div>
            </div>
          </div>
        </header>

        {/* Stacked Accordion Modules Toolbar */}
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs font-medium uppercase tracking-wider text-[#A98CA0]">
            {isRtl
              ? 'اختر أي محور واضغط على السهم لفتح التحليل أسفله'
              : 'Select any analytical module below to expand its plots and findings'}
          </div>
          <button
            type="button"
            onClick={handleToggleAll}
            className="text-xs font-medium text-[#F472B6] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            {allExpanded
              ? isRtl
                ? 'إغلاق الكل'
                : 'Collapse All'
              : isRtl
              ? 'فتح الكل'
              : 'Expand All'}
          </button>
        </div>

        {/* 5 STACKED ACCORDION MODULES (One under another, arrow opens underneath) */}
        <div className="space-y-3">
          {/* 01. Cell Atlas */}
          <AccordionModule
            id="module-cell-atlas"
            index="01"
            title={copy.modules.m1Title}
            subtitle={copy.modules.m1Sub}
            summaryHint={`${modules.cellAtlas.populations.length} cell lineages`}
            isOpen={Boolean(expandedModules['module-cell-atlas'])}
            onToggle={() => toggleModule('module-cell-atlas')}
          >
            <p className="text-[15px] text-[#DFCBD8] leading-[1.7] max-w-[78ch]">
              {modules.cellAtlas.overview}
            </p>
            <ul className="space-y-2 text-sm text-[#DFCBD8] max-w-[78ch]">
              {modules.cellAtlas.keyFindings.map((finding, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="font-mono text-xs text-[#F472B6] mt-1 shrink-0">—</span>
                  <span className="leading-relaxed">{finding}</span>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CellAtlasUmapPlot
                populations={modules.cellAtlas.populations}
                geneSymbol={dossier.geneSymbol}
              />
              <CellAtlasPerturbationPlot populations={modules.cellAtlas.populations} />
            </div>
          </AccordionModule>

          {/* 02. Gene Explorer */}
          <AccordionModule
            id="module-gene-explorer"
            index="02"
            title={copy.modules.m2Title}
            subtitle={copy.modules.m2Sub}
            summaryHint={`log2FC ${formattedFc}`}
            isOpen={Boolean(expandedModules['module-gene-explorer'])}
            onToggle={() => toggleModule('module-gene-explorer')}
          >
            <div className="space-y-4 max-w-[78ch]">
              <p className="text-[15px] text-[#DFCBD8] leading-[1.7]">
                {modules.geneExplorer.overview}
              </p>
              <p className="text-[15px] text-[#DFCBD8] leading-[1.7]">
                {modules.geneExplorer.tissueComparisonNarrative}
              </p>
            </div>
            <ul className="space-y-2 text-sm text-[#DFCBD8] max-w-[78ch]">
              {modules.geneExplorer.transcriptomicTrends.map((trend, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="font-mono text-xs text-[#F472B6] mt-1 shrink-0">—</span>
                  <span className="leading-relaxed">{trend}</span>
                </li>
              ))}
            </ul>
            <TissueExpressionPlot profiles={modules.geneExplorer.expressionProfiles} />
            <div className="overflow-x-auto border border-[#311C33] rounded-md" dir="ltr">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#311C33] bg-[#110A11] text-[#A98CA0] font-mono">
                    <th className="py-2.5 px-3 font-medium">Cell Population</th>
                    <th className="py-2.5 px-3 font-medium text-right">Healthy</th>
                    <th className="py-2.5 px-3 font-medium text-right">Eutopic</th>
                    <th className="py-2.5 px-3 font-medium text-right">Ectopic</th>
                    <th className="py-2.5 px-3 font-medium text-right">log2FC</th>
                    <th className="py-2.5 px-3 font-medium text-right">adj. P</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#311C33]">
                  {modules.geneExplorer.expressionProfiles.map((row) => (
                    <tr key={row.cellType} className="hover:bg-[#1F1221]/60">
                      <td className="py-2.5 px-3 font-medium text-[#FAF2F7]">{row.cellType}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#FBCFE8]">
                        {row.healthyCpm.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#DFCBD8]">
                        {row.eutopicCpm.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#EC4899]">
                        {row.ectopicCpm.toFixed(2)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono tabular-nums ${
                          row.log2FoldChange >= 0 ? 'text-[#EC4899]' : 'text-[#F9A8D4]'
                        }`}
                      >
                        {row.log2FoldChange >= 0 ? '+' : ''}
                        {row.log2FoldChange.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#A98CA0]">
                        {row.adjustedPValue}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AccordionModule>

          {/* 03. Biological Pathways */}
          <AccordionModule
            id="module-pathways"
            index="03"
            title={copy.modules.m3Title}
            subtitle={copy.modules.m3Sub}
            summaryHint={`${modules.pathways.enrichmentResults.length} pathways`}
            isOpen={Boolean(expandedModules['module-pathways'])}
            onToggle={() => toggleModule('module-pathways')}
          >
            <p className="text-[15px] text-[#DFCBD8] leading-[1.7] max-w-[78ch]">
              {modules.pathways.overview}
            </p>
            <ul className="space-y-2 text-sm text-[#DFCBD8] max-w-[78ch]">
              {modules.pathways.keyMechanisms.map((mech, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="font-mono text-xs text-[#F472B6] mt-1 shrink-0">—</span>
                  <span className="leading-relaxed">{mech}</span>
                </li>
              ))}
            </ul>
            <PathwayEnrichmentPlot results={modules.pathways.enrichmentResults} />
          </AccordionModule>

          {/* 04. Cell-Cell Communication */}
          <AccordionModule
            id="module-cell-comm"
            index="04"
            title={copy.modules.m4Title}
            subtitle={copy.modules.m4Sub}
            summaryHint={`${modules.cellCommunication.interactions.length} L-R edges`}
            isOpen={Boolean(expandedModules['module-cell-comm'])}
            onToggle={() => toggleModule('module-cell-comm')}
          >
            <p className="text-[15px] text-[#DFCBD8] leading-[1.7] max-w-[78ch]">
              {modules.cellCommunication.overview}
            </p>
            <ul className="space-y-2 text-sm text-[#DFCBD8] max-w-[78ch]">
              {modules.cellCommunication.crosstalkMechanisms.map((cm, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="font-mono text-xs text-[#F472B6] mt-1 shrink-0">—</span>
                  <span className="leading-relaxed">{cm}</span>
                </li>
              ))}
            </ul>
            <LigandReceptorNetworkPlot edges={modules.cellCommunication.interactions} />
            <div className="overflow-x-auto border border-[#311C33] rounded-md" dir="ltr">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#311C33] bg-[#110A11] text-[#A98CA0] font-mono">
                    <th className="py-2.5 px-3 font-medium">Sender</th>
                    <th className="py-2.5 px-3 font-medium">Ligand → Receptor</th>
                    <th className="py-2.5 px-3 font-medium">Receiver</th>
                    <th className="py-2.5 px-3 font-medium text-right">Weight</th>
                    <th className="py-2.5 px-3 font-medium">Signaling Axis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#311C33]">
                  {modules.cellCommunication.interactions.map((edge, idx) => (
                    <tr key={idx} className="hover:bg-[#1F1221]/60">
                      <td className="py-2.5 px-3 text-[#FAF2F7] font-medium">{edge.senderCell}</td>
                      <td className="py-2.5 px-3 font-mono text-[#EC4899]">
                        {edge.ligand} → {edge.receptor}
                      </td>
                      <td className="py-2.5 px-3 text-[#FAF2F7] font-medium">{edge.receiverCell}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#F472B6]">
                        {edge.interactionWeight.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-[#A98CA0]">{edge.signalingAxis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AccordionModule>

          {/* 05. Explainable ML & Hypothesis */}
          <AccordionModule
            id="module-explainable-ml"
            index="05"
            title={copy.modules.m5Title}
            subtitle={copy.modules.m5Sub}
            summaryHint={`SHAP ${summaryMetrics.meanAbsShap.toFixed(3)}`}
            isOpen={Boolean(expandedModules['module-explainable-ml'])}
            onToggle={() => toggleModule('module-explainable-ml')}
          >
            <div className="space-y-3 max-w-[78ch]">
              <p className="text-[15px] text-[#DFCBD8] leading-[1.7]">
                {modules.explainableMl.overview}
              </p>
              <div className="text-xs font-mono text-[#F472B6]" dir="ltr">
                Model Context: {modules.explainableMl.modelContext}
              </div>
              <p className="text-[15px] text-[#DFCBD8] leading-[1.7]">
                {modules.explainableMl.shapRationale}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 space-y-4">
                <div className="rounded-md border border-[#311C33] bg-[#110A11] p-4 space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-medium uppercase tracking-wider text-[#A98CA0]">
                      {copy.dashboard.predictedLevel}
                    </span>
                    <span
                      className="font-mono text-xl font-bold tabular-nums text-[#EC4899]"
                      dir="ltr"
                    >
                      {predictedScore.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-sm bg-[#1D0F1E] overflow-hidden" dir="ltr">
                    <div
                      className="h-full bg-[#EC4899]"
                      style={{ width: `${Math.min(100, Math.max(0, predictedScore))}%` }}
                    />
                  </div>
                  <p className="text-xs text-[#DFCBD8] leading-relaxed pt-1">
                    {modules.explainableMl.predictedExpressionSummary ||
                      modules.explainableMl.shapRationale}
                  </p>
                </div>

                <ShapWaterfallPlot contributions={modules.explainableMl.shapContributions} />
              </div>

              <div className="lg:col-span-6 space-y-4">
                <div className="rounded-md border border-[#311C33] bg-[#110A11] p-4 space-y-3">
                  <div className="border-b border-[#311C33] pb-2">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-[#A98CA0]">
                      {copy.dashboard.rankedCandidates}
                    </h3>
                  </div>

                  {candidateGenes.length > 0 ? (
                    <div className="divide-y divide-[#311C33]">
                      {candidateGenes.map((cg) => (
                        <div key={cg.geneSymbol} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                          <div className="flex items-center justify-between gap-2 text-xs" dir="ltr">
                            <div className="flex items-center gap-2.5">
                              <span className="font-mono text-[#7E6174]">#{cg.rank}</span>
                              <button
                                type="button"
                                onClick={() => onSelectBenchmark(cg.geneSymbol)}
                                className="font-mono font-semibold text-[#F472B6] hover:underline cursor-pointer"
                              >
                                {cg.geneSymbol}
                              </button>
                              <span className="text-[#A98CA0]">· {cg.predictedDirection}</span>
                            </div>
                            <span className="font-mono tabular-nums text-[#EC4899]">
                              SHAP {cg.shapScore.toFixed(3)}
                            </span>
                          </div>
                          <p className="text-xs text-[#A98CA0] leading-relaxed">
                            {cg.selectionRationale}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#A98CA0] leading-relaxed">
                      {modules.explainableMl.shapRationale}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-md border border-[#311C33] bg-[#110A11] p-5 space-y-4">
              <div className="space-y-1 border-b border-[#311C33] pb-3">
                <div className="font-mono text-xs uppercase tracking-wider text-[#F472B6]">
                  {copy.dashboard.wetLabTitle}
                </div>
                <h3 className="font-display text-base font-semibold text-[#FAF2F7]">
                  {modules.explainableMl.hypothesis.title}
                </h3>
              </div>

              <p className="text-sm text-[#FAF2F7] leading-relaxed">
                {modules.explainableMl.hypothesis.testableStatement}
              </p>

              <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-1 text-xs">
                <div className="space-y-1">
                  <dt className="font-mono uppercase tracking-wider text-[#A98CA0]">
                    Model System
                  </dt>
                  <dd className="text-[#DFCBD8] leading-relaxed">
                    {modules.explainableMl.hypothesis.targetModelSystem}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="font-mono uppercase tracking-wider text-[#A98CA0]">
                    Experimental Assay
                  </dt>
                  <dd className="text-[#DFCBD8] leading-relaxed">
                    {modules.explainableMl.hypothesis.experimentalAssay}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="font-mono uppercase tracking-wider text-[#A98CA0]">
                    Primary Readouts
                  </dt>
                  <dd className="text-[#DFCBD8] leading-relaxed">
                    {modules.explainableMl.hypothesis.primaryReadouts.join(' · ')}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="font-mono uppercase tracking-wider text-[#A98CA0]">
                    Expected Outcome
                  </dt>
                  <dd className="text-[#DFCBD8] leading-relaxed">
                    {modules.explainableMl.hypothesis.expectedOutcome}
                  </dd>
                </div>
              </dl>
            </div>
          </AccordionModule>
        </div>

        {/* BOTTOM REPORT EXPORT SECTION */}
        <footer className="rounded-md border border-[#311C33] bg-[#160D17] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-base font-semibold text-[#FAF2F7]">
              {copy.dashboard.exportFooterTitle}
            </h2>
            <p className="text-xs text-[#A98CA0] max-w-2xl leading-relaxed">
              {copy.dashboard.exportFooterSub}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0" dir="ltr">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#311C33] bg-[#110A11] px-3.5 py-2.5 text-xs font-medium text-[#DFCBD8] transition-colors hover:border-[#F472B6] hover:text-[#FAF2F7] whitespace-nowrap cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#F472B6]" aria-hidden="true" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copy Markdown</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onExportPdf(dossier)}
              className="inline-flex items-center gap-2 rounded-md bg-[#F472B6] px-5 py-2.5 text-xs font-semibold text-[#0B070B] transition-colors hover:bg-[#F9A8D4] whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"
            >
              <FileDown className="h-4 w-4" aria-hidden="true" />
              <span>{copy.dashboard.exportPdf}</span>
            </button>
          </div>
        </footer>
      </article>
    </div>
  );
}
