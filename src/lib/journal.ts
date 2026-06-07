// Journal lookup — find a journal on OpenAlex, then list its real published
// articles so the user can pick which to dissect. Pure OpenAlex (anonymous,
// CORS). NOTHING is invented: each suggestion is a real OpenAlex source and
// each article is a real indexed work (title/authors/year/DOI/abstract come
// straight from the record). Abstracts arrive as an inverted index we rebuild.

import { invertedIndexToText, normalizeDoi } from './doi';

const OA = 'https://api.openalex.org';

export interface JournalOption {
  id: string;        // OpenAlex source id (S…)
  name: string;
  hint?: string;     // publisher / "ISSN …" etc.
}

export interface JournalArticle {
  oaId: string;
  title: string;
  authors: string[];
  year?: number;
  doi?: string;
  abstract?: string;
  citedBy: number;
}

export type JournalSort = 'date' | 'citations';

function oaShort(url?: string | null): string {
  if (!url) return '';
  const m = url.match(/[A-Z]\d+$/);
  return m ? m[0] : url;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    return await r.json() as T;
  } catch { return null; }
}

// Type-ahead over OpenAlex journals/sources.
export async function suggestJournals(q: string): Promise<JournalOption[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const res = await getJson<{ results?: { id?: string; display_name?: string; hint?: string }[] }>(
    `${OA}/autocomplete/sources?q=${encodeURIComponent(query)}`,
  );
  return (res?.results || [])
    .filter(r => r.id && r.display_name)
    .map(r => ({ id: oaShort(r.id), name: r.display_name as string, hint: r.hint || undefined }));
}

interface OAWork {
  id?: string;
  title?: string;
  display_name?: string;
  publication_year?: number;
  doi?: string;
  cited_by_count?: number;
  authorships?: { author?: { display_name?: string } }[];
  abstract_inverted_index?: Record<string, number[]>;
}

export interface JournalArticlesResult { articles: JournalArticle[]; total: number; }

// List real articles from a journal (OpenAlex source id), newest or most-cited.
export async function fetchJournalArticles(
  sourceId: string,
  opts: { sort?: JournalSort; perPage?: number } = {},
): Promise<JournalArticlesResult> {
  const sort = opts.sort === 'citations' ? 'cited_by_count:desc' : 'publication_date:desc';
  const select = 'id,title,display_name,publication_year,doi,cited_by_count,authorships,abstract_inverted_index';
  const url = `${OA}/works?filter=primary_location.source.id:${encodeURIComponent(sourceId)}`
    + `&sort=${sort}&per_page=${opts.perPage ?? 25}&select=${select}`;
  const res = await getJson<{ results?: OAWork[]; meta?: { count?: number } }>(url);
  const articles = (res?.results || []).map((w): JournalArticle => ({
    oaId: oaShort(w.id),
    title: w.title || w.display_name || 'Untitled',
    authors: (w.authorships || []).map(a => a.author?.display_name).filter((s): s is string => !!s),
    year: w.publication_year,
    doi: w.doi ? (normalizeDoi(w.doi) || undefined) : undefined,
    abstract: invertedIndexToText(w.abstract_inverted_index),
    citedBy: w.cited_by_count ?? 0,
  }));
  return { articles, total: res?.meta?.count ?? articles.length };
}
