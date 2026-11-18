import { useState, type FormEvent } from 'react';
import { Search, ArrowRight, Loader2, X } from 'lucide-react';
import type { AnalysisLanguage, LesionCompartment } from '../types/dossier';
import { UI_COPY } from '../utils/i18n';

export interface BenchmarkTarget {
  symbol: string;
  axis: string;
}

export const BENCHMARK_TARGETS: BenchmarkTarget[] = [
  { symbol: 'LYVE1', axis: 'Lymphangiogenesis & Perivascular Macrophages' },
  { symbol: 'VEGFA', axis: 'Neo-vascularization & Hypoxic Stromal Niche' },
  { symbol: 'CCL19', axis: 'Lymphoid Chemokine & Immune Recruitment' },
  { symbol: 'COL1A1', axis: 'Myofibroblast ECM Remodeling & Fibrosis' },
  { symbol: 'ESR1', axis: 'Estrogen Receptor & Progesterone Resistance' },
  { symbol: 'MMP9', axis: 'Matrix Proteolysis & Ectopic Invasion' },
];

export const LESION_COMPARTMENTS: LesionCompartment[] = [
  'All Compartments',
  'Peritoneal Ectopic',
  'Ovarian Endometrioma',
  'Deep Infiltrating Endometriosis',
  'Eutopic Endometrium',
];

interface ResearchRailProps {
  isOpen: boolean;
  onClose: () => void;
  queryInput: string;
  onQueryInputChange: (value: string) => void;
  compartment: LesionCompartment;
  onCompartmentChange: (value: LesionCompartment) => void;
  language: AnalysisLanguage;
  onLanguageChange: (lang: AnalysisLanguage) => void;
  onSubmitQuery: (query: string, compartment: LesionCompartment, lang: AnalysisLanguage) => void;
  isLoading: boolean;
  hasActiveDossier: boolean;
  showModuleNav: boolean;
  activeModuleId: string;
  onJumpToModule: (id: string) => void;
}

