# Paper Dissection Workshop

> **⚠ Retired (2026-06-07) — merged into [PaperCards](https://papercards.vercel.app).**
> Every capability here now lives in PaperCards as its **Dissection** depth: PDF / paste / DOI /
> bulk-DOI / journal-picker inputs, the 13-facet view, facet × year timeline and synthesis matrix.
> `paper-dissection.vercel.app` now 308-redirects to PaperCards, and this repo is archived
> (read-only). Do all dissection work in `paperpulse/` (PaperCards). Nothing was lost.

Break a research paper down to its parts. Feed it a **PDF**, a **batch of PDFs**,
pasted **full text**, one or many **DOIs**, or a whole **journal** (pick it and
choose from its real articles), and it dissects each paper into **facets** —
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
  via lazy `pdfjs-dist`, no file upload), paste full text, fetch one or many DOIs
  (`src/lib/doi.ts` → Crossref then OpenAlex), or pick a **journal**
  (`src/components/AddJournal.tsx` + `src/lib/journal.ts` → OpenAlex
  `autocomplete/sources` then `works?filter=primary_location.source.id:…`) and
  choose from its real articles. Bibliographic facts come from the real record,
  not the AI; bulk DOI + journal runs dedupe against the library and cap at 25.
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
