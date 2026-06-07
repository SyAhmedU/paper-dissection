// POST /api/dissect — dissect a paper's text into structured facets.
// Body: { text: string, title?: string, depth?: 'full-text' | 'abstract' }
// Returns: { dissection: ExtractedDissection | null, _source: 'groq' | 'fallback' }
//
// Without GROQ_API_KEY the function returns 200 with `_source: 'fallback'` and
// the client uses its deterministic heuristic dissector instead.
//
// HARD RULE baked into the prompt: extract ONLY what the supplied text states.
// Never invent theory/method/number. Each item must carry a short VERBATIM
// `evidence` snippet copied from the text — the client re-checks it and flags
// anything it can't find. (See feedback-ai-extraction-verbatim.)

const FACET_SPEC = `Facets (each is an array of items; omit or leave empty if the text doesn't cover it):
- "theory": theoretical frameworks the paper builds on (e.g. "Job Demands–Resources theory", "Self-Determination Theory").
- "constructs": variables measured or manipulated. Put the role in "detail" (IV/DV/mediator/moderator/control) ONLY if the text states it.
- "hypotheses": stated hypotheses/propositions; keep the wording close to the paper.
- "design": research design (experiment, RCT, survey, cross-sectional, longitudinal, qualitative, mixed-methods, meta-analysis, case study…).
- "sample": sample descriptors — N (verbatim), population, country, sampling method. One item each.
- "measures": instruments/scales used to operationalise constructs (e.g. "UWES-9", "Maslach Burnout Inventory").
- "analysis": analysis techniques (regression, SEM, CFA, ANOVA, multilevel modelling, mediation, thematic analysis…).
- "software": software/packages named (SPSS, R, AMOS, Mplus, Stata, NVivo, lavaan, PROCESS…).
- "data": data type/source (primary/secondary, cross-sectional/longitudinal, archival, panel…).
- "findings": the main results the paper reports (numbers VERBATIM only).
- "contributions": stated theoretical/practical contributions.
- "limitations": limitations the paper acknowledges.
- "future": future research directions the paper proposes.`;

const SCHEMA_HINT = `{
  "title"?: string,
  "authors"?: string[],
  "year"?: number,
  "journal"?: string,
  "nature"?: "quantitative"|"qualitative"|"mixed-methods"|"case-report"|"review"|"theoretical",
  "facets": {
    "theory"?: Item[], "constructs"?: Item[], "hypotheses"?: Item[],
    "design"?: Item[], "sample"?: Item[], "measures"?: Item[],
    "analysis"?: Item[], "software"?: Item[], "data"?: Item[],
    "findings"?: Item[], "contributions"?: Item[], "limitations"?: Item[], "future"?: Item[]
  },
  "notes"?: string[]
}
// Item = { "text": string, "detail"?: string, "evidence": string }
// "evidence" MUST be a short phrase copied verbatim from the provided text.`;

const SYSTEM = `You are a meticulous research methodologist dissecting a paper into its parts. You EXTRACT, you do not estimate or summarise from outside knowledge.

ABSOLUTE RULE — NO FABRICATION:
- Output ONLY information stated in the provided text. Never invent a theory, method, measure, statistic, or finding. If the text doesn't cover a facet, return an empty array (or omit it).
- EVERY item must include an "evidence" field: a short phrase (4–20 words) copied VERBATIM from the text that supports the item. If you cannot find a verbatim phrase, do not output the item.
- Every NUMBER (sample size, statistic) must be copyable verbatim from the text. Do not estimate, round to a "typical" value, or infer.
- Do not deduplicate aggressively across facets, but within a facet list distinct items only.

${FACET_SPEC}

Output rules:
- Return ONLY a JSON object (no markdown, no code fences, no prose).
- "text" is the concise canonical name of the item; "detail" is optional elaboration grounded in the text.
- title/authors/year/journal: include only if clearly present in the text (usually the first page). Omit if unsure.
- nature: classify the study's overall methodology as exactly one of "quantitative", "qualitative", "mixed-methods", "case-report", "review" (systematic review / meta-analysis), or "theoretical" (conceptual, no empirical data) — based on the methods the text describes. Omit if genuinely unclear.
- "notes": 0–3 short caveats about the dissection (e.g. "methods section not present in supplied text").

Shape:
${SCHEMA_HINT}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const text = (body && body.text) || '';
  const title = (body && body.title) || '';
  const depth = (body && body.depth) || 'full-text';
  if (!text.trim()) return res.status(400).json({ error: 'Missing text' });

  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(200).json({ dissection: null, _source: 'fallback', _reason: 'no_key' });

  const userBlock = JSON.stringify({ title, depth, text: String(text).slice(0, 24000) });

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: userBlock },
        ],
        temperature: 0.1,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      }),
    });
    if (!r.ok) throw new Error(`Groq ${r.status}`);
    const data = await r.json();
    const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { /* maybe fenced */ }
    if (!parsed) {
      const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
      if (fenced) { try { parsed = JSON.parse(fenced[1]); } catch { /* give up */ } }
    }
    if (!parsed || typeof parsed.facets !== 'object') {
      return res.status(200).json({ dissection: null, _source: 'fallback', _reason: 'unparseable' });
    }
    return res.status(200).json({ dissection: parsed, _source: 'groq' });
  } catch (err) {
    return res.status(200).json({ dissection: null, _source: 'fallback', _reason: 'network', _error: String(err?.message || err) });
  }
}
