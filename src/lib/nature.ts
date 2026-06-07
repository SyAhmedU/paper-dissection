// Nature-of-study classification + a probable time-flow estimate.
//
// natureOf() classifies a dissection into one high-level methodology class by
// reading the design/analysis/data facets we ALREADY extracted — it categorises
// what's there, it doesn't invent anything. The AI may also set `nature`; if so
// we trust it. estimateTimeFlow() returns a phased planning timeline keyed to
// the nature — these are HEURISTIC planning estimates, clearly labelled in the
// UI as "estimated, not from the paper".

import type { Dissection, FacetItem, StudyNature } from './types';

export interface NatureMeta { key: StudyNature; label: string; icon: string; color: string; }

export const NATURES: NatureMeta[] = [
  { key: 'quantitative',  label: 'Quantitative',           icon: '📊', color: '#1b8a5a' },
  { key: 'qualitative',   label: 'Qualitative',            icon: '💬', color: '#9270F4' },
  { key: 'mixed-methods', label: 'Mixed methods',          icon: '🔀', color: '#F14575' },
  { key: 'case-report',   label: 'Case report',            icon: '🩺', color: '#FF9656' },
  { key: 'review',        label: 'Review / meta-analysis', icon: '📚', color: '#2e6cf6' },
  { key: 'theoretical',   label: 'Theoretical',            icon: '🏛', color: '#c97a1a' },
  { key: 'other',         label: 'Other / unclear',        icon: '❔', color: '#64748b' },
];
export const NATURE_BY_KEY: Record<StudyNature, NatureMeta> =
  Object.fromEntries(NATURES.map(n => [n.key, n])) as Record<StudyNature, NatureMeta>;

const RE_REVIEW = /\bmeta-?analys|systematic review|scoping review|literature review|narrative review|umbrella review|rapid review\b/i;
const RE_CASE   = /\bcase report|case series\b/i;
const RE_QUAL   = /\bqualitative|thematic analysis|grounded theory|ethnograph|phenomenolog|interview|focus group|content analysis|narrative inquiry|case study|discourse analysis\b/i;
const RE_QUANT  = /\bquantitative|survey|experiment|regression|ANOVA|t-?test|\bSEM\b|correlation|cross-?sectional|longitudinal|cohort|\bRCT\b|randomi[sz]ed|statistical|questionnaire|psychometric\b/i;
const RE_THEORY = /\bconceptual|theoretical (paper|framework|model|contribution)|position paper|essay|commentary|viewpoint\b/i;
const RE_LONGITUDINAL = /\blongitudinal|cohort|follow-?up|multi-?wave|\bwave\b|diary study|experience sampling|panel data\b/i;

function facetText(d: Dissection): string {
  const pick = (k: 'design' | 'analysis' | 'data' | 'sample') => (d.facets[k] || []).map((it: FacetItem) => `${it.text} ${it.detail || ''}`).join(' ');
  return `${pick('design')} ${pick('analysis')} ${pick('data')} ${pick('sample')}`.toLowerCase();
}

export function natureOf(d: Dissection): StudyNature {
  if (d.nature) return d.nature;
  const t = facetText(d);
  if (!t.trim()) return 'other';
  if (RE_REVIEW.test(t)) return 'review';
  if (RE_CASE.test(t) && !RE_QUANT.test(t)) return 'case-report';
  const qual = RE_QUAL.test(t), quant = RE_QUANT.test(t);
  if (qual && quant) return 'mixed-methods';
  if (qual) return 'qualitative';
  if (quant) return 'quantitative';
  if (RE_THEORY.test(t)) return 'theoretical';
  return 'other';
}

// ── Probable time-flow (planning estimate) ─────────────────────────
export interface Phase { phase: string; weeks: number; }

const FLOWS: Record<StudyNature, Phase[]> = {
  quantitative: [
    { phase: 'Design & instruments', weeks: 3 },
    { phase: 'Ethics approval', weeks: 4 },
    { phase: 'Recruitment & data collection', weeks: 8 },
    { phase: 'Cleaning & analysis', weeks: 3 },
    { phase: 'Writing & revision', weeks: 6 },
  ],
  qualitative: [
    { phase: 'Design', weeks: 3 },
    { phase: 'Ethics approval', weeks: 4 },
    { phase: 'Sampling & fieldwork', weeks: 10 },
    { phase: 'Transcription & coding', weeks: 8 },
    { phase: 'Writing & revision', weeks: 6 },
  ],
  'mixed-methods': [
    { phase: 'Design', weeks: 4 },
    { phase: 'Ethics approval', weeks: 4 },
    { phase: 'Data collection (quant + qual)', weeks: 12 },
    { phase: 'Analysis (both strands)', weeks: 8 },
    { phase: 'Integration & writing', weeks: 7 },
  ],
  'case-report': [
    { phase: 'Case identification', weeks: 1 },
    { phase: 'Consent', weeks: 1 },
    { phase: 'Record compilation', weeks: 2 },
    { phase: 'Literature & writing', weeks: 3 },
  ],
  review: [
    { phase: 'Protocol & registration', weeks: 3 },
    { phase: 'Search & screening', weeks: 8 },
    { phase: 'Data extraction', weeks: 6 },
    { phase: 'Synthesis', weeks: 4 },
    { phase: 'Writing & revision', weeks: 6 },
  ],
  theoretical: [
    { phase: 'Conceptual development', weeks: 4 },
    { phase: 'Literature integration', weeks: 6 },
    { phase: 'Argument & writing', weeks: 6 },
  ],
  other: [
    { phase: 'Planning', weeks: 4 },
    { phase: 'Data & analysis', weeks: 10 },
    { phase: 'Writing', weeks: 6 },
  ],
};

export interface TimeFlow { nature: StudyNature; phases: Phase[]; totalWeeks: number; longitudinal: boolean; }

export function estimateTimeFlow(d: Dissection): TimeFlow {
  const nature = natureOf(d);
  const longitudinal = RE_LONGITUDINAL.test(facetText(d));
  let phases = FLOWS[nature].map(p => ({ ...p }));
  // A longitudinal/cohort design stretches the data-collection window.
  if (longitudinal) phases = phases.map(p => /collection|fieldwork/i.test(p.phase) ? { ...p, weeks: p.weeks + 20 } : p);
  const totalWeeks = phases.reduce((s, p) => s + p.weeks, 0);
  return { nature, phases, totalWeeks, longitudinal };
}

export function weeksLabel(weeks: number): string {
  const months = weeks / 4.345;
  return months >= 1 ? `~${Math.round(months)} month${Math.round(months) === 1 ? '' : 's'} (${weeks}w)` : `${weeks}w`;
}

export function isStudyNature(s: unknown): s is StudyNature {
  return typeof s === 'string' && NATURES.some(n => n.key === s);
}
