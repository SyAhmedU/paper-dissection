// PDF → plain text, in the browser. pdf.js is heavy, so it is dynamically
// imported only when the user actually drops a PDF (keeps the initial bundle
// small). The worker is wired through Vite's ?url import so it loads from our
// own origin. We extract the text layer page-by-page; we never OCR — a scanned
// image-only PDF yields little/no text, which we surface honestly to the user.

export interface PdfText {
  text: string;
  pages: number;
  // A best-effort title guess from the largest text on page 1 (used only as a
  // fallback when no DOI metadata is available; the user can edit it).
  titleGuess?: string;
}

let workerWired = false;

export async function extractPdfText(file: File, onProgress?: (page: number, total: number) => void): Promise<PdfText> {
  const pdfjs = await import('pdfjs-dist');
  if (!workerWired) {
    // Vite resolves this to a hashed URL served from our origin.
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    workerWired = true;
  }

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages = doc.numPages;
  const parts: string[] = [];
  let titleGuess: string | undefined;

  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // Join text items; insert a space between items and newlines between rows
    // by tracking the y-position so paragraphs don't smear into one line.
    let lastY: number | null = null;
    const lineBits: string[] = [];
    let maxHeight = 0;
    let biggest = '';
    for (const it of content.items as Array<{ str?: string; transform?: number[]; height?: number }>) {
      const s = it.str ?? '';
      if (!s) continue;
      const y = it.transform ? it.transform[5] : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 3) lineBits.push('\n');
      lineBits.push(s);
      lastY = y;
      // Track the largest-height run on page 1 as a crude title guess.
      if (p === 1) {
        const h = it.height ?? 0;
        if (h > maxHeight && s.trim().length > 8) { maxHeight = h; biggest = s.trim(); }
      }
    }
    if (p === 1 && biggest) titleGuess = biggest;
    parts.push(lineBits.join(' ').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n'));
    onProgress?.(p, pages);
  }

  try { await doc.destroy(); } catch { /* ignore */ }
  const text = parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  return { text, pages, titleGuess };
}
