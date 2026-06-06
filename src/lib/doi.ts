// DOI lookup — pull a paper's title, authors, year, journal, and abstract from
// a DOI. Two CORS-friendly sources, in priority order:
//   1) Crossref — most accurate metadata; abstract when the publisher deposited one.
//   2) OpenAlex — broader abstract coverage (stored as an inverted index we rebuild).
// Ported from PaperCards. DOI-only input means we only ever see the ABSTRACT,
// so dissection from a DOI is abstract-depth (the app labels it as such).

export interface DoiFetchResult {
  doi: string;
  title?: string;
  authors?: string[];
  year?: number;
  abstract?: string;
  journal?: string;
  source: 'crossref' | 'openalex';
  hasAbstract: boolean;
}

const DOI_PATTERN = /10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/;

export function normalizeDoi(input: string): string | null {
  if (!input) return null;
  const m = input.trim().match(DOI_PATTERN);
  return m ? m[0].replace(/[.,;]+$/, '') : null;
}

function stripMarkup(s?: string): string | undefined {
  if (!s) return undefined;
  return s
    .replace(/<jats:title[^>]*>.*?<\/jats:title>/gi, ' ')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

interface CrossrefAuthor { family?: string; given?: string; name?: string }
interface CrossrefDateParts { 'date-parts'?: number[][] }
interface CrossrefWork {
  title?: string[];
  author?: CrossrefAuthor[];
  abstract?: string;
  'container-title'?: string[];
  published?: CrossrefDateParts;
  'published-print'?: CrossrefDateParts;
  'published-online'?: CrossrefDateParts;
  issued?: CrossrefDateParts;
  created?: CrossrefDateParts;
}

function pickYear(w: CrossrefWork): number | undefined {
  const slots = [w.published, w['published-print'], w['published-online'], w.issued, w.created];
  for (const s of slots) {
    const y = s?.['date-parts']?.[0]?.[0];
    if (typeof y === 'number') return y;
  }
  return undefined;
}

async function tryCrossref(doi: string): Promise<DoiFetchResult | null> {
  try {
    const r = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!r.ok) return null;
    const j = await r.json() as { message?: CrossrefWork };
    const w = j.message;
    if (!w) return null;
    const authors = (w.author || [])
      .map((a) => a.family ? `${a.family}${a.given ? ', ' + a.given.split(/\s+/).map((p: string) => p.charAt(0).toUpperCase() + '.').join(' ') : ''}` : (a.name || ''))
      .filter(Boolean);
    const abstract = stripMarkup(w.abstract);
    return {
      doi,
      title: (w.title || [])[0],
      authors: authors.length ? authors : undefined,
      year: pickYear(w),
      abstract,
      journal: (w['container-title'] || [])[0],
      source: 'crossref',
      hasAbstract: !!abstract && abstract.length > 50,
    };
  } catch { return null; }
}

interface OpenAlexAuthorship { author?: { display_name?: string } }
interface OpenAlexWork {
  title?: string;
  authorships?: OpenAlexAuthorship[];
  publication_year?: number;
  abstract_inverted_index?: Record<string, number[]>;
  primary_topic?: { display_name?: string };
  host_venue?: { display_name?: string };
  primary_location?: { source?: { display_name?: string } };
}

export function invertedIndexToText(idx?: Record<string, number[]>): string | undefined {
  if (!idx) return undefined;
  const slots: { word: string; pos: number }[] = [];
  for (const [word, ps] of Object.entries(idx)) {
    for (const p of ps) slots.push({ word, pos: p });
  }
  if (!slots.length) return undefined;
  slots.sort((a, b) => a.pos - b.pos);
  return slots.map(s => s.word).join(' ');
}

async function tryOpenAlex(doi: string): Promise<DoiFetchResult | null> {
  try {
    const r = await fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!r.ok) return null;
    const j = await r.json() as OpenAlexWork;
    const authors = (j.authorships || []).map((a) => a.author?.display_name).filter((s): s is string => !!s);
    const abstract = invertedIndexToText(j.abstract_inverted_index);
    return {
      doi,
      title: j.title,
      authors: authors.length ? authors : undefined,
      year: j.publication_year,
      abstract,
      journal: j.host_venue?.display_name || j.primary_location?.source?.display_name || j.primary_topic?.display_name,
      source: 'openalex',
      hasAbstract: !!abstract && abstract.length > 50,
    };
  } catch { return null; }
}

export async function fetchDoi(input: string): Promise<DoiFetchResult> {
  const doi = normalizeDoi(input);
  if (!doi) throw new Error('That doesn\'t look like a DOI. Try "10.1037/0021-9010.92.5.1206" or a doi.org URL.');

  const cr = await tryCrossref(doi);
  if (cr?.hasAbstract) return cr;
  const oa = await tryOpenAlex(doi);
  if (oa?.hasAbstract) {
    return cr ? { ...cr, abstract: oa.abstract, hasAbstract: true } : oa;
  }
  if (cr) return cr;
  if (oa) return oa;
  throw new Error('DOI looked valid but neither Crossref nor OpenAlex returned a record. Check the DOI and try again.');
}
