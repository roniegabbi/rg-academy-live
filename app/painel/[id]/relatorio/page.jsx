'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Topbar from '@/components/Topbar';
import { api, kindLabel, letters } from '@/components/client';
import { WordCloud, ReportBars } from '@/components/Viz';

const fmt = (d) => (d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'long', timeStyle: 'short' }) : '');

// Relatório do evento: cada tela com as respostas do público. "Baixar PDF" usa a impressão do navegador.
export default function Relatorio() {
  const { id } = useParams();
  const [r, setR] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api(`/api/events/${id}/report`).then((x) => (x.ok ? setR(x) : setErr(x.error))); }, [id]);

  if (err) return (<><Topbar /><main className="container"><div className="alert">{err}</div></main></>);
  if (!r) return (<><Topbar /><main className="container"><p className="muted">Carregando…</p></main></>);

  const interactive = r.activities.filter((a) => a.kind !== 'slide');
  const slides = r.activities.filter((a) => a.kind === 'slide');

  return (
    <div className="report">
      <Topbar>
        <Link href={`/painel/${id}`} className="btn btn-sm btn-ghost">← Evento</Link>
      </Topbar>
      <div className="container no-print row" style={{ justifyContent: 'space-between' }}>
        <p className="muted">Para salvar em PDF: clique em <b>Baixar PDF</b> e escolha <b>Salvar como PDF</b> no destino da impressão.</p>
        <div className="row" style={{ gap: 8 }}>
          <a className="btn" href={`/api/events/${id}/export`}>Exportar planilha</a>
          <button className="btn btn-primary" onClick={() => window.print()}>Baixar PDF</button>
        </div>
      </div>

      <section className="report-page stack" style={{ gap: 28, justifyContent: 'center', minHeight: 600 }}>
        <img src="/rg-academy-logo.png" alt="RG Academy — Educação Corporativa" style={{ width: 260, height: 'auto' }} />
        <div className="stack" style={{ gap: 10 }}>
          <span className="eyebrow">Relatório do evento</span>
          <h1 style={{ fontSize: 40, fontWeight: 800 }}>{r.event.title}</h1>
          <p className="muted" style={{ fontSize: 17 }}>{r.event.started_at ? fmt(r.event.started_at) : `Criado em ${fmt(r.event.created_at)}`}{r.presenter ? ` · Palestrante: ${r.presenter}` : ''}</p>
        </div>
        <div className="row" style={{ gap: 16 }}>
          <Stat n={r.participants} l="participantes" />
          <Stat n={r.responses} l="respostas" />
          <Stat n={interactive.length} l="atividades interativas" />
          <Stat n={slides.length} l="slides e vídeos" />
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <span className="eyebrow">Sequência do evento</span>
          {r.activities.map((a, i) => <span key={a.id} style={{ fontSize: 15 }}>{i + 1}. {a.title} <span className="muted">· {kindLabel(a)}</span></span>)}
        </div>
      </section>

      {interactive.map((a) => {
        const n = r.activities.indexOf(a) + 1;
        const c = a.config || {};
        return (
          <section key={a.id} className="report-page stack" style={{ gap: 18 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="eyebrow">Atividade {n} · {kindLabel(a)}</span>
              <img src="/rg-academy-logo.png" alt="" style={{ height: 28, width: 'auto' }} />
            </div>
            {a.kind === 'cloud' ? (
              <>
                <h2 style={{ fontSize: 26, fontWeight: 800 }}>{c.question}</h2>
                <p className="muted">{a.results.total} palavras enviadas</p>
                <div style={{ border: '1px solid var(--line)', borderRadius: 14, height: 380, display: 'flex', padding: 12 }}>
                  <WordCloud words={a.results.words} light empty="Nenhuma palavra enviada." />
                </div>
                {a.results.words.length ? (
                  <div className="stack" style={{ gap: 4 }}>
                    <span className="eyebrow">Mais citadas</span>
                    <p style={{ fontSize: 15 }}>{a.results.words.slice(0, 15).map((w) => `${w.text} (${w.count})`).join(' · ')}</p>
                  </div>
                ) : null}
              </>
            ) : null}
            {a.kind === 'choice' ? (
              <>
                <h2 style={{ fontSize: 26, fontWeight: 800 }}>{c.question}</h2>
                <p className="muted">{a.results.voters} {a.results.voters === 1 ? 'pessoa votou' : 'pessoas votaram'}{c.multi ? ` · até ${c.maxSelect} opções por pessoa` : ''}</p>
                <ReportBars options={c.options || []} counts={a.results.counts} />
              </>
            ) : null}
            {a.kind === 'quiz' ? (
              <>
                <h2 style={{ fontSize: 26, fontWeight: 800 }}>{a.title}</h2>
                {(a.questions || []).map((q, qi) => {
                  const right = (q.counts || [])[q.correct] || 0;
                  const pct = q.answered ? Math.round((right / q.answered) * 100) : 0;
                  return (
                    <div key={qi} className="stack" style={{ gap: 8, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
                      <strong style={{ fontSize: 17 }}>{qi + 1}. {q.text}</strong>
                      <span className="muted" style={{ fontSize: 14 }}>{q.answered} respostas · {pct}% de acerto · resposta certa: {letters(q.correct)}. {q.options[q.correct]}</span>
                      <ReportBars options={q.options.map((o, k) => `${letters(k)}. ${o}${k === q.correct ? ' ✓' : ''}`)} counts={q.counts || []} />
                    </div>
                  );
                })}
                <div className="stack" style={{ gap: 6 }}>
                  <span className="eyebrow">Ranking final</span>
                  {(a.ranking || []).length ? a.ranking.map((p) => (
                    <div key={p.pos} className="row" style={{ justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, background: p.pos === 1 ? 'var(--green-soft)' : '#F4F6F8' }}>
                      <span><b>{p.pos}º</b> {p.name}</span><b>{p.score} pts</b>
                    </div>
                  )) : <p className="muted">Ninguém pontuou.</p>}
                </div>
              </>
            ) : null}
            {a.kind === 'qa' ? (
              <>
                <h2 style={{ fontSize: 26, fontWeight: 800 }}>{c.question || a.title}</h2>
                <p className="muted">{(a.questions || []).length} {(a.questions || []).length === 1 ? 'pergunta aprovada' : 'perguntas aprovadas'} · ordenadas por curtidas</p>
                {(a.questions || []).length ? a.questions.map((q, qi) => (
                  <div key={q.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '10px 12px', borderRadius: 10, background: '#F4F6F8', flexWrap: 'nowrap' }}>
                    <span style={{ fontSize: 15 }}><b>{qi + 1}.</b> {q.text} <span className="muted">— {q.author || 'Anônimo'}{q.status === 'answered' ? ' · respondida' : ''}</span></span>
                    <b style={{ flex: 'none' }}>👍 {q.likes}</b>
                  </div>
                )) : <p className="muted">Nenhuma pergunta aprovada.</p>}
              </>
            ) : null}
            {a.kind === 'raffle' ? (
              <>
                <h2 style={{ fontSize: 26, fontWeight: 800 }}>{c.prize ? `Sorteio: ${c.prize}` : 'Sorteio'}</h2>
                {(a.winners || []).length ? a.winners.map((w, wi) => (
                  <div key={wi} className="row" style={{ padding: '8px 12px', borderRadius: 10, background: wi === 0 ? 'var(--green-soft)' : '#F4F6F8' }}><b>{wi + 1}º sorteado:</b>&nbsp;{w}</div>
                )) : <p className="muted">Nenhum sorteio realizado.</p>}
              </>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function Stat({ n, l }) {
  return (
    <div className="card stack" style={{ gap: 2, minWidth: 150, padding: 16 }}>
      <span style={{ fontSize: 34, fontWeight: 800 }}>{n}</span>
      <span className="muted">{l}</span>
    </div>
  );
}
