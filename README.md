# Paper Dissection Workshop

Break a research paper down to its parts. Feed it a **PDF**, a **batch of PDFs**,
pasted **full text**, or a **DOI**, and it dissects each paper into **facets** —
the theory used, design/method, sample, measures, analysis techniques, software,
data, findings, contributions, limitations and future directions — then lays the
whole corpus out on a **facet × year timeline** and a **synthesis matrix**.

Part of the Research Suite (reference tier, sibling to PaperCards / TheoryScope /
ScaleScope / ToolsScope). React 19 + Vite + TS, Vercel function for AI.

## No fabrication (hard rule)
Every facet item is extracted **only from the supplied text**. The AI must attach
a short **verbatim evidence snippet** to each item; the client re-checks that the
snippet actually occurs in the source and **flags anything it can't find** as
"unverified". Numbers (N, statistics) are kept **only when they appear verbatim**.
A **DOI gives abstract-depth** dissection (Crossref/OpenAlex only expose the
abstract) and is labelled as such — it never pretends to have read the full paper.
See suite memory `feedback-ai-extraction-verbatim`.

## How it works
- **Inputs** (`src/components/AddPapers.tsx`): drop one/many PDFs (parsed in-browser
  via lazy `pdfjs-dist`, no file upload), paste full text, or fetch a DOI
  (`src/lib/doi.ts` → Crossref then OpenAlex; bibliographic facts come from the
  real record, not the AI).
- **Extraction** (`src/lib/extract.ts` → `api/dissect.js`): Groq
  `llama-3.3-70b-versatile` with a strict no-fabrication prompt; deterministic
  regex fallback when there's no `GROQ_API_KEY` (reads only well-known
  design/analysis/software vocabulary, so it never guesses theory/measures).
- **Schema** (`src/lib/types.ts`): `Dissection` with one `FacetItem[]` per
  `FacetKey`; `FACETS` is the single source of truth for label/icon/colour/order,
  which facets appear on the timeline vs. matrix, and the suite deep-link target.
- **Views**:
  - `DissectionCard.tsx` — per-paper anatomy; each item shows its detail, a suite
    deep-link (theory → TheoryScope, measures → ScaleScope, analysis → ToolsScope),
    and its evidence snippet / unverified flag.
  - `FacetTimeline.tsx` — swimlanes (facets) × year, nodes coloured per paper
    (modelled on TheoryScope's Timeline).
  - `SynthesisMatrix.tsx` — papers × facets coding grid.
- Persistence: `localStorage` (`pdw_dissections_v1`), no server.

## Run / deploy
`npm install` · `npm run dev` · `npm run build` · `npm test` (verifies the
no-fabrication guards). Deploys to **Vercel**; set `GROQ_API_KEY` to enable AI
extraction (the app still works without it via the heuristic fallback).

> Working name **Paper Dissection Workshop**. Reference tool — not a
> `currentSuiteStep` pipeline stage.
