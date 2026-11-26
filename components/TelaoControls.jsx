'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from './client';

// Controles do palestrante sobre o telão: aparecem ao mexer o mouse e somem sozinhos.
export default function TelaoControls({ eventId, data, onChange }) {
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const hideTimer = useRef(null);

  const wake = () => {
    setVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 3500);
  };

  const act = async (action, extra = {}) => {
    if (busy) return;
    setBusy(true);
    setErr('');
    const r = await api(`/api/events/${eventId}/control`, { method: 'POST', body: { action, ...extra } });
    setBusy(false);
    if (!r.ok) { setErr(r.error); wake(); return; }
    if (onChange) onChange(r.state);
  };

  const live = data && data.event && data.event.status === 'live';
  const a = data && data.activity;
  const run = (data && data.run) || {};
  const index = (data && data.index) || 0;
  const total = (data && data.total) || 0;
  const isQuiz = a && a.kind === 'quiz';

  useEffect(() => {
    wake();
    const onMove = () => wake();
    // Passador de slides e teclado: setas, PageUp/PageDown, espaço.
    const onKey = (e) => {
      if (!live) return;
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); act('next'); }
      if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); act('prev'); }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('keydown', onKey);
      clearTimeout(hideTimer.current);
    };
  });

  const fullscreen = () => {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  };

  const btn = { minHeight: 44, padding: '0 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.25)', background: 'rgba(20,50,79,.92)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 };
  const primary = { ...btn, background: '#45B02B', borderColor: '#45B02B', color: '#0B2238' };

  return (
    <div className="no-print" onMouseEnter={wake} style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(clamp(56px, 8vh, 110px) + 4.5vh)', zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: visible ? 1 : 0, transition: 'opacity .4s', pointerEvents: visible ? 'auto' : 'none' }}>
      {err ? <div style={{ background: '#FDECEC', color: '#C62828', padding: '6px 12px', borderRadius: 10, fontSize: 14 }}>{err}</div> : null}
      <div style={{ display: 'flex', gap: 8, padding: 8, borderRadius: 16, background: 'rgba(8,26,44,.85)', boxShadow: '0 8px 30px rgba(0,0,0,.35)', flexWrap: 'wrap', justifyContent: 'center' }}>
        {!live ? (
          <button style={primary} onClick={() => act('start')} disabled={busy}>{data && data.event && data.event.status === 'ended' ? 'Reabrir evento' : 'Iniciar evento'}</button>
        ) : (
          <>
            <button style={btn} onClick={() => act('prev')} disabled={busy || index === 0} aria-label="Atividade anterior">← Anterior</button>
            <span style={{ ...btn, background: 'transparent', border: 0, cursor: 'default', fontWeight: 600 }}>{index + 1} / {total}</span>
            <button style={primary} onClick={() => act('next')} disabled={busy || index >= total - 1} aria-label="Próxima atividade">Próxima →</button>
            {isQuiz && run.phase === 'ready' ? <button style={btn} onClick={() => act('quizStart')} disabled={busy}>Iniciar pergunta</button> : null}
            {isQuiz && (run.phase === 'question' || run.phase === 'closed') ? <button style={btn} onClick={() => act('quizReveal')} disabled={busy}>Revelar resposta</button> : null}
            {isQuiz && run.phase === 'reveal' ? <button style={btn} onClick={() => act('quizRank')} disabled={busy}>Mostrar ranking</button> : null}
            {isQuiz && (run.phase === 'reveal' || run.phase === 'rank') && a.qIndex + 1 < a.qTotal ? <button style={btn} onClick={() => act('quizNext')} disabled={busy}>Próxima pergunta</button> : null}
          </>
        )}
        <button style={btn} onClick={fullscreen} aria-label="Tela cheia">⛶ Tela cheia</button>
      </div>
    </div>
  );
}
