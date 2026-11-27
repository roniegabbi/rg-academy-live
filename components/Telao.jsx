'use client';

import { useEffect, useRef, useState } from 'react';
import QR from './QR';
import WordCloud from './WordCloud';
import { useNow, letters } from './client';

// Telão: cada tela é desenhada em 1280×720 (o modelo aprovado) e ampliada para o projetor.
const W = 1280;
const H = 720;

export function remainingSeconds(data, now) {
  if (!data || !data.run || !data.run.endsAt) return 0;
  const offset = (data.serverNow || data._recv || now) - (data._recv || now);
  return Math.max(0, Math.ceil((data.run.endsAt - (now + offset)) / 1000));
}

function hostOf(u) {
  try { return u ? new URL(u).host : ''; } catch { return ''; }
}

const MAZE = (
  <>
    <path d="M96 118 h56 v264 c0 33 27 60 60 60 h12 v-56 h-12 c-2.2 0-4-1.8-4-4 V118 Z" />
    <path d="M96 118 h150 v56 H152 v-56 Z" />
    <path d="M222 118 h56 v210 h-56 Z" />
    <path d="M152 200 h70 v56 h-70 Z" />
    <path d="M180 256 h42 v126 h-56 v-70 h14 Z" />
  </>
);

function Stage({ full, children }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => setScale(Math.min(el.clientWidth / W, el.clientHeight / H));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const outer = full
    ? { position: 'fixed', inset: 0 }
    : { position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 18 };
  return (
    <div ref={ref} style={{ ...outer, overflow: 'hidden', background: '#07182A' }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: W, height: H, transform: `translate(-50%, -50%) scale(${scale || 0.001})`, fontFamily: 'var(--font-outfit), Outfit, system-ui, sans-serif', color: '#fff' }}>
        {children}
      </div>
    </div>
  );
}

function Backdrop({ glow = 'right', logo = true, mark = false }) {
  const g = glow === 'center'
    ? 'radial-gradient(45% 60% at 50% 55%, rgba(69,176,43,0.26) 0%, rgba(69,176,43,0.06) 45%, rgba(7,24,42,0) 70%)'
    : 'radial-gradient(120% 90% at 78% 8%, rgba(27,74,116,0.85) 0%, rgba(14,42,69,0.5) 45%, rgba(7,24,42,0) 100%)';
  return (
    <>
      <div style={{ position: 'absolute', inset: -2, background: g }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1.4px)', backgroundSize: '28px 28px', opacity: 0.5 }} />
      {mark ? <svg viewBox="80 100 220 360" width="560" height="916" fill="#FFFFFF" aria-hidden="true" style={{ position: 'absolute', right: -90, bottom: -260, opacity: 0.045 }}>{MAZE}</svg> : null}
      {logo ? <img src="/rg-academy-logo.png" alt="RG Academy" style={{ position: 'absolute', left: 48, top: 36, height: 30, width: 'auto', filter: 'brightness(0) invert(1)', opacity: 0.92 }} /> : null}
    </>
  );
}

