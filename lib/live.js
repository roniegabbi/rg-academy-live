import crypto from 'node:crypto';
import { db } from './db';

export const KINDS = ['slide', 'cloud', 'choice', 'quiz', 'qa', 'raffle'];
export const GRACE_MS = 1500;

export function initialRun(activity) {
  if (activity && activity.kind === 'quiz') return { qIndex: 0, phase: 'ready' };
  return {};
}

export function quizQuestions(activity) {
  const qs = (activity && activity.config && Array.isArray(activity.config.questions)) ? activity.config.questions : [];
  return qs;
}

// Fase efetiva do quiz: depois do tempo, a pergunta fica "encerrada".
export function effectivePhase(run, now = Date.now()) {
  if (!run || !run.phase) return null;
  if (run.phase === 'question' && run.endsAt && now > run.endsAt) return 'closed';
  return run.phase;
}

export async function loadEventByPin(pin) {
  if (!/^\d{6}$/.test(String(pin || ''))) return null;
  const sql = db();
  const evs = await sql`SELECT id, title, pin, status, current_index, paused, require_name, reactions_on, run FROM events WHERE pin = ${pin}`;
  if (!evs.length) return null;
  const ev = evs[0];
  const acts = await sql`SELECT id, position, kind, title, config FROM activities WHERE event_id = ${ev.id} ORDER BY position, created_at`;
  return { ev, acts };
}

export async function loadEventById(id) {
  const sql = db();
  const evs = await sql`SELECT * FROM events WHERE id = ${id}`;
  if (!evs.length) return null;
  const acts = await sql`SELECT id, position, kind, title, config FROM activities WHERE event_id = ${id} ORDER BY position, created_at`;
  return { ev: evs[0], acts };
}

// Versão pública da atividade: nunca envia a resposta certa do quiz antes da revelação.
export function publicActivity(act, run) {
  if (!act) return null;
  const c = act.config || {};
  const base = { id: act.id, kind: act.kind, title: act.title };
  if (act.kind === 'slide') {
    return { ...base, mode: c.mode || 'text', imageUrl: c.imageUrl || '', youtubeId: c.youtubeId || '', heading: c.heading || '', text: c.text || '', eyebrow: c.eyebrow || '', bgWord: c.bgWord || '', presenter: c.presenter || '', date: c.date || '', place: c.place || '' };
  }
  if (act.kind === 'cloud') return { ...base, question: c.question || act.title, allowEmoji: c.allowEmoji !== false };
  if (act.kind === 'choice') {
    const options = Array.isArray(c.options) ? c.options : [];
    const multi = !!c.multi;
    const maxSelect = multi ? Math.max(1, Math.min(options.length, Number(c.maxSelect) || options.length)) : 1;
    return { ...base, question: c.question || act.title, options, multi, maxSelect, showResults: c.showResults !== false };
  }
  if (act.kind === 'qa') return { ...base, question: c.question || act.title, moderate: c.moderate !== false };
  if (act.kind === 'raffle') return { ...base, prize: c.prize || '', onlyNamed: c.onlyNamed !== false };
  if (act.kind === 'quiz') {
    const qs = quizQuestions(act);
    const qIndex = Math.min(Math.max(0, (run && run.qIndex) || 0), Math.max(0, qs.length - 1));
    const q = qs[qIndex] || { text: '', options: [], seconds: 20 };
    const phase = effectivePhase(run);
    const revealed = phase === 'reveal' || phase === 'rank';
    return {
      ...base,
      qIndex,
      qTotal: qs.length,
      question: q.text || '',
      options: Array.isArray(q.options) ? q.options : [],
      seconds: Number(q.seconds) || 20,
      correct: revealed ? Number(q.correct) : null
    };
  }
  return base;
}

// Só o que o público pode ver do andamento (nunca ids internos dos sorteados).
function publicRun(act, run, now) {
  if (!act) return {};
  if (act.kind === 'quiz') return { qIndex: run.qIndex || 0, phase: effectivePhase(run, now), endsAt: run.endsAt || null };
  if (act.kind === 'raffle') return { drawnAt: run.drawnAt || null };
  if (act.kind === 'qa') return { highlight: run.highlight || null };
  return {};
}

