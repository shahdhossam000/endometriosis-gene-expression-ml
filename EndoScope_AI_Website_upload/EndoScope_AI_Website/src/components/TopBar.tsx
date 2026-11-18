import { Plus, ChevronDown } from 'lucide-react';
import type { AnalysisLanguage } from '../types/dossier';
import { UI_COPY } from '../utils/i18n';
import { DnaLogo } from './DnaLogo';

export type AppView = 'dossier' | 'compare' | 'history' | 'methodology';

interface TopBarProps {
  activeView: AppView;
  onSelectView: (view: AppView) => void;
  onNewQuery: () => void;
  language: AnalysisLanguage;
  isSideMenuOpen: boolean;
  onToggleSideMenu: () => void;
}

export function TopBar({
  activeView,
  onSelectView,
  onNewQuery,
  language,
  isSideMenuOpen,
  onToggleSideMenu,
}: TopBarProps) {
  const copy = UI_COPY[language].nav;
  const navItems: { id: AppView; label: string }[] = [
    { id: 'dossier', label: copy.dossier },
    { id: 'compare', label: copy.compare },
    { id: 'history', label: copy.history },
    { id: 'methodology', label: copy.methodology },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[#311C33] bg-[#0B070B]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-6 px-4 sm:px-6 py-3.5">
        {/* Zone 1: Top-left arrow dropdown trigger + DNA Brand Lockup */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleSideMenu}
            aria-expanded={isSideMenuOpen}
            aria-controls="top-left-side-dropdown"
            aria-label={isSideMenuOpen ? 'Close side menu' : 'Open side menu'}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] ${
              isSideMenuOpen
                ? 'border-[#F472B6] bg-[#261428] text-[#F472B6]'
                : 'border-[#311C33] bg-[#160D17] text-[#F472B6] hover:border-[#F472B6] hover:bg-[#1F1221]'
            }`}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-150 ${
                isSideMenuOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            onClick={() => onSelectView('dossier')}
            className="inline-flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-[#FAF2F7] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] rounded-sm"
          >
            <DnaLogo className="h-7 w-7 shrink-0" />
            <span>EndoScope Ai</span>
          </button>
        </div>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Primary workbench navigation"
          className="flex items-center gap-4 sm:gap-6 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden text-sm font-medium"
        >
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                className={`relative py-2 whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] rounded-sm ${
                  isActive
                    ? 'text-[#FAF2F7]'
                    : 'text-[#A98CA0] hover:text-[#FAF2F7]'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-[2px] bg-[#F472B6]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onNewQuery}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#F472B6] px-4 py-2 text-xs font-semibold text-[#0B070B] transition-colors duration-150 hover:bg-[#F9A8D4] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B070B]"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{copy.newAnalysis}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
