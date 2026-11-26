'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, usePoll, useNow, letters } from '@/components/client';
import { remainingSeconds } from '@/components/Telao';

const store = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch { /* modo privado */ } }
};

// Celular do participante: uma pergunta por tela, letras grandes, um botão principal.
export default function Participante() {
  const { pin } = useParams();
  const { data, offline, notFound } = usePoll(`/api/live/${pin}`, 1500);
  const [token, setToken] = useState(null);
  const [name, setName] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(store.get(`rg:${pin}:token`));
    setName(store.get('rg:name') || '');
    setReady(true);
  }, [pin]);

  if (notFound) return <Shell><Center title="Evento não encontrado" text="Confira o PIN ou aponte a câmera de novo para o QR code do telão." /></Shell>;
  if (!data || !ready) return <Shell><Center title="Conectando…" /></Shell>;

  const ev = data.event;
  if (!token) return <Shell event={ev} offline={offline}><Join pin={pin} ev={ev} name={name} setName={setName} onJoin={(t) => { store.set(`rg:${pin}:token`, t); setToken(t); }} /></Shell>;

  return (
    <Shell event={ev} offline={offline}>
      <Live pin={pin} data={data} token={token} />
    </Shell>
  );
}

function Shell({ event, offline, children }) {
  return (
    <main className="phone">
      {offline ? <div className="net-warn" role="status">Conexão instável. Reconectando…</div> : null}
      <header className="phone-head">
        <img src="/rg-academy-logo.png" alt="RG Academy" />
        {event ? <span className="hint">PIN {event.pin}</span> : null}
      </header>
      {children}
    </main>
  );
}

function Center({ title, text, icon, children }) {
  return (
    <div className="phone-body">
      <div className="phone-center">
        {icon || null}
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>{title}</h1>
        {text ? <p className="muted" style={{ fontSize: 18, lineHeight: 1.4 }}>{text}</p> : null}
        {children}
      </div>
    </div>
  );
}

const IconScreen = (
  <div className="circle-icon"><svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#2E7D1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M12 16v4M8 20h8" /></svg></div>
);
const IconCheck = (
  <div className="circle-icon"><svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#2E7D1E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></div>
);

function Join({ pin, ev, name, setName, onJoin }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const r = await api(`/api/live/${pin}/join`, { method: 'POST', body: { name } });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    store.set('rg:name', name);
    onJoin(r.token);
  };
  if (ev.status === 'ended') return <Center title="Evento encerrado" text="Obrigado pela participação!" />;
  return (
    <form className="phone-body" onSubmit={submit}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
        <span className="phone-kind">Você está no evento</span>
        <h1 style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.1 }}>{ev.title}</h1>
        <label htmlFor="nm" className="label" style={{ fontSize: 16, marginTop: 10 }}>{ev.requireName ? 'Seu nome' : 'Seu nome (opcional)'}</label>
        <input id="nm" className="input" style={{ fontSize: 20, padding: '16px 18px' }} placeholder="Ex.: Ana Paula" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} required={ev.requireName} autoComplete="name" />
        <span className="hint" style={{ fontSize: 14 }}>Aparece no ranking do quiz.</span>
        {err ? <div className="alert" role="alert">{err}</div> : null}
      </div>
      <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Entrando…' : 'Entrar no evento'}</button>
    </form>
  );
}

function Live({ pin, data, token }) {
  const ev = data.event;
  const a = data.activity;
  if (ev.status === 'draft') return <Center icon={IconScreen} title="Você está dentro!" text="O evento vai começar em instantes. Deixe esta tela aberta." />;
  if (ev.status === 'ended') return <Center icon={IconCheck} title="Evento encerrado" text="Obrigado pela participação!" />;
  if (!a || a.kind === 'slide') return <Center icon={IconScreen} title="Olhe para o telão" text="A próxima pergunta aparece aqui sozinha. Não precisa recarregar." />;
  if (a.kind === 'quiz') return <QuizPhone key={a.id + ':' + a.qIndex} pin={pin} data={data} token={token} />;
  if (data.paused) return <Center title="Respostas pausadas" text="O palestrante pausou esta atividade. Aguarde." />;
  if (a.kind === 'cloud') return <CloudPhone key={a.id} pin={pin} a={a} token={token} index={data.index} total={data.total} />;
  if (a.kind === 'choice') return <ChoicePhone key={a.id} pin={pin} a={a} token={token} index={data.index} total={data.total} />;
  return null;
}

