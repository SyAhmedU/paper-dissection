// Export — turn the dissected corpus into portable artifacts for a real
// literature review or a backup. CSV + Markdown (papers × all facets) and a
// full JSON backup. No dependencies; everything is built from the data already
// in the library.

import type { Dissection } from './types';
import { FACET_KEYS, FACET_BY_KEY } from './types';

export function download(filename: string, text: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function itemsToText(d: Dissection, k: typeof FACET_KEYS[number]): string {
  return (d.facets[k] || []).map(it => (it.detail ? `${it.text} (${it.detail})` : it.text)).join('; ');
}

const META = ['Title', 'Authors', 'Year', 'Journal', 'DOI', 'Source', 'Depth'] as const;

function rowValues(d: Dissection): string[] {
  return [
    d.title || '',
    (d.authors || []).join(', '),
    d.year ? String(d.year) : '',
    d.journal || '',
    d.doi || '',
    d.source,
    d.depth,
    ...FACET_KEYS.map(k => itemsToText(d, k)),
  ];
}

const headerCols = (): string[] => [...META, ...FACET_KEYS.map(k => FACET_BY_KEY[k].label)];

function csvEscape(s: string): string {
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function dissectionsCsv(ds: Dissection[]): string {
  const rows = [headerCols(), ...ds.map(rowValues)];
  return rows.map(r => r.map(csvEscape).join(',')).join('\r\n');
}

export function dissectionsMarkdown(ds: Dissection[]): string {
  const cols = headerCols();
  const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
  const head = `| ${cols.join(' | ')} |`;
  const sep = `| ${cols.map(() => '---').join(' | ')} |`;
  const body = ds.map(d => `| ${rowValues(d).map(esc).join(' | ')} |`).join('\n');
  return [`# Paper dissection synthesis — ${ds.length} papers`, `_Exported ${new Date().toISOString().slice(0, 10)} from Paper Dissection Workshop_`, '', head, sep, body, ''].join('\n');
}

// Full, re-importable backup of the library.
export function libraryJson(ds: Dissection[]): string {
  return JSON.stringify({
    tool: 'paper-dissection-workshop',
    version: 1,
    exportedAt: new Date().toISOString(),
    count: ds.length,
    dissections: ds,
  }, null, 2);
}