// Ganhadores do sorteio, na ordem em que saíram (com a marca curta para o celular se reconhecer).
export async function raffleWinners(activityId) {
  const rows = await db()`SELECT p.name, p.token FROM responses r JOIN participants p ON p.id = r.participant_id WHERE r.activity_id = ${activityId} ORDER BY r.id`;
  return rows.map((w) => ({ name: (w.name || '').trim() || 'Participante', tag: tagOf(w.token) }));
}

// Marca curta do participante, para o celular saber se foi sorteado sem expor o token.
export function tagOf(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 12);
}

export function publicState(ev, acts, now = Date.now()) {
  const index = Math.min(Math.max(0, ev.current_index || 0), Math.max(0, acts.length - 1));
  const act = acts[index];
  const run = ev.run || {};
  return {
    ok: true,
    serverNow: now,
    event: { title: ev.title, pin: ev.pin, status: ev.status, requireName: !!ev.require_name, reactions: ev.reactions_on !== false },
    index,
    total: acts.length,
    paused: !!ev.paused,
    run: publicRun(act, run, now),
    activity: publicActivity(act, run)
  };
}

export async function countParticipants(eventId) {
  const sql = db();
  const r = await sql`SELECT count(*)::int AS n FROM participants WHERE event_id = ${eventId}`;
  return r[0].n;
}

// Resultado agregado de uma atividade (o telão nunca recebe resposta por resposta).
export async function activityResults(act, run, opts = {}) {
  const sql = db();
  if (!act) return null;
  if (act.kind === 'cloud') {
    const rows = await sql`SELECT text_value AS w, count(*)::int AS n FROM responses WHERE activity_id = ${act.id} AND text_value IS NOT NULL GROUP BY text_value ORDER BY n DESC, w ASC LIMIT 400`;
    const hiddenList = (act.config && act.config.hidden) || [];
    const hidden = new Set(hiddenList.map(wordKey));
    // Junta variações da mesma palavra (plural/singular, acento, maiúscula) e mostra a forma mais usada.
    const groups = new Map();
    for (const r of rows) {
      const k = wordKey(r.w);
      if (!k || hidden.has(k)) continue;
      const g = groups.get(k) || { count: 0, best: r.w, bestN: 0 };
      g.count += r.n;
      if (r.n > g.bestN || (r.n === g.bestN && String(r.w).length < String(g.best).length)) { g.best = r.w; g.bestN = r.n; }
      groups.set(k, g);
    }
    const words = [...groups.values()].sort((a, b) => b.count - a.count || String(a.best).localeCompare(String(b.best), 'pt-BR')).map((g) => ({ text: g.best, count: g.count }));
    const total = words.reduce((sum, w) => sum + w.count, 0);
    return { kind: 'cloud', words: words.slice(0, 80), total, hidden: hiddenList };
  }
  if (act.kind === 'choice') {
    const options = (act.config && act.config.options) || [];
    const rows = await sql`SELECT o AS idx, count(*)::int AS n FROM responses, unnest(options) AS o WHERE activity_id = ${act.id} GROUP BY o`;
    const voters = await sql`SELECT count(*)::int AS n FROM responses WHERE activity_id = ${act.id}`;
    const counts = options.map((_, i) => {
      const r = rows.find((x) => Number(x.idx) === i);
      return r ? r.n : 0;
    });
    return { kind: 'choice', counts, voters: voters[0].n };
  }
  if (act.kind === 'quiz') {
    const qs = quizQuestions(act);
    const qIndex = opts.qIndex !== undefined ? opts.qIndex : ((run && run.qIndex) || 0);
    const q = qs[qIndex] || { options: [] };
    const rows = await sql`SELECT options[1] AS idx, count(*)::int AS n FROM responses WHERE activity_id = ${act.id} AND q_index = ${qIndex} GROUP BY options[1]`;
    const counts = (q.options || []).map((_, i) => {
      const r = rows.find((x) => Number(x.idx) === i);
      return r ? r.n : 0;
    });
    const answered = counts.reduce((s, n) => s + n, 0);
    const phase = opts.all ? 'rank' : effectivePhase(run);
    const revealed = phase === 'reveal' || phase === 'rank';
    let ranking = [];
    if (revealed || opts.all) {
      const rk = await sql`SELECT p.name, sum(r.points)::int AS score FROM responses r JOIN participants p ON p.id = r.participant_id WHERE r.activity_id = ${act.id} GROUP BY p.id, p.name ORDER BY score DESC, min(r.created_at) ASC LIMIT ${opts.rankLimit || 10}`;
      ranking = rk.map((r, i) => ({ pos: i + 1, name: r.name || 'Participante', score: r.score }));
    }
    return { kind: 'quiz', qIndex, counts: revealed || opts.all ? counts : null, answered, ranking };
  }
  if (act.kind === 'qa') {
    const qs = await sql`SELECT id::text AS id, author, text, status, likes FROM questions WHERE activity_id = ${act.id} AND status <> 'hidden' ORDER BY (status = 'pending') DESC, likes DESC, id ASC LIMIT 200`;
    return { kind: 'qa', questions: qs, pending: qs.filter((q) => q.status === 'pending').length, highlight: (run && run.highlight) || null };
  }
  if (act.kind === 'raffle') {
    const onlyNamed = !(act.config && act.config.onlyNamed === false);
    const winners = await raffleWinners(act.id);
    const el = await sql`SELECT count(*)::int AS n FROM participants p JOIN activities a ON a.event_id = p.event_id WHERE a.id = ${act.id} AND (${!onlyNamed} OR length(trim(p.name)) >= 2)`;
    const names = await sql`SELECT p.name FROM participants p JOIN activities a ON a.event_id = p.event_id WHERE a.id = ${act.id} AND length(trim(p.name)) >= 2 ORDER BY random() LIMIT 40`;
    return { kind: 'raffle', eligible: Math.max(0, el[0].n - winners.length), names: names.map((r) => r.name), winners: winners.map((w) => ({ name: w.name })) };
  }
  return { kind: act.kind };
}

