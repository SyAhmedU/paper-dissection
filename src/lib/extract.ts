// Dissection extraction. Calls /api/dissect (Groq) and applies a strict
// no-fabrication guard to whatever comes back; falls back to a deterministic
// regex dissector when the AI endpoint is unavailable (no key / network).
//
// Grounding (see feedback-ai-extraction-verbatim): every extracted item should
// carry a short `evidence` snippet copied from the paper. The client checks
// that the snippet actually occurs in the source text and marks the item
// verified / unverified accordingly — so the card can show, and dim, anything
// the source doesn't back. Numbers inside `detail` are kept only when they
// appear verbatim in the text.

import type { FacetKey, FacetItem, ExtractedDissection } from './types';
import { FACET_KEYS, emptyFacets } from './types';
import { norm, evidenceFound, guardNumbersInDetail } from './guards';

export interface ExtractInput {
  text: string;
  title?: string;
  depth: 'full-text' | 'abstract';
}

export interface ExtractResult {
  title?: string;
  authors?: string[];
  year?: number;
  journal?: string;
  facets: Record<FacetKey, FacetItem[]>;
  notes: string[];
  source: 'ai' | 'heuristic';
}

// ── Normalisation + grounding of AI output ─────────────────────────
function normaliseFacets(raw: Partial<Record<FacetKey, FacetItem[]>>, text: string): {
  facets: Record<FacetKey, FacetItem[]>;
  unverified: number;
} {
  const normText = norm(text);
  const out = emptyFacets();
  let unverified = 0;
  for (const key of FACET_KEYS) {
    const items = raw[key];
    if (!Array.isArray(items)) continue;
    const seen = new Set<string>();
    for (const it of items) {
      const itemText = (it?.text ?? '').toString().trim();
      if (!itemText) continue;
      const dedupe = itemText.toLowerCase();
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      const evidence = (it?.evidence ?? '').toString().trim().slice(0, 300) || undefined;
      const verified = evidence ? evidenceFound(evidence, normText) : false;
      if (!verified) unverified++;
      const detailRaw = (it?.detail ?? '').toString().trim();
      const detail = detailRaw ? guardNumbersInDetail(detailRaw, text).slice(0, 280) : undefined;
      out[key].push({ text: itemText.slice(0, 240), detail, evidence, verified });
    }
  }
  return { facets: out, unverified };
}

// ── Public entry point ─────────────────────────────────────────────
export async function dissect(input: ExtractInput): Promise<ExtractResult> {
  const text = input.text.trim();
  if (!text) throw new Error('No text to dissect — upload a PDF, paste the paper, or fetch a DOI.');

  try {
    const r = await fetch('/api/dissect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 24000), title: input.title || '', depth: input.depth }),
    });
    if (r.ok) {
      const data = await r.json() as { dissection: ExtractedDissection | null; _source?: string };
      const d = data.dissection;
      if (d && d.facets && typeof d.facets === 'object') {
        const { facets, unverified } = normaliseFacets(d.facets, text);
        const total = FACET_KEYS.reduce((n, k) => n + facets[k].length, 0);
        if (total > 0) {
          const notes: string[] = Array.isArray(d.notes) ? d.notes.slice(0, 5) : [];
          notes.unshift('AI-extracted from the source text — verify against the paper before citing.');
          if (unverified > 0) notes.push(`${unverified} item(s) could not be matched to a verbatim snippet in the text and are flagged "unverified".`);
          if (input.depth === 'abstract') notes.push('Abstract-depth only: dissected from the abstract, not the full paper.');
          return {
            title: d.title?.trim() || input.title,
            authors: Array.isArray(d.authors) ? d.authors : undefined,
            year: typeof d.year === 'number' ? d.year : undefined,
            journal: d.journal?.trim() || undefined,
            facets, notes, source: 'ai',
          };
        }
      }
    }
  } catch { /* fall through to heuristic */ }

  return heuristicDissect(text, input);
}

