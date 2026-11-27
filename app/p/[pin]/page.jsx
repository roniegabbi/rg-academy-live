'use client';

import { useEffect, useRef, useState } from 'react';
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
    const t = store.get(`rg:${pin}:token`);
    setToken(t);
    setName(store.get('rg:name') || '');
    if (t) store.set('rg:last', pin);
    setReady(true);
  }, [pin]);

  if (notFound) return <Shell><Center title="Evento não encontrado" text="Confira o PIN ou aponte a câmera de novo para o QR code do telão." /></Shell>;
  if (!data || !ready) return <Shell><Center title="Conectando…" /></Shell>;

  const ev = data.event;
  if (!token) return <Shell event={ev} offline={offline}><Join pin={pin} ev={ev} name={name} setName={setName} onJoin={(t) => { store.set(`rg:${pin}:token`, t); store.set('rg:last', pin); setToken(t); }} /></Shell>;

  return (
    <Shell event={ev} offline={offline}>
      <KeepAwake />
      <Buzz data={data} />
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

// Mantém a tela do celular acesa durante o evento (onde o navegador permitir).
function KeepAwake() {
  useEffect(() => {
    let lock = null;
    const ask = async () => {
      try { if (navigator.wakeLock && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen'); } catch { /* sem suporte */ }
    };
    ask();
    const onVis = () => { if (document.visibilityState === 'visible') ask(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); try { if (lock) lock.release(); } catch { /* ok */ } };
  }, []);
  return null;
}

// Vibra levemente quando uma pergunta nova aparece no celular.
function Buzz({ data }) {
  const a = data && data.activity;
  const sig = a && a.kind !== 'slide' && data.event.status === 'live' ? `${a.id}:${a.qIndex || 0}:${(data.run && data.run.phase) === 'question' ? 'q' : ''}` : '';
  const last = useRef('');
  useEffect(() => {
    if (sig && last.current && sig !== last.current) { try { if (navigator.vibrate) navigator.vibrate(70); } catch { /* ok */ } }
    if (sig) last.current = sig;
  }, [sig]);
  return null;
}

const REACTS = ['👏', '❤️', '🔥', '😂', '💡', '🙌'];

// Reações ao vivo: aparecem flutuando no telão.
function ReactionBar({ pin, token }) {
  const [pops, setPops] = useState([]);
  const [cool, setCool] = useState(false);
  const send = async (em) => {
    if (cool) return;
    setCool(true);
    setTimeout(() => setCool(false), 1500);
    const id = Date.now() + Math.random();
    setPops((p) => [...p, { id, em }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 1200);
    try { if (navigator.vibrate) navigator.vibrate(15); } catch { /* ok */ }
    await api(`/api/live/${pin}/react`, { method: 'POST', body: { token, emoji: em } });
  };
  return (
    <div className="phone-foot" style={{ position: 'relative' }}>
      <p className="hint" style={{ textAlign: 'center', marginBottom: 8, fontSize: 14 }}>Reaja ao vivo — aparece no telão</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
        {REACTS.map((em) => (
          <button key={em} onClick={() => send(em)} aria-label={`Reagir com ${em}`} style={{ height: 58, fontSize: 30, borderRadius: 16, border: '2px solid var(--line-2)', background: '#fff', cursor: 'pointer', opacity: cool ? 0.55 : 1, transition: 'opacity .2s' }}>{em}</button>
        ))}
      </div>
      {pops.map((p) => <span key={p.id} className="react-pop" aria-hidden="true">{p.em}</span>)}
    </div>
  );
}

function Live({ pin, data, token }) {
  const ev = data.event;
  const a = data.activity;
  if (ev.status === 'draft') return <Center icon={IconScreen} title="Você está dentro!" text="O evento vai começar em instantes. Deixe esta tela aberta." />;
  const reacts = ev.reactions !== false ? <ReactionBar pin={pin} token={token} /> : null;
  if (ev.status === 'ended') return <Center icon={IconCheck} title="Evento encerrado" text="Obrigado pela participação!" />;
  if (!a || a.kind === 'slide') return <><Center icon={IconScreen} title="Olhe para o telão" text="A próxima pergunta aparece aqui sozinha. Não precisa recarregar." />{reacts}</>;
  if (a.kind === 'quiz') return <QuizPhone key={a.id + ':' + a.qIndex} pin={pin} data={data} token={token} />;
  if (data.paused) return <Center title="Respostas pausadas" text="O palestrante pausou esta atividade. Aguarde." />;
  if (a.kind === 'cloud') return <CloudPhone key={a.id} pin={pin} a={a} token={token} index={data.index} total={data.total} />;
  if (a.kind === 'choice') return <ChoicePhone key={a.id} pin={pin} a={a} token={token} index={data.index} total={data.total} results={data.results} reacts={reacts} />;
  if (a.kind === 'qa') return <QaPhone key={a.id} pin={pin} a={a} token={token} data={data} />;
  if (a.kind === 'raffle') return <RafflePhone key={a.id} pin={pin} a={a} token={token} data={data} />;
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

function ChoicePhone({ pin, a, token, index, total, results, reacts }) {
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
    store.set(key + ':labels', picked.map((i) => a.options[i]).join(' · '));
    setVoted(true);
  };
  if (voted) {
    const mine = store.get(key + ':labels');
    const live = a.showResults !== false && results && Array.isArray(results.counts);
    return (
      <>
        <Center icon={IconCheck} title="Voto registrado!" text={mine ? `Você votou em: ${mine}.` : 'Veja o gráfico se movendo no telão.'}>
          {live ? <PhoneBars options={a.options} counts={results.counts} mine={mine ? mine.split(' · ') : []} /> : null}
        </Center>
        {reacts}
      </>
    );
  }
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

// Quem entrou sem nome é convidado a colocar um, para aparecer no ranking do quiz.
function RankingName({ pin, token, label = 'Como você quer aparecer no ranking?' }) {
  const [name, setName] = useState(() => store.get('rg:name') || '');
  const [saved, setSaved] = useState(() => !!store.get('rg:name'));
  const [err, setErr] = useState('');
  if (saved) return null;
  const save = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    const r = await api(`/api/live/${pin}/join`, { method: 'POST', body: { token, name } });
    if (!r.ok) { setErr(r.error); return; }
    store.set('rg:name', name.trim());
    setSaved(true);
  };
  return (
    <form onSubmit={save} className="card stack" style={{ gap: 10, width: '100%', textAlign: 'left', marginTop: 8 }}>
      <label htmlFor="rk-name" className="label" style={{ fontSize: 16 }}>{label}</label>
      <input id="rk-name" className="input" style={{ fontSize: 18 }} maxLength={40} placeholder="Seu nome ou apelido" value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
      {err ? <div className="alert" role="alert">{err}</div> : null}
      <button className="btn btn-primary btn-block" disabled={name.trim().length < 2}>Salvar nome</button>
    </form>
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
            {me.streak >= 2 ? <span style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>🔥 {me.streak} acertos seguidos!</span> : null}
            {me.position > 1 && me.gap > 0 ? <span className="hint" style={{ fontSize: 15 }}>Faltam {me.gap} pontos para passar o {me.position - 1}º lugar</span> : null}
            {me.position === 1 && me.score > 0 ? <span style={{ fontSize: 16, fontWeight: 700, color: '#2E7D1E' }}>Você está na liderança! 🏆</span> : null}
          </div>
        ) : null}
      </div>
    );
  }

  if (phase === 'ready') {
    return (
      <Center icon={IconScreen} title={`Pergunta ${a.qIndex + 1} de ${a.qTotal}`} text="Prepare-se! A pergunta aparece aqui quando o palestrante liberar.">
        <RankingName pin={pin} token={token} />
      </Center>
    );
  }
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

// Perguntas ao palestrante: enviar, ver as aprovadas e curtir.
function QaPhone({ pin, a, token, data }) {
  const mineKey = `rg:${pin}:${a.id}:asked`;
  const likeKey = `rg:${pin}:${a.id}:liked`;
  const read = (k) => { try { return JSON.parse(store.get(k) || '[]'); } catch { return []; } };
  const [mine, setMine] = useState(() => read(mineKey));
  const [liked, setLiked] = useState(() => read(likeKey));
  const [text, setText] = useState('');
  const [anon, setAnon] = useState(false);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState(false);
  const list = data.questions || [];
  const shown = new Set(list.map((q) => q.id));
  const waiting = mine.filter((m) => !shown.has(m.id));
  const MAX = 3;

  const send = async (e) => {
    e.preventDefault();
    if (text.trim().length < 5) return;
    setBusy(true); setErr('');
    const r = await api(`/api/live/${pin}/ask`, { method: 'POST', body: { token, activityId: a.id, text, anonymous: anon } });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    const next = [...mine, { id: r.id, text: text.trim() }];
    setMine(next); store.set(mineKey, JSON.stringify(next));
    setText('');
    setFlash(r.status === 'pending' ? 'Pergunta enviada! Ela aparece aqui quando o palestrante aprovar.' : 'Pergunta enviada!');
    setTimeout(() => setFlash(''), 3500);
  };
  const like = async (q) => {
    if (liked.includes(q.id) || q.status !== 'approved') return;
    const next = [...liked, q.id];
    setLiked(next); store.set(likeKey, JSON.stringify(next));
    try { if (navigator.vibrate) navigator.vibrate(15); } catch { /* ok */ }
    await api(`/api/live/${pin}/like`, { method: 'POST', body: { token, questionId: q.id } });
  };

  return (
    <div className="phone-body" style={{ gap: 14 }}>
      <Header kind="Perguntas ao palestrante" index={data.index} total={data.total} question={a.question} />
      {mine.length < MAX ? (
        <form onSubmit={send} className="stack" style={{ gap: 8 }}>
          <label htmlFor="qa-t" className="label" style={{ fontSize: 16 }}>Sua pergunta</label>
          <textarea id="qa-t" className="textarea" style={{ fontSize: 18, minHeight: 96 }} maxLength={200} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva aqui…" />
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <label className="check" style={{ fontSize: 15 }}><input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />Enviar sem meu nome</label>
            <span className="hint">{text.length} / 200</span>
          </div>
          <button className="btn btn-primary btn-lg btn-block" disabled={busy || text.trim().length < 5}>{busy ? 'Enviando…' : 'Enviar pergunta'}</button>
        </form>
      ) : <p className="hint" style={{ fontSize: 15 }}>Você já enviou {MAX} perguntas. Agora é só curtir as dos colegas.</p>}
      {flash ? <div className="ok-box" role="status" style={{ fontWeight: 600 }}>{flash}</div> : null}
      {err ? <div className="alert" role="alert">{err}</div> : null}
      {waiting.length && a.moderate ? (
        <div className="stack" style={{ gap: 6 }}>
          <span className="eyebrow">Aguardando aprovação</span>
          {waiting.map((m) => <div key={m.id} className="card" style={{ padding: '10px 14px', fontSize: 15, color: 'var(--muted)' }}>{m.text}</div>)}
        </div>
      ) : null}
      <div className="stack" style={{ gap: 8 }}>
        <span className="eyebrow">{list.length ? 'Curta as que você também quer ouvir' : 'Ainda não há perguntas aprovadas'}</span>
        {list.map((q) => {
          const on = liked.includes(q.id);
          const done = q.status === 'answered';
          return (
            <div key={q.id} className="card row" style={{ padding: '12px 14px', gap: 12, flexWrap: 'nowrap', alignItems: 'center', opacity: done ? 0.6 : 1 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>{q.text}</div>
                <div className="hint" style={{ fontSize: 13 }}>{q.author || 'Anônimo'}{done ? ' · respondida' : ''}{mine.some((m) => m.id === q.id) ? ' · sua pergunta' : ''}</div>
              </div>
              <button onClick={() => like(q)} disabled={on || done} aria-pressed={on} aria-label={on ? `Você curtiu. ${q.likes} curtidas` : `Curtir pergunta. ${q.likes} curtidas`}
                style={{ flex: 'none', minWidth: 64, height: 48, borderRadius: 14, border: on ? '2px solid #45B02B' : '2px solid var(--line-2)', background: on ? '#E8F6E3' : '#fff', fontSize: 17, fontWeight: 700, cursor: on || done ? 'default' : 'pointer' }}>
                👍 {q.likes}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// SHA-256 do token (os mesmos 12 caracteres que o servidor usa para marcar o sorteado).
function useMyTag(token) {
  const [tag, setTag] = useState('');
  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
        const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
        if (!off) setTag(hex.slice(0, 12));
      } catch { /* navegador sem suporte */ }
    })();
    return () => { off = true; };
  }, [token]);
  return tag;
}

function RafflePhone({ pin, a, token, data }) {
  const tag = useMyTag(token);
  const winners = data.winners || [];
  const drawnAt = (data.run && data.run.drawnAt) || 0;
  const now = useNow(500);
  const offset = (data.serverNow || data._recv || now) - (data._recv || now);
  const rolling = drawnAt && now + offset - drawnAt < 3600;
  const me = tag && winners.find((w) => w.tag === tag);
  const buzzed = useRef(false);
  useEffect(() => {
    if (me && !rolling && !buzzed.current) { buzzed.current = true; try { if (navigator.vibrate) navigator.vibrate([120, 80, 120, 80, 300]); } catch { /* ok */ } }
  }, [me, rolling]);

  if (rolling) return <Center title="Sorteando…" text="Olhe para o telão!" icon={<div className="circle-icon" style={{ fontSize: 48 }}>🎲</div>} />;
  if (me) {
    return (
      <div className="phone-body" style={{ background: '#45B02B' }}>
        <div className="phone-center">
          <span style={{ fontSize: 80 }} aria-hidden="true">🏆</span>
          <h1 style={{ fontSize: 38, fontWeight: 900, color: '#0B2238' }}>Você foi sorteado!</h1>
          {a.prize ? <p style={{ fontSize: 20, color: '#0B2238' }}>Prêmio: <b>{a.prize}</b></p> : null}
          <p style={{ fontSize: 17, color: '#0B2238' }}>Procure o palestrante para receber.</p>
        </div>
      </div>
    );
  }
  if (winners.length) {
    const last = winners[winners.length - 1];
    return (
      <Center icon={<div className="circle-icon" style={{ fontSize: 48 }}>🎉</div>} title={`${last.name} foi sorteado!`} text={winners.length > 1 ? `Já sorteados: ${winners.map((w) => w.name).join(', ')}.` : 'Não foi dessa vez. Fique de olho, pode ter mais sorteio!'} />
    );
  }
  return (
    <Center icon={<div className="circle-icon" style={{ fontSize: 48 }}>🍀</div>} title="Você está concorrendo!" text={a.prize ? `Prêmio: ${a.prize}. O sorteio acontece no telão.` : 'O sorteio acontece no telão. Boa sorte!'}>
      {a.onlyNamed ? <RankingName pin={pin} token={token} label="Só participa quem tem nome. Como você se chama?" /> : null}
    </Center>
  );
}

// Gráfico simples no celular depois do voto.
function PhoneBars({ options, counts, mine }) {
  const total = counts.reduce((s, n) => s + n, 0);
  return (
    <div className="stack" style={{ gap: 8, width: '100%', textAlign: 'left' }}>
      {options.map((o, i) => {
        const pct = total ? Math.round(((counts[i] || 0) / total) * 100) : 0;
        const isMine = mine.includes(o);
        return (
          <div key={i} style={{ position: 'relative', borderRadius: 12, background: '#EEF2F5', overflow: 'hidden', minHeight: 46 }}>
            <div style={{ position: 'absolute', inset: 0, width: pct + '%', background: isMine ? '#9FDB8A' : '#CFE3F5', transition: 'width .8s cubic-bezier(.2,.8,.2,1)' }} />
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 10, padding: '12px 14px', fontSize: 16 }}>
              <span style={{ fontWeight: isMine ? 700 : 500 }}>{o}{isMine ? ' ✓' : ''}</span>
              <b>{pct}%</b>
            </div>
          </div>
        );
      })}
      <span className="hint" style={{ textAlign: 'center' }}>{total} {total === 1 ? 'voto' : 'votos'} até agora · ao vivo</span>
    </div>
  );
}
