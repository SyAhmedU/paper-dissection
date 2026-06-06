// Paper Dissection Workshop — core types.
//
// We take a paper (PDF upload, pasted full text, or a DOI) and dissect it into
// FACETS — the constituent parts every empirical paper has: the theory it uses,
// its design, sample, measures, analysis techniques, software, findings, and so
// on. Each facet holds a list of extracted items.
//
// NO-FABRICATION (suite-wide hard rule, see feedback-ai-extraction-verbatim):
// every item is extracted ONLY from the supplied text. Items carry a short
// verbatim `evidence` snippet copied from the paper; the client verifies that
// snippet actually appears in the source and flags any that don't. Numbers are
// kept only when they appear verbatim. DOI-only input gives ABSTRACT-DEPTH
// dissection (clearly labelled), not a pretend full-text dissection.

export type FacetKey =
  | 'theory'
  | 'constructs'
  | 'hypotheses'
  | 'design'
  | 'sample'
  | 'measures'
  | 'analysis'
  | 'software'
  | 'data'
  | 'findings'
  | 'contributions'
  | 'limitations'
  | 'future';

// A suite deep-link target for a facet item (e.g. theory → TheoryScope).
export interface FacetLink {
  tool: 'theoryscope' | 'scalescope' | 'toolsscope';
  arg: string;
}

export interface FacetItem {
  text: string;          // the extracted item, e.g. "Job Demands–Resources theory", "Structural equation modeling"
  detail?: string;       // optional elaboration: role, reported value, version, etc. (numbers must be verbatim)
  evidence?: string;     // short snippet copied verbatim from the paper supporting this item
  verified?: boolean;    // true when `evidence` was found in the source text (grounding check)
}

export interface Dissection {
  id: string;
  // Bibliographic — from DOI metadata (Crossref/OpenAlex) or the paper's first page.
  title: string;
  authors?: string[];
  year?: number;
  journal?: string;
  doi?: string;
  // Provenance + honesty about depth.
  source: 'pdf' | 'text' | 'doi';
  depth: 'full-text' | 'abstract';
  extractedBy: 'ai' | 'heuristic';
  extractedAt: string;   // ISO
  textLen: number;       // characters of source text the dissection saw
  // The dissection itself — one list of items per facet.
  facets: Record<FacetKey, FacetItem[]>;
  // Extraction caveats / notes shown on the card.
  notes?: string[];
}

// Just the fields the AI is expected to produce (Dissection minus bookkeeping).
export interface ExtractedDissection {
  title?: string;
  authors?: string[];
  year?: number;
  journal?: string;
  facets: Partial<Record<FacetKey, FacetItem[]>>;
  notes?: string[];
}

// ── Facet metadata — single source of truth for label, icon, colour, order,
// whether it belongs on the timeline swimlanes / matrix columns, and which
// suite tool an item deep-links to. ───────────────────────────────────────
export interface FacetMeta {
  key: FacetKey;
  label: string;
  icon: string;
  color: string;
  blurb: string;            // one-line description of what goes here
  inTimeline: boolean;      // categorical facets that read well as lanes × year
  inMatrix: boolean;        // columns of the cross-paper synthesis matrix
  link?: FacetLink['tool']; // suite tool this facet's items can deep-link to
}

export const FACETS: FacetMeta[] = [
  { key: 'theory',        label: 'Theory used',     icon: '🏛', color: '#9270F4', blurb: 'Theoretical frameworks the paper builds on', inTimeline: true,  inMatrix: true,  link: 'theoryscope' },
  { key: 'constructs',    label: 'Constructs',      icon: '🔵', color: '#2e6cf6', blurb: 'Variables measured or manipulated (IV/DV/mediator/moderator)', inTimeline: false, inMatrix: true },
  { key: 'hypotheses',    label: 'Hypotheses',      icon: '❓', color: '#ec4899', blurb: 'Stated hypotheses or propositions', inTimeline: false, inMatrix: false },
  { key: 'design',        label: 'Design / method', icon: '🧪', color: '#F14575', blurb: 'Research design (experiment, survey, qualitative, mixed, meta-analysis…)', inTimeline: true, inMatrix: true },
  { key: 'sample',        label: 'Sample',          icon: '👥', color: '#FF9656', blurb: 'Who/what was studied — N, population, country, sampling', inTimeline: false, inMatrix: true },
  { key: 'measures',      label: 'Measures',        icon: '📏', color: '#22d3ee', blurb: 'Instruments / scales used to operationalise constructs', inTimeline: true, inMatrix: true, link: 'scalescope' },
  { key: 'analysis',      label: 'Analysis',        icon: '📊', color: '#1b8a5a', blurb: 'Analysis techniques (regression, SEM, ANOVA, thematic analysis…)', inTimeline: true, inMatrix: true, link: 'toolsscope' },
  { key: 'software',      label: 'Software / tools', icon: '💻', color: '#c97a1a', blurb: 'Software used (SPSS, R, AMOS, Mplus, NVivo, Stata…)', inTimeline: true, inMatrix: true },
  { key: 'data',          label: 'Data',            icon: '🗃', color: '#64748b', blurb: 'Data type/source (primary/secondary, cross-sectional/longitudinal, archival…)', inTimeline: false, inMatrix: true },
  { key: 'findings',      label: 'Key findings',    icon: '💡', color: '#f59e0b', blurb: 'Main results the paper reports', inTimeline: false, inMatrix: false },
  { key: 'contributions', label: 'Contributions',   icon: '➕', color: '#10b981', blurb: 'Stated theoretical/practical contributions', inTimeline: false, inMatrix: false },
  { key: 'limitations',   label: 'Limitations',     icon: '⚠️', color: '#dc2626', blurb: 'Limitations the paper acknowledges', inTimeline: false, inMatrix: false },
  { key: 'future',        label: 'Future research', icon: '🔮', color: '#6366f1', blurb: 'Future directions the paper proposes', inTimeline: false, inMatrix: false },
];

export const FACET_BY_KEY: Record<FacetKey, FacetMeta> =
  Object.fromEntries(FACETS.map(f => [f.key, f])) as Record<FacetKey, FacetMeta>;

export const FACET_KEYS: FacetKey[] = FACETS.map(f => f.key);

// Build a suite deep-link URL for a facet item (real ?param handoff contracts).
const TOOL_BASE: Record<FacetLink['tool'], { base: string; param: string }> = {
  theoryscope:  { base: 'https://theoryscope.vercel.app/',  param: 'q' },
  scalescope:   { base: 'https://scalescope.vercel.app/',   param: 'q' },
  toolsscope:   { base: 'https://toolsscope.vercel.app/',   param: 'plan' },
};

export function facetItemLink(facet: FacetKey, item: FacetItem): string | null {
  const tool = FACET_BY_KEY[facet].link;
  if (!tool) return null;
  const c = TOOL_BASE[tool];
  return `${c.base}?${c.param}=${encodeURIComponent(item.text)}`;
}

export function emptyFacets(): Record<FacetKey, FacetItem[]> {
  const o = {} as Record<FacetKey, FacetItem[]>;
  for (const k of FACET_KEYS) o[k] = [];
  return o;
}
