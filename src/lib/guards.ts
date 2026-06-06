// No-fabrication guards — pure, dependency-free (imports nothing) so they can be
// unit-tested directly under Node's type-stripping. See extract.ts for use and
// feedback-ai-extraction-verbatim for the rationale.

// Aggressive normaliser: lowercase, collapse any non-alphanumeric run to one
// space. Makes snippet matching robust to PDF spacing/hyphenation noise.
export function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Is `snippet` present in already-normalised text? We check the first several
// words so minor tail differences from the model don't cause a miss.
export function evidenceFound(snippet: string, normText: string): boolean {
  const n = norm(snippet);
  if (n.length < 6) return false;
  const words = n.split(' ');
  const probe = words.slice(0, Math.min(8, words.length)).join(' ');
  if (probe.length < 6) return false;
  return normText.includes(probe);
}

// Exported convenience for tests: does a snippet occur (normalised) in raw text?
export function snippetInText(snippet: string, text: string): boolean {
  return evidenceFound(snippet, norm(text));
}

// A number is trusted only if it appears verbatim in the text (handles
// ".34" / "0.34" / "N = 1,698" formatting). Mirrors the PaperCards guard.
export function numAppears(value: number, hay: string): boolean {
  if (!Number.isFinite(value)) return false;
  const a = Math.abs(value);
  const cands = new Set<string>();
  const push = (s: string) => {
    if (!s) return;
    cands.add(s);
    if (s.startsWith('0.')) cands.add(s.slice(1));
    if (s.includes('.')) {
      const t = s.replace(/0+$/, '').replace(/\.$/, '');
      cands.add(t);
      if (t.startsWith('0.')) cands.add(t.slice(1));
    }
  };
  push(String(a));
  if (Number.isInteger(a)) { push(String(a)); push(a.toLocaleString('en-US')); }
  else { push(a.toFixed(1)); push(a.toFixed(2)); push(a.toFixed(3)); }
  for (const c of cands) if (c.length >= 2 && hay.includes(c)) return true;
  return false;
}

// Strip any number in a free-text `detail` string that is NOT in the source.
export function guardNumbersInDetail(detail: string, text: string): string {
  return detail.replace(/-?\d[\d,]*\.?\d*/g, (m) => {
    const v = parseFloat(m.replace(/,/g, ''));
    return numAppears(v, text) ? m : '—';
  });
}
