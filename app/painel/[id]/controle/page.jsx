'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Topbar from '@/components/Topbar';
import Telao from '@/components/Telao';
import QR, { joinUrl as makeJoinUrl } from '@/components/QR';
import { api, usePoll, kindLabel } from '@/components/client';
import { nextStep, prevStep } from '@/components/flow';

function responsesOf(data) {
  const r = data && data.results;
  if (!r) return null;
  if (r.kind === 'cloud') return { n: r.total, l: r.total === 1 ? 'palavra enviada' : 'palavras enviadas' };
  if (r.kind === 'choice') return { n: r.voters, l: r.voters === 1 ? 'voto' : 'votos' };
  if (r.kind === 'quiz') return { n: r.answered, l: r.answered === 1 ? 'resposta nesta pergunta' : 'respostas nesta pergunta' };
  return null;
}

// Painel do palestrante durante o evento: um botão principal, prévia do telão e "a seguir".
export default function Controle() {
  const { id } = useParams();
  const { data, setData, refresh } = usePoll(`/api/events/${id}/live`, 1000);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [joinUrl, setJoinUrl] = useState('');
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => { if (data && data.event) setJoinUrl(makeJoinUrl(data.event.pin)); }, [data && data.event && data.event.pin]);
  useEffect(() => {
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const run = async (action, extra = {}) => {
    if (busy) return;
    setBusy(true);
    setErr('');
    const r = await api(`/api/events/${id}/control`, { method: 'POST', body: { action, ...extra } });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setData((d) => ({ ...(d || {}), ...r.state, results: null, _recv: Date.now() }));
    refresh();
  };
  const doStep = (s) => {
    if (!s) return;
    if (s.action === 'end' && !window.confirm('Encerrar o evento? O QR code para de aceitar novas entradas.')) return;
    run(s.action);
  };

  const next = nextStep(data);
  const prev = prevStep(data);

  // Passador de slides / teclado também funcionam aqui.
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (['ArrowRight', 'PageDown'].includes(e.key)) { e.preventDefault(); if (next && next.action !== 'end' && next.action !== 'start') doStep(next); }
      if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); doStep(prev); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!data) return (<><Topbar /><main className="container"><p className="muted">Carregando…</p></main></>);

  const { event, activity: a, activities = [], index, paused } = data;
  const live = event.status === 'live';
  const interactive = live && a && a.kind !== 'slide';
  const upcoming = live ? activities[index + 1] : activities[0];
  const resp = responsesOf(data);
  const statusTag = live ? ['Ao vivo', 'tag-live'] : event.status === 'ended' ? ['Encerrado', 'tag-ended'] : ['Não iniciado', ''];
  const menuItem = { justifyContent: 'flex-start', borderColor: 'transparent' };

  return (
    <>
      <Topbar>
        <Link href={`/painel/${id}`} className="btn btn-sm btn-ghost">← Editar evento</Link>
      </Topbar>
      <main className="container stack" style={{ gap: 16, maxWidth: 1440 }}>
        <section className="card row" style={{ gap: 14, padding: '14px 18px' }}>
          <div className="stack" style={{ gap: 4, flex: '1 1 260px', minWidth: 0 }}>
            <span className={'tag ' + statusTag[1]} style={{ alignSelf: 'flex-start' }}>{live ? <span className="dot-live" /> : null}{statusTag[0]}</span>
            <strong style={{ fontSize: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.title}</strong>
          </div>
          <div className="stack" style={{ gap: 0, alignItems: 'flex-end' }}>
            <span className="hint">PIN</span>
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '.12em' }}>{event.pin}</span>
          </div>
          <div className="stack" style={{ gap: 0, alignItems: 'flex-end', minWidth: 90 }}>
            <span className="hint">Participantes</span>
            <span style={{ fontSize: 24, fontWeight: 800 }}>{data.participants || 0}</span>
          </div>
          <a className="btn btn-dark" href={`/telao/${event.pin}`} target="rg-telao" rel="noopener">Abrir tela do projetor ↗</a>
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button className="btn" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-haspopup="menu">Mais opções ▾</button>
            {menu ? (
              <div role="menu" className="card stack" style={{ position: 'absolute', right: 0, top: 50, zIndex: 30, width: 290, padding: 8, gap: 2, boxShadow: '0 12px 30px rgba(11,34,56,.18)' }}>
                <a role="menuitem" className="btn btn-ghost" style={menuItem} href={`/api/events/${id}/export`}>Exportar respostas (planilha)</a>
                <Link role="menuitem" className="btn btn-ghost" style={menuItem} href={`/painel/${id}/relatorio`}>Relatório em PDF</Link>
                {interactive ? <button role="menuitem" className="btn btn-ghost" style={menuItem} onClick={() => { setMenu(false); if (window.confirm('Apagar as respostas desta atividade?')) run('clearActivity'); }}>Limpar respostas desta atividade</button> : null}
                {live ? <button role="menuitem" className="btn btn-ghost btn-danger" style={menuItem} onClick={() => { setMenu(false); doStep({ action: 'end' }); }}>Encerrar evento</button> : null}
                {!live ? <button role="menuitem" className="btn btn-ghost btn-danger" style={menuItem} onClick={() => { setMenu(false); if (window.confirm('Apagar TODOS os participantes e respostas deste evento (por exemplo, depois de um ensaio)?')) run('clearEvent'); }}>Zerar dados do evento</button> : null}
              </div>
            ) : null}
          </div>
        </section>

        {err ? <div className="alert" role="alert">{err}</div> : null}

        <div className="layout-2" style={{ alignItems: 'stretch' }}>
          <section className="main stack" style={{ gap: 8, flex: '999 1 600px' }}>
            <span className="eyebrow">No telão agora</span>
            <Telao data={data} joinUrl={joinUrl} />
          </section>

          <aside className="stack" style={{ gap: 12, flex: '1 1 320px', maxWidth: 400 }}>
            <button className="btn btn-primary btn-block" style={{ minHeight: 84, fontSize: 22, borderRadius: 18, whiteSpace: 'normal' }} onClick={() => doStep(next)} disabled={busy || !next}>
              {busy ? 'Aguarde…' : next ? next.label : '—'} {next && !next.last && !busy ? '→' : ''}
            </button>
            <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <button className="btn" style={{ flex: 1, minHeight: 52 }} onClick={() => doStep(prev)} disabled={busy || !prev}>← Voltar</button>
              {interactive ? (
                <button className="btn" style={{ flex: 1, minHeight: 52, ...(paused ? { background: 'var(--amber)', borderColor: 'var(--amber)' } : {}) }} onClick={() => run(paused ? 'resume' : 'pause')} disabled={busy}>
                  {paused ? 'Retomar respostas' : 'Pausar respostas'}
                </button>
              ) : null}
            </div>

            {live && a ? (
              <div className="card stack" style={{ gap: 4 }}>
                <span className="eyebrow">Agora · {index + 1} de {activities.length}</span>
                <strong style={{ fontSize: 17 }}>{activities[index] ? activities[index].title : ''}</strong>
                <span className="hint">{kindLabel(a)}{a.kind === 'quiz' ? ` · pergunta ${a.qIndex + 1} de ${a.qTotal}` : ''}</span>
                {resp ? <span style={{ marginTop: 6 }}><b style={{ fontSize: 26 }}>{resp.n}</b> <span className="muted">{resp.l}</span></span> : null}
              </div>
            ) : null}

            {live && a && a.kind === 'cloud' && data.results ? (
              <div className="card stack" style={{ gap: 8 }}>
                <span className="eyebrow">Moderar palavras</span>
                <span className="hint">Palavrões já são bloqueados automaticamente. Toque numa palavra para tirá-la do telão.</span>
                <div className="row" style={{ gap: 6 }}>
                  {(data.results.words || []).slice(0, 24).map((w) => (
                    <button key={w.text} className="btn btn-sm" onClick={() => run('hideWord', { word: w.text })} disabled={busy} title="Ocultar do telão">
                      {w.text} <span className="muted">({w.count})</span> ×
                    </button>
                  ))}
                  {!(data.results.words || []).length ? <span className="muted">Nenhuma palavra ainda.</span> : null}
                </div>
                {(data.results.hidden || []).length ? (
                  <>
                    <span className="hint">Ocultas (toque para mostrar de novo):</span>
                    <div className="row" style={{ gap: 6 }}>
                      {data.results.hidden.map((w) => (
                        <button key={w} className="btn btn-sm" style={{ textDecoration: 'line-through', color: 'var(--muted)' }} onClick={() => run('showWord', { word: w })} disabled={busy}>{w}</button>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            <div className="card stack" style={{ gap: 4, background: '#FAFBFC' }}>
              <span className="eyebrow">{live ? 'A seguir' : 'Primeira atividade'}</span>
              {upcoming ? (
                <>
                  <strong style={{ fontSize: 16 }}>{upcoming.title}</strong>
                  <span className="hint">{kindLabel(upcoming)}</span>
                </>
              ) : <span className="muted">{activities.length ? 'Esta é a última atividade.' : 'Nenhuma atividade no evento.'}</span>}
            </div>

            {!live ? (
              <div className="card stack" style={{ alignItems: 'center', textAlign: 'center', gap: 6 }}>
                <span className="eyebrow">Entrada do público</span>
                {joinUrl ? <QR value={joinUrl} size={360} style={{ width: 150, height: 150 }} /> : null}
                <span className="hint" style={{ wordBreak: 'break-all' }}>{joinUrl}</span>
              </div>
            ) : null}
            <p className="hint">Atalhos: passador de slides ou setas ← → do teclado.</p>
          </aside>
        </div>

        <section className="card stack" style={{ gap: 8, padding: 14 }}>
          <span className="eyebrow">Sequência · clique para ir direto</span>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {activities.map((x, i) => (
              <button key={x.id} className={'act-item' + (live && i === index ? ' on' : '')} style={{ width: 210, flex: 'none', border: '1px solid var(--line)' }} onClick={() => live && run('goto', { index: i })} disabled={!live || busy} title={live ? 'Ir para esta atividade' : 'Inicie o evento para navegar'}>
                <span className="act-num">{i + 1}</span>
                <span className="act-meta"><span className="k">{kindLabel(x)}</span><span className="t">{x.title}</span></span>
              </button>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
