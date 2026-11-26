import { db } from './db';

export const KINDS = ['slide', 'cloud', 'choice', 'quiz'];
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
  const evs = await sql`SELECT id, title, pin, status, current_index, paused, require_name, run FROM events WHERE pin = ${pin}`;
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
    return { ...base, mode: c.mode || 'text', imageUrl: c.imageUrl || '', youtubeId: c.youtubeId || '', heading: c.heading || '', text: c.text || '' };
  }
  if (act.kind === 'cloud') return { ...base, question: c.question || act.title };
  if (act.kind === 'choice') {
    const options = Array.isArray(c.options) ? c.options : [];
    const multi = !!c.multi;
    const maxSelect = multi ? Math.max(1, Math.min(options.length, Number(c.maxSelect) || options.length)) : 1;
    return { ...base, question: c.question || act.title, options, multi, maxSelect };
  }
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

export function publicState(ev, acts, now = Date.now()) {
  const index = Math.min(Math.max(0, ev.current_index || 0), Math.max(0, acts.length - 1));
  const act = acts[index];
  const run = ev.run || {};
  return {
    ok: true,
    serverNow: now,
    event: { title: ev.title, pin: ev.pin, status: ev.status, requireName: !!ev.require_name },
    index,
    total: acts.length,
    paused: !!ev.paused,
    run: act && act.kind === 'quiz' ? { qIndex: run.qIndex || 0, phase: effectivePhase(run, now), endsAt: run.endsAt || null } : {},
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
    const rows = await sql`SELECT text_value AS w, count(*)::int AS n FROM responses WHERE activity_id = ${act.id} AND text_value IS NOT NULL GROUP BY text_value ORDER BY n DESC, w ASC LIMIT 120`;
    const hidden = new Set(((act.config && act.config.hidden) || []).map((w) => w.toLocaleLowerCase('pt-BR')));
    const visible = rows.filter((r) => !hidden.has(String(r.w).toLocaleLowerCase('pt-BR')));
    const total = visible.reduce((s, r) => s + r.n, 0);
    return { kind: 'cloud', words: visible.slice(0, 80).map((r) => ({ text: r.w, count: r.n })), total, hidden: [...hidden] };
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
  return { kind: act.kind };
}

export function normalizeWord(raw) {
  const s = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 25);
  if (!s) return '';
  const lower = s.toLocaleLowerCase('pt-BR');
  return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1);
}
