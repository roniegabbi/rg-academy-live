'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from './client';
import { nextStep, prevStep } from './flow';

// Controles discretos sobre o telão: aparecem ao mexer o mouse, somem (com o cursor) em 3s.
export default function TelaoControls({ eventId, data, onChange }) {
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const hideTimer = useRef(null);

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

  const next = nextStep(data);
  const prev = prevStep(data);

  useEffect(() => {
    wake();
    const onMove = () => wake();
    // Passador de slides: avançar faz o próximo passo certo; voltar volta uma atividade.
    const onKey = (e) => {
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); if (next && next.action !== 'end') act(next); }
      if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); act(prev); }
      if (e.key === 'f' || e.key === 'F') toggleFull();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('keydown', onKey);
      clearTimeout(hideTimer.current);
      document.body.style.cursor = '';
    };
  });

  const toggleFull = () => {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  };

  const base = { height: 44, padding: '0 14px', borderRadius: 999, border: 0, background: 'rgba(255,255,255,.12)', color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' };

  return (
    <div className="no-print" onMouseEnter={wake} style={{ position: 'fixed', right: 24, top: 20, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, opacity: visible ? 1 : 0, transition: 'opacity .5s', pointerEvents: visible ? 'auto' : 'none' }}>
      <div style={{ display: 'flex', gap: 6, padding: 6, borderRadius: 999, background: 'rgba(8,26,44,.9)', boxShadow: '0 8px 30px rgba(0,0,0,.35)', alignItems: 'center' }}>
        <button style={{ ...base, width: 44, padding: 0, justifyContent: 'center', opacity: prev ? 1 : 0.35 }} onClick={() => act(prev)} disabled={!prev || busy} aria-label="Voltar uma atividade">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        {next ? (
          <button style={{ ...base, background: next.last ? 'rgba(255,255,255,.12)' : '#45B02B', color: next.last ? '#fff' : '#0B2238', fontWeight: 700 }} onClick={() => act(next)} disabled={busy}>
            {next.label}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        ) : null}
        <button style={{ ...base, width: 44, padding: 0, justifyContent: 'center' }} onClick={toggleFull} aria-label="Tela cheia">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
        </button>
      </div>
      {err ? <div style={{ background: '#FDECEC', color: '#C62828', padding: '6px 12px', borderRadius: 10, fontSize: 14 }}>{err}</div> : null}
    </div>
  );
}
