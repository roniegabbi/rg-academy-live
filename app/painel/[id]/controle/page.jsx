'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Topbar from '@/components/Topbar';
import Telao from '@/components/Telao';
import QR, { joinUrl as makeJoinUrl } from '@/components/QR';
import { api, usePoll, kindLabel } from '@/components/client';

export default function Controle() {
  const { id } = useParams();
  const { data, setData, refresh } = usePoll(`/api/events/${id}/live`, 1000);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [joinUrl, setJoinUrl] = useState('');

  useEffect(() => { if (data && data.event) setJoinUrl(makeJoinUrl(data.event.pin)); }, [data && data.event && data.event.pin]);

  const act = async (action, extra = {}) => {
    setBusy(true);
    setErr('');
    const r = await api(`/api/events/${id}/control`, { method: 'POST', body: { action, ...extra } });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setData((d) => ({ ...(d || {}), ...r.state, results: null, _recv: Date.now() }));
    refresh();
  };

  // Atalhos de teclado do passador de slides: setas e PageUp/PageDown.
  useEffect(() => {
    const onKey = (e) => {
      if (!data || data.event.status !== 'live') return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); act('next'); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); act('prev'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!data) return (<><Topbar /><main className="container"><p className="muted">Carregando…</p></main></>);

  const { event, activity: a, run = {}, activities = [], index, paused } = data;
  const live = event.status === 'live';
  const isQuiz = a && a.kind === 'quiz';
  const interactive = a && a.kind !== 'slide';

  return (
    <>
      <Topbar>
        <Link href={`/painel/${id}`} className="btn btn-sm btn-ghost">← Editar evento</Link>
      </Topbar>
      <main className="container stack" style={{ gap: 16, maxWidth: 1500 }}>
        <section className="card row" style={{ gap: 10 }}>
          <div className="stack" style={{ gap: 2, marginRight: 8 }}>
            <span className="eyebrow">{event.status === 'live' ? 'Ao vivo' : event.status === 'ended' ? 'Encerrado' : 'Não iniciado'}</span>
            <strong style={{ fontSize: 18 }}>{event.title}</strong>
          </div>
          {!live ? (
            <button className="btn btn-primary" onClick={() => act('start')} disabled={busy}>{event.status === 'ended' ? 'Reabrir evento' : 'Iniciar evento'}</button>
          ) : (
            <>
              <button className="btn icon-btn" onClick={() => act('prev')} disabled={busy || index === 0} aria-label="Atividade anterior">←</button>
              <div className="stack" style={{ gap: 0, minWidth: 150 }}>
                <span className="hint">Atividade {index + 1} de {activities.length}</span>
                <strong>{kindLabel(a)}</strong>
              </div>
              <button className="btn btn-primary" onClick={() => act('next')} disabled={busy || index >= activities.length - 1}>Próxima →</button>
              {isQuiz && run.phase === 'ready' ? <button className="btn btn-dark" onClick={() => act('quizStart')} disabled={busy}>Iniciar pergunta {a.qIndex + 1}</button> : null}
              {isQuiz && (run.phase === 'question' || run.phase === 'closed') ? <button className="btn btn-dark" onClick={() => act('quizReveal')} disabled={busy}>Revelar resposta</button> : null}
              {isQuiz && run.phase === 'reveal' ? <button className="btn btn-dark" onClick={() => act('quizRank')} disabled={busy}>Mostrar ranking</button> : null}
              {isQuiz && (run.phase === 'reveal' || run.phase === 'rank') && a.qIndex + 1 < a.qTotal ? <button className="btn btn-dark" onClick={() => act('quizNext')} disabled={busy}>Próxima pergunta</button> : null}
              {interactive ? <button className="btn" onClick={() => act(paused ? 'resume' : 'pause')} disabled={busy} style={paused ? { background: 'var(--amber)', borderColor: 'var(--amber)' } : null}>{paused ? 'Retomar respostas' : 'Pausar respostas'}</button> : null}
            </>
          )}
          <div style={{ flex: 1 }} />
          <a className="btn btn-dark" href={`/telao/${event.pin}`} target="_blank" rel="noopener">Abrir tela do projetor ↗</a>
          {live ? <button className="btn btn-danger" onClick={() => window.confirm('Encerrar o evento? O QR code para de aceitar novas entradas.') && act('end')} disabled={busy}>Encerrar evento</button> : null}
        </section>
        {err ? <div className="alert" role="alert">{err}</div> : null}

        <div className="layout-2">
          <aside className="side card stack" style={{ gap: 6, maxWidth: 320 }}>
            <span className="eyebrow">Sequência</span>
            {activities.map((x, i) => (
              <button key={x.id} className={'act-item' + (i === index ? ' on' : '')} onClick={() => live && act('goto', { index: i })} disabled={!live || busy} title={live ? 'Ir para esta atividade' : 'Inicie o evento para navegar'}>
                <span className="act-num">{i + 1}</span>
                <span className="act-meta"><span className="k">{kindLabel(x)}</span><span className="t">{x.title}</span></span>
              </button>
            ))}
            <span className="hint" style={{ marginTop: 6 }}>Dica: passador de slides e setas ← → do teclado também avançam.</span>
          </aside>

          <section className="main stack" style={{ gap: 12 }}>
            <Telao data={data} joinUrl={joinUrl} />
            <div className="row" style={{ gap: 8 }}>
              {live && interactive ? <button className="btn btn-sm" onClick={() => window.confirm('Apagar as respostas desta atividade?') && act('clearActivity')}>Limpar respostas desta atividade</button> : null}
              <a className="btn btn-sm" href={`/api/events/${id}/export`}>Exportar respostas (planilha)</a>
              <Link className="btn btn-sm" href={`/painel/${id}/relatorio`}>Relatório em PDF</Link>
              <div style={{ flex: 1 }} />
              {!live ? <button className="btn btn-sm btn-danger" onClick={() => window.confirm('Apagar TODOS os participantes e respostas deste evento (por exemplo, depois de um teste)?') && act('clearEvent')}>Zerar dados do evento</button> : null}
            </div>
          </section>

          <aside className="card stack" style={{ flex: '1 1 220px', maxWidth: 260, alignItems: 'center', textAlign: 'center' }}>
            <span className="eyebrow">Entrada do público</span>
            {joinUrl ? <QR value={joinUrl} size={400} style={{ width: 200, height: 200 }} /> : null}
            <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '.12em' }}>{event.pin}</span>
            <span className="hint" style={{ wordBreak: 'break-all' }}>{joinUrl}</span>
            <span style={{ fontSize: 15 }}><b style={{ fontSize: 22 }}>{data.participants || 0}</b> participantes</span>
          </aside>
        </div>
      </main>
    </>
  );
}