function Header({ kind, index, total, question }) {
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="phone-kind">{kind}</span>
        <span className="hint">{index + 1} de {total}</span>
      </div>
      <h1 className="phone-q">{question}</h1>
    </>
  );
}

const EMOJIS = ['👏', '❤️', '🔥', '💡', '🚀', '💪', '🤝', '🎯', '😂', '🤔'];

function CloudPhone({ pin, a, token, index, total }) {
  const key = `rg:${pin}:${a.id}:words`;
  const ekey = `rg:${pin}:${a.id}:emojis`;
  const [sent, setSent] = useState(() => Number(store.get(key) || 0));
  const [esent, setEsent] = useState(() => Number(store.get(ekey) || 0));
  const [word, setWord] = useState('');
  const [last, setLast] = useState('');
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(sent === 0);
  const MAX = 3;
  const EMAX = 5;
  const emojiOn = a.allowEmoji !== false;

  const send = async (e) => {
    e.preventDefault();
    if (!word.trim()) return;
    setBusy(true);
    setErr('');
    const r = await api(`/api/live/${pin}/respond`, { method: 'POST', body: { token, activityId: a.id, text: word } });
    setBusy(false);
    if (!r.ok) { setErr(r.error); if (r.status === 409 && /já enviou/.test(r.error) && /palavras/.test(r.error)) { store.set(key, MAX); setSent(MAX); setShowForm(false); } return; }
    if (r.emoji) { const n = esent + 1; store.set(ekey, n); setEsent(n); setWord(''); setFlash(`${r.word} enviado!`); setTimeout(() => setFlash(''), 1800); return; }
    const n = sent + 1;
    store.set(key, n);
    setSent(n);
    setLast(r.word);
    setWord('');
    setShowForm(false);
  };

  const sendEmoji = async (em) => {
    if (busy || esent >= EMAX) return;
    setBusy(true);
    setErr('');
    const r = await api(`/api/live/${pin}/respond`, { method: 'POST', body: { token, activityId: a.id, text: em } });
    setBusy(false);
    if (!r.ok) { setErr(r.error); if (r.status === 409) { store.set(ekey, EMAX); setEsent(EMAX); } return; }
    const n = esent + 1;
    store.set(ekey, n);
    setEsent(n);
    setFlash(`${em} enviado para o telão!`);
    setTimeout(() => setFlash(''), 1800);
  };

  const emojiBar = emojiOn ? (
    <div className="stack" style={{ gap: 8, width: '100%' }}>
      <span className="label" style={{ fontSize: 15 }}>Ou envie um emoji {esent < EMAX ? <span className="hint">({EMAX - esent} restantes)</span> : null}</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
        {EMOJIS.map((em) => (
          <button key={em} type="button" onClick={() => sendEmoji(em)} disabled={busy || esent >= EMAX} aria-label={`Enviar ${em}`}
            style={{ height: 56, fontSize: 30, borderRadius: 14, border: '2px solid var(--line-2)', background: '#fff', cursor: 'pointer', opacity: esent >= EMAX ? 0.4 : 1 }}>{em}</button>
        ))}
      </div>
      {esent >= EMAX ? <span className="hint">Você já enviou {EMAX} emojis.</span> : null}
    </div>
  ) : null;
  const flashBox = flash ? <div className="ok-box" role="status" style={{ textAlign: 'center', fontWeight: 700 }}>{flash}</div> : null;

  if (!showForm) {
    return (
      <div className="phone-body">
        <div className="phone-center" style={{ flex: 'none', paddingBottom: 0 }}>
          {IconCheck}
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>Palavra enviada!</h1>
          <p className="muted" style={{ fontSize: 18, lineHeight: 1.4 }}>{last ? `“${last}” já está no mapa do telão.` : 'Sua resposta já está no mapa do telão.'}</p>
          {sent < MAX ? <button className="btn btn-lg" onClick={() => setShowForm(true)}>Enviar outra palavra ({MAX - sent} restantes)</button> : <p className="hint" style={{ fontSize: 15 }}>Você já enviou {MAX} palavras.</p>}
        </div>
        {flashBox}
        {err ? <div className="alert" role="alert">{err}</div> : null}
        {emojiBar}
      </div>
    );
  }
  return (
    <form className="phone-body" onSubmit={send}>
      <Header kind="Mapa de palavras" index={index} total={total} question={a.question} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
        <label htmlFor="w" className="label" style={{ fontSize: 16 }}>Sua palavra</label>
        <input id="w" className="input" style={{ fontSize: 24, fontWeight: 600, padding: 18 }} maxLength={25} value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" autoCapitalize="sentences" enterKeyHint="send" />
        <span className="hint" style={{ alignSelf: 'flex-end' }}>{word.length} / 25</span>
        <button className="btn btn-primary btn-lg btn-block" disabled={busy || !word.trim()}>{busy ? 'Enviando…' : 'Enviar palavra'}</button>
      </div>
      {flashBox}
      {err ? <div className="alert" role="alert">{err}</div> : null}
      {emojiBar}
    </form>
  );
}

