import type { GeneAnalysisDossier } from '../types/dossier';

const STORAGE_KEY = 'endoatlas_dossier_history_v1';
const MAX_HISTORY_ITEMS = 40;

export function loadSavedDossiers(): GeneAnalysisDossier[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GeneAnalysisDossier[]) : [];
  } catch {
    return [];
  }
}

export function saveDossierToHistory(dossier: GeneAnalysisDossier): GeneAnalysisDossier[] {
  const existing = loadSavedDossiers();
  const filtered = existing.filter((item) => item.id !== dossier.id);
  const next = [dossier, ...filtered].slice(0, MAX_HISTORY_ITEMS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota errors cleanly
  }
  return next;
}

export function deleteDossierFromHistory(id: string): GeneAnalysisDossier[] {
  const existing = loadSavedDossiers();
  const next = existing.filter((item) => item.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors cleanly
  }
  return next;
}

export function clearAllDossiers(): GeneAnalysisDossier[] {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors cleanly
  }
  return [];
}
