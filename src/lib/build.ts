// Shared dissection builder — turns source text + (optional) real bibliographic
// metadata into a saved Dissection. Used by every input path (PDF, paste, DOI,
// journal). Bibliographic facts passed in `meta` (from a real DOI/OpenAlex
// record) win over anything the AI inferred.

import type { Dissection } from './types';
import { newId } from './store';
import { dissect } from './extract';

export async function buildDissection(opts: {
  text: string;
  source: Dissection['source'];
  depth: Dissection['depth'];
  meta?: { title?: string; authors?: string[]; year?: number; journal?: string; doi?: string };
  titleGuess?: string;
}): Promise<Dissection> {
  const res = await dissect({ text: opts.text, title: opts.meta?.title || opts.titleGuess, depth: opts.depth });
  return {
    id: newId(),
    title: opts.meta?.title || res.title || opts.titleGuess || 'Untitled paper',
    authors: opts.meta?.authors || res.authors,
    year: opts.meta?.year ?? res.year,
    journal: opts.meta?.journal || res.journal,
    doi: opts.meta?.doi,
    source: opts.source,
    depth: opts.depth,
    extractedBy: res.source,
    extractedAt: new Date().toISOString(),
    textLen: opts.text.length,
    facets: res.facets,
    notes: res.notes,
  };
}
