'use client';

import { letters } from './client';

const DARK_PALETTE = ['#7FD35F', '#FFFFFF', '#A9D8FF', '#45B02B', '#E3EEF7'];
const LIGHT_PALETTE = ['#2E7D1E', '#0B2238', '#2F5B82', '#45B02B', '#4A5D70'];

// Mapa de palavras: maior = mais citada, mais citadas no centro.
export function WordCloud({ words = [], light = false, scale = 1, empty = 'Aguardando as primeiras palavras do público…' }) {
  if (!words.length) return <div className="cloud"><span style={{ fontSize: 20 * scale, color: light ? '#4A5D70' : '#9FB3C6' }}>{empty}</span></div>;
  const max = words[0].count || 1;
  const palette = light ? LIGHT_PALETTE : DARK_PALETTE;
  const arranged = [];
  words.slice(0, 60).forEach((w, i) => {
    const r = w.count / max;
    const item = {
      ...w,
      size: Math.round((16 + r * 64) * scale),
      weight: r > 0.5 ? 800 : r > 0.25 ? 700 : 500,
      color: i === 0 ? (light ? '#2E7D1E' : '#7FD35F') : palette[i % palette.length]
    };
    if (i % 2 === 0) arranged.push(item); else arranged.unshift(item);
  });
  return (
    <div className={'cloud' + (light ? ' cloud-light' : '')}>
      {arranged.map((w) => (
        <span key={w.text} className="cloud-word" style={{ fontSize: w.size, color: w.color, fontWeight: w.weight }} title={`${w.text}: ${w.count}`}>{w.text}</span>
      ))}
    </div>
  );
}

// Gráfico de barras ao vivo (múltipla escolha).
export function Bars({ options = [], counts = [] }) {
  const total = counts.reduce((s, n) => s + n, 0);
  const top = Math.max(0, ...counts);
  return (
    <div className="bars">
      {options.map((label, i) => {
        const n = counts[i] || 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        const isTop = n === top && top > 0;
        return (
          <div className="bar-row" key={i}>
            <div className="bar-label">
              <span className="lbl">{label}</span>
              <span className="pct" style={{ color: isTop ? '#7FD35F' : '#FFFFFF' }}>{pct}%</span>
              <span className="cnt">{n} {n === 1 ? 'voto' : 'votos'}</span>
            </div>
            <div className="bar-track"><div className="bar-fill" style={{ width: pct + '%', background: isTop ? '#45B02B' : '#3D6E99' }} /></div>
          </div>
        );
      })}
    </div>
  );
}

export function QuizOptions({ options = [], correct = null, counts = null }) {
  const revealed = correct !== null && correct !== undefined;
  return (
    <div className="quiz-opts">
      {options.map((o, i) => {
        const cls = revealed ? (i === correct ? ' win' : ' lose') : '';
        return (
          <div key={i} className={'quiz-opt' + cls}>
            <span className="quiz-letter">{letters(i)}</span>
            <span style={{ flex: 1 }}>{o}</span>
            {revealed && counts ? <span>{counts[i] || 0}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

export function Ranking({ ranking = [] }) {
  if (!ranking.length) return <p style={{ fontSize: 22, color: '#9FB3C6' }}>Ninguém pontuou ainda.</p>;
  return (
    <div className="stack" style={{ gap: '1.2vh' }}>
      {ranking.map((r) => (
        <div key={r.pos} className="rank-row" style={r.pos === 1 ? { background: '#1D4A2A' } : null}>
          <span className="pos" style={{ color: r.pos <= 3 ? '#7FD35F' : '#fff' }}>{r.pos}º</span>
          <span className="nm">{r.name || 'Participante'}</span>
          <span className="sc">{r.score} pts</span>
        </div>
      ))}
    </div>
  );
}

// Versões claras para o relatório em PDF.
export function ReportBars({ options = [], counts = [] }) {
  const total = counts.reduce((s, n) => s + n, 0);
  const top = Math.max(0, ...counts);
  return (
    <div className="stack" style={{ gap: 14 }}>
      {options.map((label, i) => {
        const n = counts[i] || 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        return (
          <div key={i} className="stack" style={{ gap: 6 }}>
            <div className="row" style={{ justifyContent: 'space-between', fontSize: 15 }}>
              <span style={{ fontWeight: 600 }}>{label}</span>
              <span><b>{pct}%</b> <span className="muted">({n})</span></span>
            </div>
            <div className="report-bar-track"><div className={'report-bar-fill' + (n === top && top > 0 ? ' top' : '')} style={{ width: pct + '%' }} /></div>
          </div>
        );
      })}
    </div>
  );
}
