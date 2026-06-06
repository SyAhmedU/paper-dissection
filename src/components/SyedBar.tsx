// Hand-authored SyedBar for Paper Dissection Workshop. This is a REFERENCE-tier
// tool (not one of the 9 currentSuiteStep pipeline stages), so it shows the
// generic suite nav rather than the step pills. Styles mirror the generated
// SyedBar in the other React apps. (Not emitted by research-suite/tools/brand-bar
// because this project isn't in that registry.)

import { useState } from 'react';

const KEYFRAMES = `@keyframes syed-glow{0%,100%{box-shadow:0 4px 14px -4px rgba(241,69,117,.45)}50%{box-shadow:0 6px 22px -4px rgba(146,112,244,.55)}}
@media (max-width:760px){.syed-suite-nav{display:none!important}}`;

const WARM_GRAD = 'linear-gradient(135deg,#FF9656 0%,#F14575 55%,#9270F4 100%)';

function effectiveTheme(): 'light' | 'dark' {
  try {
    const stored = localStorage.getItem('syed-theme');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch { /* ignore */ }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

const bar: React.CSSProperties = {
  position: 'sticky', top: 0, zIndex: 9999,
  display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px',
  height: 48,
  background: 'color-mix(in srgb, var(--bg-elev) 82%, transparent)',
  backdropFilter: 'blur(20px) saturate(150%)',
  WebkitBackdropFilter: 'blur(20px) saturate(150%)',
  borderBottom: '1px solid var(--line)',
  flexShrink: 0,
  fontFamily: "'Plus Jakarta Sans','Inter',system-ui,sans-serif",
};
const logo: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', flexShrink: 0 };
const mark: React.CSSProperties = {
  width: 28, height: 28, background: WARM_GRAD,
  borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontSize: '.78rem', fontWeight: 800, color: '#fff', flexShrink: 0,
  boxShadow: '0 4px 14px -4px rgba(241,69,117,.55)',
  animation: 'syed-glow 5s ease-in-out infinite',
};
const nm: React.CSSProperties = { fontSize: '.9rem', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em' };
const divider: React.CSSProperties = { width: 1, height: 16, background: 'var(--line)', flexShrink: 0, margin: '0 3px' };
const project: React.CSSProperties = { fontSize: '.74rem', color: 'var(--ink-soft)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, letterSpacing: '.01em' };
const links: React.CSSProperties = { display: 'flex', alignItems: 'center', marginLeft: 'auto', flexShrink: 0, gap: 2 };
const link: React.CSSProperties = { fontSize: '.74rem', color: 'var(--ink-soft)', textDecoration: 'none', padding: '5px 11px', borderRadius: 999, whiteSpace: 'nowrap', fontWeight: 600, letterSpacing: '.01em' };
const linkAll: React.CSSProperties = {
  fontSize: '.74rem', fontWeight: 700, textDecoration: 'none', padding: '5px 13px', borderRadius: 999,
  background: WARM_GRAD, color: '#fff', whiteSpace: 'nowrap', letterSpacing: '.01em',
  boxShadow: '0 6px 16px -6px rgba(241,69,117,.55)',
};
const toggle: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--bg-soft)', border: '1px solid var(--line)', color: 'var(--ink-soft)',
  cursor: 'pointer', fontSize: '1rem', flexShrink: 0, marginLeft: 4, fontFamily: 'inherit',
};

export default function SyedBar({ projectName = 'Paper Dissection Workshop' }: { projectName?: string }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(effectiveTheme);

  const flip = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('syed-theme', next); } catch { /* ignore */ }
    setTheme(next);
  };

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={bar}>
        <a style={logo} href="https://syahmedu.github.io/nexus/" target="_blank" rel="noopener noreferrer">
          <span style={mark}>S</span>
          <span style={nm}>Syed</span>
        </a>
        <span style={divider} />
        <span style={project}>{projectName}</span>
        <nav className="syed-suite-nav" style={links} aria-label="Research Suite">
          <a style={link} href="https://papercards.vercel.app" target="_blank" rel="noopener noreferrer">PaperCards</a>
          <a style={link} href="https://theoryscope.vercel.app" target="_blank" rel="noopener noreferrer">TheoryScope</a>
          <a style={link} href="https://scalescope.vercel.app" target="_blank" rel="noopener noreferrer">ScaleScope</a>
          <a style={link} href="https://toolsscope.vercel.app" target="_blank" rel="noopener noreferrer">ToolsScope</a>
          <a style={linkAll} href="https://syahmedu.github.io/nexus/" target="_blank" rel="noopener noreferrer">All Projects →</a>
        </nav>
        <button style={toggle} onClick={flip} aria-label="Toggle light/dark theme" title="Toggle light/dark">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </>
  );
}