// ── Deterministic heuristic fallback ───────────────────────────────
// No AI: scan for well-known design/analysis/software/data vocabulary. Every
// item it emits is, by construction, a verbatim match (it found the term in the
// text), so all heuristic items are `verified: true`. It cannot reliably read
// theory/measures/findings from prose, so those facets stay empty rather than
// being guessed at.
const VOCAB: { facet: FacetKey; label: string; re: RegExp }[] = [
  // design
  { facet: 'design', label: 'Meta-analysis', re: /\bmeta[- ]?analy/i },
  { facet: 'design', label: 'Randomized controlled trial', re: /\brandomi[sz]ed controlled trial|\bRCT\b/i },
  { facet: 'design', label: 'Experiment', re: /\bexperiment(?:al)?\b/i },
  { facet: 'design', label: 'Longitudinal', re: /\blongitudinal\b/i },
  { facet: 'design', label: 'Cross-sectional', re: /\bcross[- ]sectional\b/i },
  { facet: 'design', label: 'Survey', re: /\bsurvey\b/i },
  { facet: 'design', label: 'Diary / experience sampling', re: /\bdiary\b|\bexperience sampling\b/i },
  { facet: 'design', label: 'Mixed methods', re: /\bmixed[- ]methods?\b/i },
  { facet: 'design', label: 'Qualitative', re: /\bqualitative\b/i },
  { facet: 'design', label: 'Case study', re: /\bcase study\b/i },
  { facet: 'design', label: 'Ethnography', re: /\bethnograph/i },
  { facet: 'design', label: 'Interviews', re: /\binterview(s|ed|ing)?\b/i },
  { facet: 'design', label: 'Focus groups', re: /\bfocus groups?\b/i },
  // analysis
  { facet: 'analysis', label: 'Structural equation modeling', re: /\bstructural equation model|\bSEM\b/i },
  { facet: 'analysis', label: 'Confirmatory factor analysis', re: /\bconfirmatory factor analysis|\bCFA\b/i },
  { facet: 'analysis', label: 'Exploratory factor analysis', re: /\bexploratory factor analysis|\bEFA\b/i },
  { facet: 'analysis', label: 'Multilevel / HLM', re: /\bmultilevel\b|\bhierarchical linear model|\bHLM\b/i },
  { facet: 'analysis', label: 'Regression', re: /\bregression\b/i },
  { facet: 'analysis', label: 'ANOVA / ANCOVA / MANOVA', re: /\bAN[CO]?OVA\b|\bMANOVA\b/i },
  { facet: 'analysis', label: 't-test', re: /\bt-?test\b/i },
  { facet: 'analysis', label: 'Correlation', re: /\bcorrelation(s|al)?\b/i },
  { facet: 'analysis', label: 'Mediation', re: /\bmediation\b|\bmediating\b/i },
  { facet: 'analysis', label: 'Moderation', re: /\bmoderation\b|\bmoderating\b/i },
  { facet: 'analysis', label: 'Thematic analysis', re: /\bthematic analysis\b/i },
  { facet: 'analysis', label: 'Content analysis', re: /\bcontent analysis\b/i },
  { facet: 'analysis', label: 'Grounded theory', re: /\bgrounded theory\b/i },
  // software
  { facet: 'software', label: 'SPSS', re: /\bSPSS\b/i },
  { facet: 'software', label: 'R', re: /\b(?:in|using|with)\s+R\b|\bR (?:version|software|package)\b|\bRStudio\b/ },
  { facet: 'software', label: 'AMOS', re: /\bAMOS\b/i },
  { facet: 'software', label: 'Mplus', re: /\bMplus\b/i },
  { facet: 'software', label: 'Stata', re: /\bStata\b/i },
  { facet: 'software', label: 'SAS', re: /\bSAS\b/ },
  { facet: 'software', label: 'NVivo', re: /\bNVivo\b/i },
  { facet: 'software', label: 'ATLAS.ti', re: /\bATLAS\.?ti\b/i },
  { facet: 'software', label: 'lavaan', re: /\blavaan\b/i },
  { facet: 'software', label: 'PROCESS macro', re: /\bPROCESS macro\b|\bHayes(?:’s|'s)? PROCESS\b/i },
  { facet: 'software', label: 'JASP / jamovi', re: /\bJASP\b|\bjamovi\b/i },
  // data
  { facet: 'data', label: 'Secondary / archival data', re: /\bsecondary data\b|\barchival\b/i },
  { facet: 'data', label: 'Panel data', re: /\bpanel data\b/i },
];

function sentenceAround(text: string, idx: number): string {
  const start = Math.max(0, text.lastIndexOf('.', idx) + 1);
  let end = text.indexOf('.', idx + 1);
  if (end === -1) end = Math.min(text.length, idx + 160);
  return text.slice(start, end + 1).replace(/\s+/g, ' ').trim().slice(0, 240);
}

function heuristicDissect(text: string, input: ExtractInput): ExtractResult {
  const facets = emptyFacets();
  const seen = new Set<string>();
  for (const v of VOCAB) {
    const m = v.re.exec(text);
    if (!m) continue;
    const key = `${v.facet}:${v.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    facets[v.facet].push({ text: v.label, evidence: sentenceAround(text, m.index), verified: true });
  }

  // Sample size (verbatim from text).
  const nMatch = text.match(/\bN\s*[=≈]\s*([0-9][0-9,]*)/i) ||
    text.match(/\b([0-9][0-9,]{1,6})\s+(?:participants|respondents|employees|students|subjects|nurses|workers|adults|firms|observations)/i);
  if (nMatch) {
    facets.sample.push({ text: `N = ${nMatch[1]}`, evidence: sentenceAround(text, nMatch.index ?? 0), verified: true });
  }

  const notes = [
    'Extracted by the offline heuristic (no AI) — it reads only well-known design/analysis/software vocabulary, so theory, measures and findings are not captured. Verify and edit.',
  ];
  if (input.depth === 'abstract') notes.push('Abstract-depth only: read from the abstract, not the full paper.');

  return { title: input.title, facets, notes, source: 'heuristic' };
}
