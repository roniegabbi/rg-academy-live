'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from './client';
import { nextStep, prevStep } from './flow';

// Controles do telão nos cantos: voltar (inferior esquerdo), avançar (inferior direito),
// tela cheia (superior direito). Aparecem ao mexer o mouse e somem, com o cursor, em 3s.
export default function TelaoControls({ eventId, data, onChange }) {
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const hideTimer = useRef(null);

  const next = nextStep(data);
  const prev = prevStep(data);

  const wake = () => {
    setVisible(true);
    document.body.style.cursor = '';
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => { setVisible(false); document.body.style.cursor = 'none'; }, 3000);
  };

  const act = async (step) => {
    if (!step || busy) return;
    if (step.action === 'end' && !window.confirm('Encerrar o evento?')) return;
    setBusy(true);
    setErr('');
    const r = await api(`/api/events/${eventId}/control`, { method: 'POST', body: { action: step.action } });
    setBusy(false);
    if (!r.ok) { setErr(r.error); wake(); return; }
    if (onChange) onChange(r.state);
  };

  const toggleFull = () => {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  };

  // O teclado/passador sempre usa o passo mais recente, sem reiniciar o temporizador a cada atualização do telão.
  const latest = useRef({});
  latest.current = { next, prev, act, toggleFull };

  useEffect(() => {
    wake();
    const onMove = () => wake();
    const onKey = (e) => {
      const { next: n, prev: p, act: a, toggleFull: f } = latest.current;
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); if (n && n.action !== 'end') a(n); }
      if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); a(p); }
      if (e.key === 'f' || e.key === 'F') f();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('keydown', onKey);
      clearTimeout(hideTimer.current);
      document.body.style.cursor = '';
    };
  }, []);

  const fade = { opacity: visible ? 1 : 0, transition: 'opacity .5s', pointerEvents: visible ? 'auto' : 'none', zIndex: 20 };
  const round = { width: 56, height: 56, borderRadius: '50%', border: '1px solid rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,.35)', fontFamily: 'inherit' };

  return (
    <div className="no-print" onMouseEnter={wake}>
      {/* Voltar: canto inferior esquerdo */}
      <button
        onClick={() => act(prev)} disabled={!prev || busy} aria-label="Voltar uma atividade" title="Voltar (←)"
        style={{ ...round, ...fade, position: 'fixed', left: 14, bottom: 14, background: 'rgba(8,26,44,.88)', color: '#fff', opacity: visible ? (prev ? 1 : 0.35) : 0 }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      </button>

      {/* Avançar: canto inferior direito, com o nome do próximo passo acima */}
      {next ? (
        <div style={{ ...fade, position: 'fixed', right: 14, bottom: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          {err ? <div style={{ background: '#FDECEC', color: '#C62828', padding: '6px 12px', borderRadius: 10, fontSize: 14, maxWidth: 320 }}>{err}</div> : null}
          <span style={{ padding: '5px 12px', borderRadius: 999, background: 'rgba(8,26,44,.88)', color: '#fff', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', boxShadow: '0 6px 18px rgba(0,0,0,.3)' }}>{busy ? 'Aguarde…' : next.label}</span>
          <button
            onClick={() => act(next)} disabled={busy} aria-label={next.label} title={`${next.label} (→)`}
            style={{ ...round, background: next.last ? 'rgba(8,26,44,.88)' : '#45B02B', color: next.last ? '#fff' : '#0B2238', border: next.last ? round.border : '0' }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      ) : null}

      {/* Tela cheia: canto superior direito */}
      <button
        onClick={toggleFull} aria-label="Tela cheia" title="Tela cheia (F)"
        style={{ ...round, ...fade, width: 42, height: 42, position: 'fixed', right: 14, top: 14, background: 'rgba(8,26,44,.7)', color: '#fff' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
      </button>
    </div>
  );
}
