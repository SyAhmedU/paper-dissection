// Persistence — all client-side in localStorage. A dissection corpus is just
// an array of Dissection objects; the timeline and matrix views read from it.

import type { Dissection } from './types';

const KEY = 'pdw_dissections_v1';

export function loadAll(): Dissection[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr as Dissection[] : [];
  } catch { return []; }
}

export function saveAll(list: Dissection[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* quota / private mode */ }
}

export function addDissection(d: Dissection): Dissection[] {
  const list = loadAll();
  const next = [d, ...list.filter(x => x.id !== d.id)];
  saveAll(next);
  return next;
}

export function removeDissection(id: string): Dissection[] {
  const next = loadAll().filter(d => d.id !== id);
  saveAll(next);
  return next;
}

export function clearAll(): void { saveAll([]); }

export function newId(): string {
  return 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
