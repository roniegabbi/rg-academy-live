'use client';

import { useState } from 'react';
import { api, letters } from './client';

// Painel "Criar com IA" do editor. O resultado sempre volta para revisão antes de salvar.
export default function AiPanel({ kind, onQuiz, onPoll, onCloud, onClose }) {
  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [count, setCount] = useState(kind === 'quiz' ? 10 : 3);
  const [level, setLevel] = useState('medio');
  const [seconds, setSeconds] = useState(15);
  const [mode, setMode] = useState('replace');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [suggestions, setSuggestions] = useState(null);

  const generate = async () => {
    setBusy(true);
    setErr('');
    setSuggestions(null);
    const r = await api('/api/ai/generate', { method: 'POST', body: { kind, topic, context, count, level, seconds } });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    if (kind === 'quiz') { onQuiz(r.questions, mode); onClose(); return; }
    setSuggestions(kind === 'choice' ? r.polls : r.questions);
  };

  const title = kind === 'quiz' ? 'Criar quiz com IA' : kind === 'choice' ? 'Sugerir enquete com IA' : 'Sugerir pergunta com IA';
  return (
    <div className="qbox" style={{ background: '#F3FAF0', borderColor: '#BFE3B2' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 16 }}>✨ {title}</strong>
        <button className="btn btn-sm btn-ghost" onClick={onClose}>Fechar</button>
      </div>
      <div className="field">
        <label htmlFor="ai-topic">Tema</label>
        <textarea id="ai-topic" className="textarea" style={{ minHeight: 70 }} maxLength={400} placeholder="Ex.: Liderança situacional para gestores de primeira viagem" value={topic} onChange={(e) => setTopic(e.target.value)} />
      </div>
      {kind === 'quiz' ? (
        <div className="row" style={{ gap: 12 }}>
          <label className="field" style={{ flex: '1 1 140px' }}><span className="label">Perguntas</span>
            <select className="select" value={count} onChange={(e) => setCount(Number(e.target.value))}>{[3, 5, 8, 10, 12, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}</select>
          </label>
          <label className="field" style={{ flex: '1 1 140px' }}><span className="label">Nível</span>
            <select className="select" value={level} onChange={(e) => setLevel(e.target.value)}><option value="facil">Fácil</option><option value="medio">Médio</option><option value="dificil">Difícil</option></select>
          </label>
          <label className="field" style={{ flex: '1 1 140px' }}><span className="label">Tempo por pergunta</span>
            <select className="select" value={seconds} onChange={(e) => setSeconds(Number(e.target.value))}>{[5, 10, 15, 20, 30, 45, 60].map((s) => <option key={s} value={s}>{s}s</option>)}</select>
          </label>
          <label className="field" style={{ flex: '1 1 180px' }}><span className="label">As perguntas geradas vão</span>
            <select className="select" value={mode} onChange={(e) => setMode(e.target.value)}><option value="replace">Substituir as atuais</option><option value="append">Somar às atuais</option></select>
          </label>
        </div>
      ) : null}
      {showContext ? (
        <div className="field">
          <label htmlFor="ai-ctx">Texto de apoio (opcional)</label>
          <textarea id="ai-ctx" className="textarea" maxLength={12000} placeholder="Cole aqui um trecho do seu material. A IA cria as perguntas a partir dele." value={context} onChange={(e) => setContext(e.target.value)} />
          <span className="hint">{context.length.toLocaleString('pt-BR')} / 12.000 caracteres</span>
        </div>
      ) : (
        <button className="btn btn-sm btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setShowContext(true)}>+ Usar um texto do meu material como base</button>
      )}
      {err ? <div className="alert" role="alert">{err}</div> : null}
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="hint">A IA pode errar: revise antes de salvar.</span>
        <button className="btn btn-primary" onClick={generate} disabled={busy || (topic.trim().length < 3 && context.trim().length < 30)}>{busy ? 'Gerando… (até 20s)' : kind === 'quiz' ? `Gerar ${count} perguntas` : 'Gerar sugestões'}</button>
      </div>
      {suggestions && kind === 'choice' ? (
        <div className="stack" style={{ gap: 8 }}>
          {suggestions.map((p, i) => (
            <div key={i} className="card stack" style={{ gap: 6, padding: 12 }}>
              <strong>{p.question}</strong>
              <span className="hint">{p.options.map((o, k) => `${letters(k)}. ${o}`).join(' · ')}</span>
              <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => { onPoll(p); onClose(); }}>Usar esta</button>
            </div>
          ))}
        </div>
      ) : null}
      {suggestions && kind === 'cloud' ? (
        <div className="stack" style={{ gap: 8 }}>
          {suggestions.map((q, i) => (
            <button key={i} className="act-item" style={{ border: '1px solid var(--line)' }} onClick={() => { onCloud(q); onClose(); }}>
              <span className="act-meta"><span className="t" style={{ whiteSpace: 'normal' }}>{q}</span><span className="k">Toque para usar</span></span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
