import { useEffect, useRef, useState } from 'react';
import './App.css';
import SyedBar from './components/SyedBar';
import AddPapers from './components/AddPapers';
import DissectionCard from './components/DissectionCard';
import FacetTimeline from './components/FacetTimeline';
import SynthesisMatrix from './components/SynthesisMatrix';
import type { Dissection } from './lib/types';
import { loadAll, addDissection, removeDissection } from './lib/store';
import { download, stamp, dissectionsCsv, dissectionsMarkdown, libraryJson } from './lib/export';

type Tab = 'add' | 'library' | 'timeline' | 'matrix';

export default function App() {
  const [dissections, setDissections] = useState<Dissection[]>(() => loadAll());
  const [tab, setTab] = useState<Tab>(() => loadAll().length ? 'library' : 'add');
  const [focusId, setFocusId] = useState<string | null>(null);

  // Scroll to a freshly-opened card when the library tab mounts/changes.
  useEffect(() => {
    if (tab === 'library' && focusId) {
      const el = document.getElementById(`card-${focusId}`);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.classList.add('flash'); const id = focusId; setTimeout(() => document.getElementById(`card-${id}`)?.classList.remove('flash'), 1400); }
      setFocusId(null);
    }
  }, [tab, focusId, dissections]);

  function handleAdded(ds: Dissection[]) {
    let next = dissections;
    for (const d of ds) next = addDissection(d);
    setDissections(next);
    setTab('library');
    if (ds[0]) setFocusId(ds[0].id);
  }

  function handleDelete(id: string) {
    setDissections(removeDissection(id));
  }

  function openPaper(id: string) {
    setTab('library');
    setFocusId(id);
  }

  const importRef = useRef<HTMLInputElement>(null);
  function handleImport(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const arr: unknown = Array.isArray(parsed) ? parsed : parsed?.dissections;
        if (!Array.isArray(arr)) throw new Error('not a backup');
        let next = dissections;
        let added = 0;
        for (const d of arr) {
          if (d && typeof d === 'object' && (d as Dissection).id && (d as Dissection).facets) {
            next = addDissection(d as Dissection);
            added++;
          }
        }
        setDissections(next);
        setTab('library');
        alert(added ? `Imported ${added} dissection${added === 1 ? '' : 's'}.` : 'No dissections found in that file.');
      } catch {
        alert('Could not read that file — pick a Paper Dissection JSON backup.');
      }
    };
    reader.readAsText(file);
  }

  const n = dissections.length;

  return (
    <>
      <SyedBar />
      <main className="app" id="main">
        <header className="hero">
          <div className="hero-eyebrow"><b />Research Suite · paper anatomy</div>
          <h1>Dissect a paper down to its <em>parts</em>.</h1>
          <p className="sub">
            Upload a paper, a batch of papers, paste DOIs, or pull a whole journal's articles — and the workshop breaks each one to the core,
            sorting every component into facets: theory used, design, sample, measures, analysis techniques, software, findings and more.
            Then see the whole corpus on a facet&nbsp;×&nbsp;year timeline and a synthesis matrix.
            Everything is extracted only from the source text — nothing is invented.
          </p>
          <div className="suite-link">Part of <a href="https://syahmedu.github.io/research-suite/" target="_blank" rel="noopener noreferrer">Throughline</a> · complements <a href="https://papercards.vercel.app" target="_blank" rel="noopener noreferrer">PaperCards</a></div>
        </header>

        <nav className="tabs" aria-label="Views">
          <button className={`tab ${tab === 'add' ? 'active' : ''}`} onClick={() => setTab('add')}>Add papers</button>
          <button className={`tab ${tab === 'library' ? 'active' : ''}`} onClick={() => setTab('library')}>Library<span className="tab-count">{n}</span></button>
          <button className={`tab ${tab === 'timeline' ? 'active' : ''}`} onClick={() => setTab('timeline')}>Timeline</button>
          <button className={`tab ${tab === 'matrix' ? 'active' : ''}`} onClick={() => setTab('matrix')}>Synthesis matrix</button>
        </nav>

        {tab === 'add' && <AddPapers onAdded={handleAdded} existing={dissections} />}

        {tab === 'library' && (
          <>
            <input ref={importRef} type="file" accept="application/json,.json" hidden
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ''; }} />
            {n === 0
              ? <div className="empty">No papers dissected yet. Head to <button className="btn link" onClick={() => setTab('add')}>Add papers</button> to upload a PDF, paste text, or fetch a DOI — or <button className="btn link" onClick={() => importRef.current?.click()}>import a JSON backup</button>.</div>
              : <>
                  <div className="lib-export">
                    <span className="muted small">Export {n} dissection{n === 1 ? '' : 's'}:</span>
                    <button className="btn small" onClick={() => download(`dissections-${stamp()}.csv`, dissectionsCsv(dissections), 'text/csv')}>⬇ CSV</button>
                    <button className="btn small" onClick={() => download(`dissections-${stamp()}.md`, dissectionsMarkdown(dissections), 'text/markdown')}>⬇ Markdown</button>
                    <button className="btn small" title="Full re-importable backup" onClick={() => download(`paper-dissection-backup-${stamp()}.json`, libraryJson(dissections), 'application/json')}>⬇ JSON backup</button>
                    <button className="btn small" title="Restore from a JSON backup" onClick={() => importRef.current?.click()}>⬆ Import backup</button>
                  </div>
                  <div className="lib">
                    {dissections.map(d => (
                      <div id={`card-${d.id}`} key={d.id} className="lib-item">
                        <DissectionCard d={d} onDelete={() => handleDelete(d.id)} />
                      </div>
                    ))}
                  </div>
                </>}
          </>
        )}

        {tab === 'timeline' && <FacetTimeline dissections={dissections} onOpen={openPaper} />}
        {tab === 'matrix' && <SynthesisMatrix dissections={dissections} onOpen={openPaper} />}
      </main>
    </>
  );
}