function ChoicePhone({ pin, a, token, index, total }) {
  const key = `rg:${pin}:${a.id}:voted`;
  const [voted, setVoted] = useState(() => store.get(key) === '1');
  const [picked, setPicked] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const toggle = (i) => {
    if (!a.multi) { setPicked([i]); return; }
    if (picked.includes(i)) setPicked(picked.filter((x) => x !== i));
    else if (picked.length < a.maxSelect) setPicked([...picked, i]);
  };
  const send = async () => {
    setBusy(true);
    setErr('');
    const r = await api(`/api/live/${pin}/respond`, { method: 'POST', body: { token, activityId: a.id, options: picked } });
    setBusy(false);
    if (!r.ok && !(r.status === 409 && /já votou/.test(r.error))) { setErr(r.error); return; }
    store.set(key, '1');
    setVoted(true);
  };
  if (voted) return <Center icon={IconCheck} title="Voto registrado!" text="Veja o gráfico se movendo no telão." />;
  return (
    <div className="phone-body">
      <Header kind={a.multi ? `Múltipla escolha · até ${a.maxSelect}` : 'Múltipla escolha'} index={index} total={total} question={a.question} />
      <div className="stack" style={{ flex: 1, gap: 10, justifyContent: 'center' }}>
        {a.options.map((o, i) => (
          <button key={i} className={'opt-btn' + (picked.includes(i) ? ' sel' : '')} onClick={() => toggle(i)} aria-pressed={picked.includes(i)}>
            <span className="opt-box" aria-hidden="true">{picked.includes(i) ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0B2238" strokeWidth="4"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> : null}</span>
            {o}
          </button>
        ))}
      </div>
      {err ? <div className="alert" role="alert">{err}</div> : null}
      <button className="btn btn-primary btn-lg btn-block" onClick={send} disabled={busy || !picked.length}>{busy ? 'Enviando…' : 'Enviar voto'}</button>
    </div>
  );
}

function QuizPhone({ pin, data, token }) {
  const a = data.activity;
  const run = data.run || {};
  const now = useNow(250);
  const key = `rg:${pin}:${a.id}:q${a.qIndex}`;
  const [answer, setAnswer] = useState(() => { const v = store.get(key); return v === null ? null : Number(v); });
  const [err, setErr] = useState('');
  const [me, setMe] = useState(null);
  const phase = run.phase;
  const revealed = phase === 'reveal' || phase === 'rank';

  useEffect(() => {
    if (!revealed) return;
    api(`/api/live/${pin}/me?token=${encodeURIComponent(token)}&activity=${a.id}&q=${a.qIndex}`).then((r) => { if (r.ok) setMe(r); });
  }, [revealed, phase, pin, token, a.id, a.qIndex]);

  const pick = async (i) => {
    if (answer !== null) return;
    setAnswer(i);
    store.set(key, String(i));
    const r = await api(`/api/live/${pin}/respond`, { method: 'POST', body: { token, activityId: a.id, qIndex: a.qIndex, option: i } });
    if (!r.ok && !/já respondeu/.test(r.error || '')) { setErr(r.error); setAnswer(null); store.set(key, ''); }
  };

  if (revealed) {
    const answered = me ? me.answered : answer !== null;
    const right = me ? me.correct : answer === a.correct;
    const bg = !answered ? '#EEF2F5' : right ? '#45B02B' : '#FDECEC';
    return (
      <div className="phone-body" style={{ background: bg }}>
        <div className="phone-center">
          <h1 style={{ fontSize: 36, fontWeight: 800 }}>{!answered ? 'Tempo esgotado' : right ? 'Você acertou!' : 'Não foi dessa vez'}</h1>
          {answered && right && me ? <p style={{ fontSize: 30, fontWeight: 800 }}>+{me.points} pontos</p> : null}
          {answered && !right ? <p style={{ fontSize: 19 }}>Resposta certa: <b>{letters(a.correct)}. {a.options[a.correct]}</b></p> : null}
        </div>
        {me ? (
          <div className="card stack" style={{ alignItems: 'center', gap: 4 }}>
            <span className="muted">Sua posição no ranking</span>
            <span style={{ fontSize: 44, fontWeight: 800 }}>{me.position}º <span style={{ fontSize: 18, color: '#4A5D70', fontWeight: 600 }}>de {me.players}</span></span>
            <span className="muted">{me.score} pontos no total</span>
          </div>
        ) : null}
      </div>
    );
  }

  if (phase === 'ready') return <Center icon={IconScreen} title={`Pergunta ${a.qIndex + 1} de ${a.qTotal}`} text="Prepare-se! A pergunta aparece aqui quando o palestrante liberar." />;
  if (answer !== null) return <Center icon={IconCheck} title="Resposta registrada!" text="Aguarde o palestrante revelar a resposta certa." />;
  if (phase === 'closed') return <Center title="Tempo esgotado" text="Aguarde a revelação da resposta." />;
  if (data.paused) return <Center title="Respostas pausadas" text="O palestrante pausou o quiz. Aguarde." />;

  const secs = remainingSeconds(data, now);
  const pct = a.seconds ? Math.max(0, Math.min(100, (secs / a.seconds) * 100)) : 0;
  return (
    <div className="phone-body">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <span className="phone-kind">Quiz · pergunta {a.qIndex + 1} de {a.qTotal}</span>
        <span style={{ width: 58, height: 58, borderRadius: '50%', border: '4px solid #45B02B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, flex: 'none' }}>{secs}</span>
      </div>
      <div style={{ height: 8, background: '#E3E9EE', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: pct + '%', height: '100%', background: '#45B02B', transition: 'width .25s linear' }} /></div>
      <h1 className="phone-q" style={{ fontSize: 24 }}>{a.question}</h1>
      <div className="stack" style={{ flex: 1, gap: 12, justifyContent: 'center' }}>
        {a.options.map((o, i) => (
          <button key={i} className="opt-btn" style={{ minHeight: 64, fontSize: 19 }} onClick={() => pick(i)}>
            <span className="opt-letter">{letters(i)}</span>{o}
          </button>
        ))}
      </div>
      {err ? <div className="alert" role="alert">{err}</div> : null}
      <p className="hint" style={{ textAlign: 'center', fontSize: 15 }}>Toque numa opção · quanto mais rápido, mais pontos</p>
    </div>
  );
}