const EMOJI_ONLY = /^[\p{Extended_Pictographic}\p{Emoji_Component}\u200d\ufe0f\s]+$/u;
const HAS_EMOJI = /\p{Extended_Pictographic}/u;

// Só emoji (sem letras nem números)?
export function isEmojiOnly(text) {
  const t = String(text || '').trim();
  return !!t && HAS_EMOJI.test(t) && EMOJI_ONLY.test(t) && !/[0-9#*]/.test(t.replace(/\ufe0f|\u20e3/g, ''));
}

export function hasEmoji(text) {
  return HAS_EMOJI.test(String(text || ''));
}

export function normalizeWord(raw) {
  if (isEmojiOnly(raw)) return String(raw).replace(/\s+/g, '').slice(0, 24);
  const s = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 25);
  if (!s) return '';
  const lower = s.toLocaleLowerCase('pt-BR');
  return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1);
}

// Chave para agrupar variações: sem acento, minúscula e no singular (regras simples do português).
export function wordKey(raw) {
  const w = String(raw || '').trim();
  if (!w) return '';
  if (isEmojiOnly(w)) return w.replace(/\s+/g, '');
  const k = w.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
  if (k.includes(' ')) return k;
  const n = k.length;
  if (n >= 4 && /(oes|aes|aos)$/.test(k)) return k.slice(0, -3) + 'ao';
  if (n >= 6 && /ais$/.test(k)) return k.slice(0, -3) + 'al';
  if (n >= 6 && /eis$/.test(k)) return k.slice(0, -3) + 'el';
  if (n >= 6 && /ois$/.test(k)) return k.slice(0, -3) + 'ol';
  if (n >= 4 && /ns$/.test(k)) return k.slice(0, -2) + 'm';
  if (n >= 5 && /[rsz]es$/.test(k)) return k.slice(0, -2);
  if (n >= 4 && /[aeo]s$/.test(k) && !/ss$/.test(k)) return k.slice(0, -1);
  return k;
}
