'use client';

import { letters } from './client';

export { default as WordCloud } from './WordCloud';

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