export function ResearchRail({
  isOpen,
  onClose,
  queryInput,
  onQueryInputChange,
  compartment,
  onCompartmentChange,
  language,
  onLanguageChange,
  onSubmitQuery,
  isLoading,
  hasActiveDossier,
  showModuleNav,
  activeModuleId,
  onJumpToModule,
}: ResearchRailProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const copy = UI_COPY[language].rail;
  const modCopy = UI_COPY[language].modules;

  const moduleAnchors = [
    { id: 'module-cell-atlas', index: '01', title: modCopy.m1Title.replace(/^01\.\s*/, '') },
    { id: 'module-gene-explorer', index: '02', title: modCopy.m2Title.replace(/^02\.\s*/, '') },
    { id: 'module-pathways', index: '03', title: modCopy.m3Title.replace(/^03\.\s*/, '') },
    { id: 'module-cell-comm', index: '04', title: modCopy.m4Title.replace(/^04\.\s*/, '') },
    { id: 'module-explainable-ml', index: '05', title: modCopy.m5Title.replace(/^05\.\s*/, '') },
  ];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = queryInput.trim();
    if (trimmed.length < 2) {
      setValidationError(copy.validationError);
      return;
    }
    setValidationError(null);
    onSubmitQuery(trimmed, compartment, language);
    onClose();
  };

  return (
    <>
      {/* Click-away backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-30 bg-[#0B070B]/60 backdrop-blur-[1px]"
      />

      {/* Top-Left Dropdown Side Menu */}
      <aside
        id="top-left-side-dropdown"
        aria-label="Research controls and modules menu"
        className="fixed top-[64px] left-4 sm:left-6 z-40 w-[calc(100vw-2rem)] sm:w-[340px] max-h-[calc(100vh-80px)] overflow-y-auto rounded-md border border-[#311C33] bg-[#110A11] shadow-2xl"
      >
        <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-5 space-y-6">
          <div className="flex items-center justify-between border-b border-[#311C33] pb-3" dir="ltr">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#F472B6]">
              EndoScope Ai Menu
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close side menu"
              className="rounded p-1 text-[#A98CA0] hover:bg-[#1F1221] hover:text-[#FAF2F7] cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {hasActiveDossier && showModuleNav && (
            <div className="space-y-2 border-b border-[#311C33] pb-5">
              <h2 className="text-xs font-medium tracking-wider uppercase text-[#A98CA0]">
                {copy.modulesTitle}
              </h2>
              <nav aria-label="Dashboard modules" className="space-y-1">
                {moduleAnchors.map((mod) => {
                  const isActive = activeModuleId === mod.id;
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => {
                        onJumpToModule(mod.id);
                        onClose();
                      }}
                      className={`flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-xs transition-colors duration-150 cursor-pointer ${
                        isActive
                          ? 'bg-[#261428] text-[#FAF2F7] border border-[#EC4899]/50'
                          : 'text-[#C8B0BF] hover:text-[#FAF2F7] hover:bg-[#1A0E1B] border border-transparent'
                      }`}
                    >
                      <span className="font-mono text-[11px] text-[#F472B6] shrink-0">
                        {mod.index}
                      </span>
                      <span className="truncate font-medium">{mod.title}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="gene-query-input"
                className="block text-xs font-medium tracking-wider uppercase text-[#A98CA0] mb-2"
              >
                {copy.geneLabel}
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7E6174]"
                  aria-hidden="true"
                />
                <input
                  id="gene-query-input"
                  type="text"
                  dir="ltr"
                  value={queryInput}
                  onChange={(e) => {
                    onQueryInputChange(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder={copy.genePlaceholder}
                  disabled={isLoading}
                  className="w-full rounded-md border border-[#311C33] bg-[#160D17] py-2.5 pl-9 pr-3 font-mono text-sm text-[#FAF2F7] placeholder-[#7E6174] transition-colors focus:border-[#F472B6] focus:outline-none disabled:opacity-60"
                />
              </div>
              {validationError && (
                <p className="mt-1.5 text-xs text-[#FB7185]">{validationError}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="lesion-compartment-select"
                className="block text-xs font-medium tracking-wider uppercase text-[#A98CA0] mb-2"
              >
                {copy.compartmentLabel}
              </label>
              <select
                id="lesion-compartment-select"
                dir="ltr"
                value={compartment}
                onChange={(e) => onCompartmentChange(e.target.value as LesionCompartment)}
                disabled={isLoading}
                className="w-full rounded-md border border-[#311C33] bg-[#160D17] px-3 py-2.5 text-sm text-[#FAF2F7] transition-colors focus:border-[#F472B6] focus:outline-none disabled:opacity-60"
              >
                {LESION_COMPARTMENTS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="block text-xs font-medium tracking-wider uppercase text-[#A98CA0] mb-2">
                {copy.languageLabel}
              </div>
              <div className="grid grid-cols-2 gap-1 rounded-md border border-[#311C33] bg-[#160D17] p-1" dir="ltr">
                <button
                  type="button"
                  onClick={() => onLanguageChange('en')}
                  className={`rounded px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    language === 'en'
                      ? 'bg-[#311C33] text-[#FAF2F7]'
                      : 'text-[#A98CA0] hover:text-[#FAF2F7]'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => onLanguageChange('ar')}
                  className={`rounded px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    language === 'ar'
                      ? 'bg-[#311C33] text-[#FAF2F7]'
                      : 'text-[#A98CA0] hover:text-[#FAF2F7]'
                  }`}
                >
                  العربية (Arabic)
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-[#F472B6] px-4 py-2.5 text-sm font-semibold text-[#0B070B] transition-colors duration-150 hover:bg-[#F9A8D4] disabled:cursor-not-allowed disabled:bg-[#311C33] disabled:text-[#7E6174] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>{copy.compiling}</span>
                </>
              ) : (
                <>
                  <span>{copy.runAnalysis}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          <div className="border-t border-[#311C33] pt-5">
            <h2 className="text-xs font-medium tracking-wider uppercase text-[#A98CA0] mb-3">
              {copy.referenceTargets}
            </h2>
            <div className="space-y-1.5">
              {BENCHMARK_TARGETS.map((target) => (
                <button
                  key={target.symbol}
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    onQueryInputChange(target.symbol);
                    setValidationError(null);
                    onSubmitQuery(target.symbol, compartment, language);
                    onClose();
                  }}
                  className="group flex w-full items-start justify-between gap-3 rounded-md border border-transparent px-2.5 py-2 text-left transition-colors duration-150 hover:border-[#311C33] hover:bg-[#160D17] disabled:opacity-50 cursor-pointer"
                  dir="ltr"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-semibold text-[#F472B6] group-hover:text-[#F9A8D4]">
                      {target.symbol}
                    </div>
                    <div className="truncate text-xs text-[#A98CA0] mt-0.5">
                      {target.axis}
                    </div>
                  </div>
                  <ArrowRight
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7E6174] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[#F472B6]"
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