function Foot({ joinUrl, pin, participants }) {
  return (
    <div style={{ position: 'absolute', left: 48, right: 48, bottom: 28, display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 18px 6px 6px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fff', padding: 3, boxSizing: 'border-box' }}>{joinUrl ? <QR value={joinUrl} size={160} style={{ width: 34, height: 34 }} /> : null}</div>
        <span style={{ fontSize: 16, color: '#C9D6E2' }}>{hostOf(joinUrl)} · PIN <strong style={{ color: '#7FD35F', letterSpacing: '0.08em' }}>{pin}</strong></span>
      </div>
      <div style={{ flex: 1 }} />
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, color: '#C9D6E2' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#45B02B' }} />
        <strong style={{ color: '#fff' }}>{participants || 0}</strong> {participants === 1 ? 'participante' : 'participantes'}
      </span>
    </div>
  );
}

function Pill({ children, green }) {
  return (
    <span style={{ flex: 'none', marginTop: 8, padding: '8px 16px', borderRadius: 999, background: green ? 'rgba(69,176,43,0.18)' : 'rgba(255,255,255,0.1)', border: green ? '1px solid rgba(127,211,95,0.4)' : '1px solid transparent', fontSize: 18, color: '#C9D6E2', whiteSpace: 'nowrap' }}>{children}</span>
  );
}

function Question({ eyebrow, text, pill }) {
  return (
    <div style={{ position: 'absolute', left: 48, right: 48, top: 96, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {eyebrow ? <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7FD35F' }}>{eyebrow}</span> : null}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24 }}>
        <h1 style={{ margin: 0, flex: 1, fontSize: text.length > 80 ? 38 : 46, lineHeight: 1.1, fontWeight: 700 }}>{text}</h1>
        {pill || null}
      </div>
    </div>
  );
}

/* ---------- telas ---------- */

function Cover({ a, title }) {
  const heading = a.heading || title;
  const words = heading.split(/\s+/);
  const cut = words.length > 2 ? Math.ceil(words.length / 2) - (words.length % 2 === 0 ? 0 : 0) : 1;
  const first = words.slice(0, Math.max(1, Math.floor(words.length / 2))).join(' ');
  const second = words.slice(Math.max(1, Math.floor(words.length / 2))).join(' ');
  const bg = (a.bgWord || words[words.length - 1] || '').toUpperCase();
  const size = heading.length > 34 ? 88 : heading.length > 24 ? 110 : 132;
  const meta = [a.presenter, a.date, a.place].filter(Boolean);
  void cut;
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#061423' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(60% 70% at 50% 60%, rgba(69,176,43,0.25) 0%, rgba(6,20,35,0) 70%)' }} />
      {bg ? <div style={{ position: 'absolute', left: -200, right: -200, top: 160, textAlign: 'center', fontSize: bg.length > 8 ? 200 : 260, lineHeight: 0.8, fontWeight: 900, letterSpacing: '-0.05em', color: 'transparent', WebkitTextStroke: '2px rgba(127,211,95,0.18)', whiteSpace: 'nowrap' }}>{bg}</div> : null}
      <img src="/rg-academy-logo.png" alt="RG Academy" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 64, height: 38, width: 'auto', filter: 'brightness(0) invert(1)' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, textAlign: 'center', padding: '20px 80px 0' }}>
        {a.eyebrow ? <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#7FD35F' }}>{a.eyebrow}</span> : null}
        <h1 style={{ margin: 0, fontSize: size, lineHeight: 0.88, fontWeight: 900, letterSpacing: '-0.04em' }}>
          {first}{second ? <><br /><span style={{ color: '#45B02B' }}>{second}</span></> : null}
        </h1>
        {a.text ? <p style={{ margin: 0, fontSize: 24, fontWeight: 300, color: '#C9D6E2', maxWidth: 900 }}>{a.text}</p> : null}
      </div>
      {meta.length ? (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 96, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, fontSize: 18, color: '#C9D6E2' }}>
          {meta.map((m, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              {i > 0 ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#45B02B' }} /> : null}
              {i === 0 && a.presenter ? <strong style={{ color: '#fff' }}>{m}</strong> : <span>{m}</span>}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function QrSlide({ joinUrl, pin, participants, note }) {
  return (
    <>
      <Backdrop glow="center" mark={false} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30 }}>
        <h1 style={{ margin: 0, fontSize: 56, lineHeight: 1, fontWeight: 800, letterSpacing: '-0.02em', textAlign: 'center' }}>Leia o QR code <span style={{ color: '#45B02B' }}>e participe</span></h1>
        <div style={{ width: 400, height: 400, borderRadius: 36, background: '#fff', boxShadow: '0 0 0 10px rgba(69,176,43,0.25), 0 30px 90px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {joinUrl ? <QR value={joinUrl} size={800} style={{ width: 340, height: 340 }} /> : null}
        </div>
        <p style={{ margin: 0, fontSize: 20, color: '#9FB3C6' }}>Sem câmera? Acesse <strong style={{ color: '#fff' }}>{hostOf(joinUrl)}</strong> e use o PIN <strong style={{ color: '#7FD35F', letterSpacing: '0.1em' }}>{pin}</strong></p>
      </div>
      <div style={{ position: 'absolute', right: 48, bottom: 32, display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, color: '#C9D6E2' }}>
        {note ? <span style={{ color: '#7FD35F', fontWeight: 700, marginRight: 16 }}>{note}</span> : null}
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#45B02B' }} /><strong style={{ color: '#fff' }}>{participants || 0}</strong> {participants === 1 ? 'conectado' : 'conectados'}
      </div>
    </>
  );
}

function TextSlide({ a }) {
  return (
    <>
      <Backdrop />
      <div style={{ position: 'absolute', left: 120, right: 200, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28 }}>
        <h1 style={{ margin: 0, fontSize: (a.heading || a.title).length > 40 ? 72 : 96, lineHeight: 1, fontWeight: 800, letterSpacing: '-0.02em' }}>{a.heading || a.title}</h1>
        <div style={{ width: 96, height: 8, borderRadius: 4, background: '#45B02B' }} />
        {a.text ? <p style={{ margin: 0, fontSize: a.text.length > 220 ? 24 : 32, lineHeight: 1.35, color: '#C9D6E2', maxWidth: 860, whiteSpace: 'pre-line' }}>{a.text}</p> : null}
      </div>
    </>
  );
}

function ImageSlide({ a }) {
  if (!a.imageUrl) return <Backdrop />;
  return (
    <>
      <div style={{ position: 'absolute', inset: -40, backgroundImage: `url(${a.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(40px) brightness(0.45)' }} />
      <img src={a.imageUrl} alt={a.title} style={{ position: 'absolute', inset: 24, width: 'calc(100% - 48px)', height: 'calc(100% - 48px)', objectFit: 'contain', borderRadius: 10 }} />
    </>
  );
}

function VideoSlide({ a }) {
  return (
    <>
      <Backdrop logo={false} />
      {a.youtubeId ? (
        <div style={{ position: 'absolute', inset: 24, borderRadius: 14, overflow: 'hidden', background: '#000', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
          <iframe src={`https://www.youtube-nocookie.com/embed/${a.youtubeId}?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3`} title={a.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen style={{ width: '100%', height: '100%', border: 0 }} />
        </div>
      ) : <p style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9FB3C6', fontSize: 24 }}>Link do vídeo não definido</p>}
    </>
  );
}

function CloudScreen({ results }) {
  return (
    <>
      <Backdrop logo={false} />
      <div style={{ position: 'absolute', left: 60, right: 60, top: 50, bottom: 50, display: 'flex' }}>
        <WordCloud words={(results && results.words) || []} empty="As palavras do público aparecem aqui…" />
      </div>
    </>
  );
}

function ChoiceScreen({ a, results, foot }) {
  const counts = (results && results.counts) || [];
  const total = counts.reduce((s, n) => s + n, 0);
  const top = Math.max(0, ...counts);
  const voters = (results && results.voters) || 0;
  const n = a.options.length;
  const barH = n <= 4 ? 76 : n <= 6 ? 58 : 42;
  const gap = n <= 4 ? 22 : 14;
  return (
    <>
      <Backdrop />
      <Question text={a.question} pill={<Pill><strong style={{ color: '#fff' }}>{voters}</strong> {voters === 1 ? 'voto' : 'votos'}</Pill>} />
      <div style={{ position: 'absolute', left: 48, right: 48, top: 230, bottom: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap }}>
        {a.options.map((label, i) => {
          const c = counts[i] || 0;
          const pct = total ? Math.round((c / total) * 100) : 0;
          const lead = c === top && top > 0;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ position: 'relative', flex: 1, height: barH, borderRadius: 16, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div className="bar-grow" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct + '%', borderRadius: 16, background: lead ? 'linear-gradient(90deg, #3C9C25, #5CC63E)' : 'rgba(111,183,255,0.35)', transition: 'width .8s cubic-bezier(.2,.8,.2,1)' }} />
                <span style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', fontSize: barH > 50 ? 28 : 22, fontWeight: lead ? 700 : 600, color: lead && pct > 25 ? '#0B2238' : '#fff', whiteSpace: 'nowrap' }}>{label}</span>
              </div>
              <div style={{ width: 150, textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: barH > 50 ? 44 : 34, fontWeight: 800, lineHeight: 1, color: lead ? '#7FD35F' : '#fff' }}>{pct}%</span>
                <span style={{ fontSize: 16, color: '#9FB3C6' }}>{c} {c === 1 ? 'voto' : 'votos'}</span>
              </div>
            </div>
          );
        })}
      </div>
      {foot}
    </>
  );
}

function TimerRing({ secs, total }) {
  const r = 34;
  const len = 2 * Math.PI * r;
  const frac = total ? Math.max(0, Math.min(1, secs / total)) : 0;
  return (
    <div style={{ position: 'relative', width: 84, height: 84, flex: 'none' }}>
      <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
        <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="7" />
        <circle cx="42" cy="42" r={r} fill="none" stroke={secs <= 5 ? '#F2A93B' : '#45B02B'} strokeWidth="7" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - frac)} transform="rotate(-90 42 42)" style={{ transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800 }}>{secs}</span>
    </div>
  );
}

function QuizScreen({ a, run, results, data, now, foot }) {
  const phase = run.phase;
  const eyebrow = `Quiz · pergunta ${a.qIndex + 1} de ${a.qTotal}`;
  if (phase === 'ready') {
    return (
      <>
        <Backdrop glow="center" />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, textAlign: 'center' }}>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7FD35F' }}>Quiz</span>
          <h1 style={{ margin: 0, fontSize: 150, lineHeight: 0.9, fontWeight: 900, letterSpacing: '-0.04em' }}>Pergunta {a.qIndex + 1}</h1>
          <p style={{ margin: 0, fontSize: 28, color: '#C9D6E2' }}>de {a.qTotal} · Prepare o celular: quanto mais rápido acertar, mais pontos.</p>
        </div>
        {foot}
      </>
    );
  }
  if (phase === 'rank') return <Podium ranking={(results && results.ranking) || []} />;
  const revealed = phase === 'reveal';
  const counts = (results && results.counts) || [];
  const answered = (results && results.answered) || 0;
  const secs = remainingSeconds(data, now);
  const right = revealed && answered ? Math.round(((counts[a.correct] || 0) / answered) * 100) : 0;
  const n = a.options.length;
  const optH = n <= 3 ? 92 : 78;
  return (
    <>
      <Backdrop />
      <Question eyebrow={eyebrow} text={a.question} pill={revealed
        ? <Pill green><strong style={{ color: '#7FD35F' }}>{right}%</strong> acertaram</Pill>
        : <div style={{ marginTop: -4 }}><TimerRing secs={phase === 'closed' ? 0 : secs} total={a.seconds} /></div>} />
      <div style={{ position: 'absolute', left: 48, right: 48, top: 250, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {a.options.map((o, i) => {
          const ok = revealed && i === a.correct;
          const dim = revealed && !ok;
          const pct = answered ? Math.round(((counts[i] || 0) / answered) * 100) : 0;
          return (
            <div key={i} style={{ position: 'relative', height: optH, borderRadius: 18, overflow: 'hidden', background: ok ? '#45B02B' : 'rgba(255,255,255,0.07)', boxShadow: ok ? '0 12px 40px rgba(69,176,43,0.35)' : 'none', transition: 'background .4s' }}>
              {dim ? <div className="bar-grow" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct + '%', background: 'rgba(255,255,255,0.08)' }} /> : null}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap: 20, padding: '0 24px' }}>
                <span style={{ width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, background: ok ? '#0B2238' : dim ? 'rgba(255,255,255,0.14)' : '#fff', color: ok || dim ? '#fff' : '#0B2238', flex: 'none' }}>{letters(i)}</span>
                <span style={{ flex: 1, fontSize: 32, fontWeight: 700, color: ok ? '#0B2238' : dim ? 'rgba(255,255,255,0.55)' : '#fff' }}>{o}</span>
                {ok ? <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#0B2238" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> : null}
                {revealed ? <span style={{ width: 120, textAlign: 'right', fontSize: 32, fontWeight: 800, color: ok ? '#0B2238' : 'rgba(255,255,255,0.55)' }}>{pct}%</span> : null}
              </div>
            </div>
          );
        })}
      </div>
      {!revealed ? (
        <div style={{ position: 'absolute', right: 48, bottom: 96, fontSize: 18, color: '#C9D6E2' }}>
          {phase === 'closed' ? <strong style={{ color: '#F2A93B' }}>Tempo esgotado · </strong> : null}<strong style={{ color: '#fff' }}>{answered}</strong> {answered === 1 ? 'resposta' : 'respostas'}
        </div>
      ) : null}
      {foot}
    </>
  );
}

const TROPHY = (
  <svg width="104" height="104" viewBox="0 0 64 64" role="img" aria-label="Troféu do vencedor" style={{ filter: 'drop-shadow(0 10px 24px rgba(242,201,76,0.45))' }}>
    <path d="M18 8h28v14c0 9-6.3 16-14 16S18 31 18 22V8z" fill="#F2C94C" />
    <path d="M18 12H9v5c0 7 5 12 11 12.6M46 12h9v5c0 7-5 12-11 12.6" fill="none" stroke="#F2C94C" strokeWidth="4" strokeLinecap="round" />
    <path d="M26 6h12" stroke="#F7DC86" strokeWidth="4" strokeLinecap="round" />
    <path d="M29 37h6v8h-6z" fill="#D9A92E" />
    <path d="M21 45h22a3 3 0 013 3v6H18v-6a3 3 0 013-3z" fill="#D9A92E" />
    <path d="M15 54h34v4H15z" fill="#B8871C" />
    <path d="M32 14l2.6 5.3 5.8.8-4.2 4.1 1 5.8L32 27.3 26.8 30l1-5.8-4.2-4.1 5.8-.8z" fill="#FFF4C7" />
  </svg>
);

function Medal({ n, c1, c2, ribbon, label }) {
  return (
    <svg width="68" height="80" viewBox="0 0 48 56" role="img" aria-label={label} style={{ filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.35))' }}>
      <path d="M14 2h8l6 18h-8z" fill={ribbon} />
      <path d="M34 2h-8l-6 18h8z" fill="#45B02B" />
      <circle cx="24" cy="36" r="17" fill={c1} />
      <circle cx="24" cy="36" r="12.5" fill="none" stroke={c2} strokeWidth="2.5" />
      <text x="24" y="42" textAnchor="middle" fontFamily="Outfit, sans-serif" fontSize="16" fontWeight="800" fill="#0B2238">{n}</text>
    </svg>
  );
}

function initials(name) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

function Podium({ ranking }) {
  const p1 = ranking[0];
  const p2 = ranking[1];
  const p3 = ranking[2];
  const rest = ranking.slice(3, 10);
  const col = (p, pos, h, avatar, block, icon, delay) => (
    <div className="podium-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: 280, animationDelay: delay + 's', visibility: p ? 'visible' : 'hidden' }}>
      {icon}
      <span style={{ width: 72, height: 72, borderRadius: '50%', background: avatar, color: '#0B2238', fontSize: 26, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.35)' }}>{p ? initials(p.name) : ''}</span>
      <span style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', maxWidth: 270, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p ? p.name : ''}</span>
      <span style={{ fontSize: 20, color: '#C9D6E2' }}>{p ? p.score.toLocaleString('pt-BR') : 0} pts</span>
      <div style={{ width: '100%', height: h, borderRadius: '18px 18px 0 0', background: block, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 16, boxSizing: 'border-box' }}>
        <span style={{ fontSize: 56, fontWeight: 800, color: '#0B2238' }}>{pos}º</span>
      </div>
    </div>
  );
  return (
    <>
      <Backdrop />
      <div style={{ position: 'absolute', left: 48, right: 48, top: 92, textAlign: 'center' }}>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7FD35F' }}>Ranking do quiz</span>
      </div>
      {!ranking.length ? <p style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#9FB3C6' }}>Ninguém pontuou nesta rodada.</p> : (
        <>
          <div style={{ position: 'absolute', left: rest.length ? 40 : 200, top: 130, bottom: 0, width: 880, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 16 }}>
            {col(p2, 2, 150, '#A9D8FF', 'linear-gradient(180deg, #C9D6E2, #8FA6BA)', <Medal n={2} c1="#D9E2EA" c2="#9FB3C6" ribbon="#2F6FDE" label="Medalha de prata, 2º lugar" />, 0.35)}
            {col(p1, 1, 220, '#7FD35F', 'linear-gradient(180deg, #7FD35F, #45B02B)', TROPHY, 0.7)}
            {col(p3, 3, 110, '#F2C894', 'linear-gradient(180deg, #F2C894, #C99258)', <Medal n={3} c1="#E0A96D" c2="#B47A3C" ribbon="#C62828" label="Medalha de bronze, 3º lugar" />, 0)}
          </div>
          {rest.length ? (
            <div style={{ position: 'absolute', right: 48, top: 200, width: 300, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rest.map((r) => (
                <div key={r.pos} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 18px', borderRadius: 14, background: 'rgba(255,255,255,0.06)', fontSize: 20 }}>
                  <strong style={{ width: 36, color: '#9FB3C6' }}>{r.pos}º</strong>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                  <strong>{r.score.toLocaleString('pt-BR')}</strong>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

function Ended({ title, participants, stats }) {
  const items = [[participants || 0, participants === 1 ? 'participante' : 'participantes']];
  if (stats) {
    items.push([stats.responses, stats.responses === 1 ? 'resposta' : 'respostas']);
    items.push([stats.activities, stats.activities === 1 ? 'atividade' : 'atividades']);
  }
  return (
    <>
      <Backdrop glow="center" />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, textAlign: 'center' }}>
        <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7FD35F' }}>{title}</span>
        <h1 style={{ margin: 0, fontSize: 120, lineHeight: 0.95, fontWeight: 800, letterSpacing: '-0.02em' }}>Obrigado!</h1>
        <p style={{ margin: 0, fontSize: 28, color: '#C9D6E2' }}>Sua participação fez este encontro acontecer.</p>
        <div style={{ display: 'flex', gap: 18, marginTop: 18 }}>
          {items.map(([n, l]) => (
            <div key={l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '20px 36px', borderRadius: 20, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', minWidth: 170 }}>
              <span style={{ fontSize: 56, fontWeight: 800, lineHeight: 1 }}>{Number(n).toLocaleString('pt-BR')}</span>
              <span style={{ fontSize: 20, color: '#C9D6E2' }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------- perguntas ao palestrante ---------- */

function QaScreen({ a, run, results, foot }) {
  const all = (results && results.questions) || [];
  const hl = run.highlight ? all.find((q) => q.id === run.highlight) : null;
  if (hl) {
    const size = hl.text.length > 140 ? 46 : hl.text.length > 80 ? 56 : 68;
    return (
      <>
        <Backdrop glow="center" />
        <div style={{ position: 'absolute', left: 120, right: 120, top: 110, bottom: 120, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28 }}>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7FD35F' }}>Pergunta do público</span>
          <div style={{ position: 'relative' }}>
            <span aria-hidden="true" style={{ position: 'absolute', left: -78, top: -46, fontSize: 160, lineHeight: 1, fontWeight: 900, color: 'rgba(127,211,95,0.35)' }}>“</span>
            <h1 style={{ margin: 0, fontSize: size, lineHeight: 1.12, fontWeight: 700, letterSpacing: '-0.01em' }}>{hl.text}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 24, color: '#C9D6E2' }}>
            <span>— <strong style={{ color: '#fff' }}>{hl.author || 'Anônimo'}</strong></span>
            {hl.likes ? <span style={{ padding: '6px 16px', borderRadius: 999, background: 'rgba(255,255,255,0.1)' }}>👍 {hl.likes}</span> : null}
          </div>
        </div>
        {foot}
      </>
    );
  }
  const list = all.filter((q) => q.status === 'approved').slice(0, 5);
  const count = all.filter((q) => q.status !== 'pending').length;
  return (
    <>
      <Backdrop />
      <Question eyebrow="Perguntas ao palestrante" text={a.question} pill={<Pill><strong style={{ color: '#fff' }}>{count}</strong> {count === 1 ? 'pergunta' : 'perguntas'}</Pill>} />
      <div style={{ position: 'absolute', left: 48, right: 48, top: 230, bottom: 100, display: 'flex', flexDirection: 'column', justifyContent: list.length ? 'flex-start' : 'center', gap: 12 }}>
        {list.length ? list.map((q, i) => (
          <div key={q.id} className="stage-in" style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '14px 22px', borderRadius: 16, background: i === 0 ? 'rgba(69,176,43,0.16)' : 'rgba(255,255,255,0.07)', border: i === 0 ? '1px solid rgba(127,211,95,0.35)' : '1px solid transparent' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: q.text.length > 110 ? 21 : 25, fontWeight: 600, lineHeight: 1.25, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{q.text}</div>
              <div style={{ fontSize: 16, color: '#9FB3C6', marginTop: 4 }}>{q.author || 'Anônimo'}</div>
            </div>
            <span style={{ flex: 'none', fontSize: 26, fontWeight: 800, color: i === 0 ? '#7FD35F' : '#fff' }}>👍 {q.likes}</span>
          </div>
        )) : (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
            <span style={{ fontSize: 72 }} aria-hidden="true">💬</span>
            <p style={{ margin: 0, fontSize: 34, fontWeight: 600 }}>Envie sua pergunta pelo celular</p>
            <p style={{ margin: 0, fontSize: 22, color: '#9FB3C6' }}>As mais curtidas sobem para o topo.</p>
          </div>
        )}
      </div>
      {foot}
    </>
  );
}

/* ---------- sorteio ---------- */

function RaffleScreen({ a, run, results, data, now, foot }) {
  const winners = (results && results.winners) || [];
  const names = (results && results.names) || [];
  const latest = winners[winners.length - 1];
  const serverNow = now + ((data.serverNow || data._recv || now) - (data._recv || now));
  const elapsed = run.drawnAt ? serverNow - run.drawnAt : Infinity;
  const ROLL = 3600;
  const prize = a.prize ? <span style={{ fontSize: 22, color: '#C9D6E2' }}>Prêmio: <strong style={{ color: '#fff' }}>{a.prize}</strong></span> : null;

  if (!latest) {
    const n = (results && results.eligible) || 0;
    return (
      <>
        <Backdrop glow="center" />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, textAlign: 'center', paddingBottom: 40 }}>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7FD35F' }}>Sorteio</span>
          <h1 style={{ margin: 0, fontSize: 84, lineHeight: 1, fontWeight: 800, letterSpacing: '-0.02em', maxWidth: 1080 }}>{a.prize || 'Quem será o sortudo?'}</h1>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 10 }}>
            <span style={{ fontSize: 96, fontWeight: 800, color: '#7FD35F', lineHeight: 1 }}>{n}</span>
            <span style={{ fontSize: 28, color: '#C9D6E2' }}>{n === 1 ? 'pessoa concorrendo' : 'pessoas concorrendo'}</span>
          </div>
          {a.onlyNamed ? <p style={{ margin: 0, fontSize: 20, color: '#9FB3C6' }}>Participa quem entrou com o nome. Ainda dá tempo: leia o QR code.</p> : null}
        </div>
        {foot}
      </>
    );
  }

  if (elapsed >= 0 && elapsed < ROLL && names.length) {
    const t = elapsed;
    const step = Math.floor(t / (55 + t / 14));
    const shown = names[step % names.length];
    return (
      <>
        <Backdrop glow="center" />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, textAlign: 'center' }}>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7FD35F' }}>Sorteando…</span>
          <div style={{ padding: '26px 60px', borderRadius: 28, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', minWidth: 720 }}>
            <span style={{ fontSize: 80, fontWeight: 800, letterSpacing: '-0.01em', opacity: 0.9 }}>{shown}</span>
          </div>
          {prize}
        </div>
      </>
    );
  }

  const before = winners.slice(0, -1).map((w) => w.name);
  return (
    <>
      <Backdrop glow="center" />
      <Confetti />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, textAlign: 'center', paddingBottom: 30 }}>
        <div className="podium-in">{TROPHY}</div>
        <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7FD35F' }}>{winners.length > 1 ? `${winners.length}º sorteado` : 'Parabéns!'}</span>
        <h1 className="podium-in" style={{ margin: 0, fontSize: latest.name.length > 22 ? 82 : 110, lineHeight: 1, fontWeight: 900, letterSpacing: '-0.03em' }}>{latest.name}</h1>
        {prize}
      </div>
      {before.length ? (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 96, textAlign: 'center', fontSize: 18, color: '#9FB3C6' }}>Já sorteados: {before.join(' · ')}</div>
      ) : null}
    </>
  );
}

// Confete discreto para o momento do sorteado.
function Confetti() {
  const pieces = useRef(null);
  if (!pieces.current) {
    const colors = ['#45B02B', '#7FD35F', '#F2C94C', '#6FB7FF', '#FFFFFF'];
    pieces.current = Array.from({ length: 46 }, (_, i) => ({ i, x: Math.random() * 1280, d: Math.random() * 1.2, dur: 2.6 + Math.random() * 1.8, c: colors[i % colors.length], w: 8 + Math.random() * 8, r: Math.random() * 360 }));
  }
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {pieces.current.map((p) => (
        <span key={p.i} className="confetti" style={{ left: p.x, width: p.w, height: p.w * 0.45, background: p.c, animationDelay: p.d + 's', animationDuration: p.dur + 's', '--rot': p.r + 'deg' }} />
      ))}
    </div>
  );
}

// Reações do público subindo pela lateral direita do palco.
function Reactions({ list }) {
  const seen = useRef(new Set());
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!list || !list.length) return;
    const fresh = list.filter((r) => !seen.current.has(r.id)).slice(0, 30);
    if (!fresh.length) return;
    fresh.forEach((r) => seen.current.add(r.id));
    if (seen.current.size > 3000) seen.current = new Set(fresh.map((r) => r.id));
    const born = fresh.map((r, i) => ({ id: r.id, emoji: r.emoji, x: 1150 + Math.random() * 80, delay: i * 0.12 + Math.random() * 0.3, dur: 3.2 + Math.random() * 1.4, size: 40 + Math.random() * 22, sway: (Math.random() * 60 - 30).toFixed(0) }));
    setItems((cur) => [...cur.slice(-60), ...born]);
    const ids = new Set(born.map((b) => b.id));
    const t = setTimeout(() => setItems((cur) => cur.filter((x) => !ids.has(x.id))), 6500);
    return () => clearTimeout(t);
  }, [list]);
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 5 }}>
      {items.map((it) => (
        <span key={it.id} className="react-float" style={{ position: 'absolute', left: it.x, bottom: -60, fontSize: it.size, animationDuration: it.dur + 's', animationDelay: it.delay + 's', '--sway': it.sway + 'px' }}>{it.emoji}</span>
      ))}
    </div>
  );
}

