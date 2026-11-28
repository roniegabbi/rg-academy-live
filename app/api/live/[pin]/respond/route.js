import { db } from '@/lib/db';
import { json, error, readJson } from '@/lib/http';
import { quizQuestions, effectivePhase, normalizeWord, isEmojiOnly, hasEmoji, GRACE_MS } from '@/lib/live';
import { isBlocked } from '@/lib/moderation';

export const dynamic = 'force-dynamic';

const MAX_WORDS = 3;
const MAX_EMOJIS = 5;

// Recebe uma resposta e confere tudo no servidor: atividade atual, pausa, tempo do quiz.
export async function POST(req, { params }) {
  const { pin } = await params;
  if (!/^\d{6}$/.test(String(pin))) return error('PIN inválido.', 404);
  const body = await readJson(req);
  const token = String(body.token || '');
  if (!token) return error('Entre no evento primeiro.', 401);
  const sql = db();
  const rows = await sql`
    SELECT e.id AS event_id, e.status, e.paused, e.current_index, e.run, p.id AS participant_id
    FROM events e JOIN participants p ON p.event_id = e.id AND p.token = ${token}
    WHERE e.pin = ${pin}`;
  if (!rows.length) return error('Entre no evento primeiro.', 401);
  const ev = rows[0];
  if (ev.status !== 'live') return error('O evento não está acontecendo agora.', 409);
  if (ev.paused) return error('As respostas estão pausadas pelo palestrante.', 409);
  const acts = await sql`SELECT id, kind, config FROM activities WHERE event_id = ${ev.event_id} ORDER BY position, created_at`;
  const act = acts[Math.min(ev.current_index, acts.length - 1)];
  if (!act || act.id !== body.activityId) return error('Esta pergunta já foi encerrada.', 409);
  const c = act.config || {};

  if (act.kind === 'cloud') {
    const word = normalizeWord(body.text);
    if (!word) return error('Digite uma palavra.');
    const emoji = isEmojiOnly(word);
    if (c.allowEmoji === false && hasEmoji(word)) return error('Emojis estão desligados nesta pergunta.', 422);
    if (isBlocked(word)) return error(emoji ? 'Esse emoji não é permitido.' : 'Essa palavra não é permitida. Tente outra.', 422);
    const mine = await sql`SELECT text_value FROM responses WHERE activity_id = ${act.id} AND participant_id = ${ev.participant_id}`;
    const used = mine.filter((r) => isEmojiOnly(r.text_value) === emoji).length;
    const max = emoji ? MAX_EMOJIS : MAX_WORDS;
    if (used >= max) return error(emoji ? `Você já enviou ${MAX_EMOJIS} emojis.` : `Você já enviou ${MAX_WORDS} palavras.`, 409);
    await sql`INSERT INTO responses (event_id, activity_id, participant_id, text_value) VALUES (${ev.event_id}, ${act.id}, ${ev.participant_id}, ${word})`;
    return json({ ok: true, word, emoji, remaining: max - used - 1 });
  }

  if (act.kind === 'choice') {
    const n = (c.options || []).length;
    const max = c.multi ? Math.max(1, Math.min(n, Number(c.maxSelect) || n)) : 1;
    const picked = [...new Set((Array.isArray(body.options) ? body.options : []).map((x) => parseInt(x, 10)))].filter((x) => x >= 0 && x < n);
    if (!picked.length) return error('Escolha uma opção.');
    if (picked.length > max) return error(`Escolha no máximo ${max}.`);
    const ins = await sql`INSERT INTO responses (event_id, activity_id, participant_id, options) VALUES (${ev.event_id}, ${act.id}, ${ev.participant_id}, ${picked}) ON CONFLICT DO NOTHING RETURNING id`;
    if (!ins.length) return error('Você já votou nesta pergunta.', 409);
    return json({ ok: true });
  }

  if (act.kind === 'quiz') {
    const run = ev.run || {};
    const now = Date.now();
    const phase = effectivePhase(run, now - GRACE_MS);
    if (phase !== 'question') return error('O tempo desta pergunta acabou.', 409);
    if (parseInt(body.qIndex, 10) !== (run.qIndex || 0)) return error('Esta pergunta já foi encerrada.', 409);
    const q = quizQuestions(act)[run.qIndex || 0];
    const opt = parseInt(body.option, 10);
    if (!q || !(opt >= 0 && opt < q.options.length)) return error('Opção inválida.');
    const correct = opt === Number(q.correct);
    const total = (Number(q.seconds) || 20) * 1000;
    const left = Math.max(0, (run.endsAt || now) - now);
    const points = correct ? 500 + Math.round(500 * Math.min(1, left / total)) : 0;
    const ins = await sql`INSERT INTO responses (event_id, activity_id, participant_id, q_index, options, correct, points) VALUES (${ev.event_id}, ${act.id}, ${ev.participant_id}, ${run.qIndex || 0}, ${[opt]}, ${correct}, ${points}) ON CONFLICT DO NOTHING RETURNING id`;
    if (!ins.length) return error('Você já respondeu esta pergunta.', 409);
    return json({ ok: true });
  }

  if (act.kind === 'scale') {
    const v = parseInt(body.value, 10);
    if (!(v >= 0 && v <= 10)) return error('Escolha uma nota de 0 a 10.');
    const ins = await sql`INSERT INTO responses (event_id, activity_id, participant_id, options) VALUES (${ev.event_id}, ${act.id}, ${ev.participant_id}, ${[v]}) ON CONFLICT DO NOTHING RETURNING id`;
    if (!ins.length) return error('Você já respondeu.', 409);
    return json({ ok: true });
  }

  if (act.kind === 'rating') {
    const stars = parseInt(body.stars, 10);
    if (!(stars >= 1 && stars <= 5)) return error('Escolha de 1 a 5 estrelas.');
    const comment = c.comment === false ? '' : String(body.comment || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (comment && isBlocked(comment)) return error('Seu comentário tem palavras não permitidas. Reescreva, por favor.', 422);
    const had = await sql`SELECT 1 FROM responses WHERE activity_id = ${act.id} AND participant_id = ${ev.participant_id} LIMIT 1`;
    if (had.length) return error('Você já avaliou. Obrigado!', 409);
    await sql`INSERT INTO responses (event_id, activity_id, participant_id, options, text_value) VALUES (${ev.event_id}, ${act.id}, ${ev.participant_id}, ${[stars]}, ${comment || null})`;
    return json({ ok: true });
  }

  return error('Esta atividade não recebe respostas.', 409);
}