export default function Telao({ data, joinUrl, full = false }) {
  const now = useNow(250);
  if (!data) return <Stage full={full}><Backdrop /></Stage>;
  const { event, activity: a, run = {}, results, participants, paused } = data;
  const status = event.status;
  const foot = <Foot joinUrl={joinUrl} pin={event.pin} participants={participants} />;

  let screen;
  let key;
  if (status === 'draft') {
    key = 'draft';
    screen = <QrSlide joinUrl={joinUrl} pin={event.pin} participants={participants} note="O evento vai começar em instantes" />;
  } else if (status === 'ended') {
    key = 'ended';
    screen = <Ended title={event.title} participants={participants} stats={data.stats} />;
  } else if (!a) {
    key = 'empty';
    screen = <Backdrop />;
  } else if (a.kind === 'slide') {
    key = a.id;
    if (a.mode === 'cover') screen = <Cover a={a} title={event.title} />;
    else if (a.mode === 'qr') screen = <QrSlide joinUrl={joinUrl} pin={event.pin} participants={participants} />;
    else if (a.mode === 'image') screen = <ImageSlide a={a} />;
    else if (a.mode === 'youtube') screen = <VideoSlide a={a} />;
    else screen = <TextSlide a={a} />;
  } else if (a.kind === 'cloud') {
    key = a.id;
    screen = <CloudScreen results={results} />;
  } else if (a.kind === 'choice') {
    key = a.id;
    screen = <ChoiceScreen a={a} results={results} foot={foot} />;
  } else if (a.kind === 'qa') {
    key = `${a.id}:${run.highlight || 'list'}`;
    screen = <QaScreen a={a} run={run} results={results} foot={foot} />;
  } else if (a.kind === 'raffle') {
    key = `${a.id}:${((results && results.winners) || []).length}`;
    screen = <RaffleScreen a={a} run={run} results={results} data={data} now={now} foot={foot} />;
  } else if (a.kind === 'quiz') {
    key = `${a.id}:${a.qIndex}:${run.phase === 'rank' ? 'rank' : run.phase === 'ready' ? 'ready' : 'q'}`;
    screen = <QuizScreen a={a} run={run} results={results} data={data} now={now} foot={foot} />;
  }

  return (
    <Stage full={full}>
      <div key={key} className="stage-in" style={{ position: 'absolute', inset: 0 }}>{screen}</div>
      {status === 'live' ? <Reactions list={data.reactions} /> : null}
      {paused && status === 'live' && a && a.kind !== 'slide' ? (
        <span style={{ position: 'absolute', top: 32, right: 48, padding: '8px 16px', borderRadius: 999, background: '#F2A93B', color: '#0B2238', fontSize: 18, fontWeight: 700 }}>Respostas pausadas</span>
      ) : null}
    </Stage>
  );
}
