import { db } from '@/lib/db';
import { json, error, readJson } from '@/lib/http';
import { isBlocked } from '@/lib/moderation';

export const dynamic = 'force-dynamic';

const MAX_PER_PERSON = 3;

// Pergunta do público para o palestrante.
export async function POST(req, { params }) {
  const { pin } = await params;
  if (!/^\d{6}$/.test(String(pin))) return error('PIN inválido.', 404);
  const body = await readJson(req);
  const token = String(body.token || '');
  if (!token) return error('Entre no evento primeiro.', 401);
  const text = String(body.text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (text.length < 5) return error('Escreva sua pergunta (pelo menos 5 letras).');
  if (isBlocked(text)) return error('Sua pergunta tem palavras não permitidas. Reescreva, por favor.', 422);
  const sql = db();
  const rows = await sql`
    SELECT e.id AS event_id, e.status, e.paused, e.current_index, p.id AS participant_id, p.name
    FROM events e JOIN participants p ON p.event_id = e.id AND p.token = ${token}
    WHERE e.pin = ${pin}`;
  if (!rows.length) return error('Entre no evento primeiro.', 401);
  const ev = rows[0];
  if (ev.status !== 'live') return error('O evento não está acontecendo agora.', 409);
  if (ev.paused) return error('O palestrante pausou o envio de perguntas.', 409);
  const acts = await sql`SELECT id, kind, config FROM activities WHERE event_id = ${ev.event_id} ORDER BY position, created_at`;
  const act = acts[Math.min(ev.current_index, acts.length - 1)];
  if (!act || act.kind !== 'qa' || act.id !== body.activityId) return error('O envio de perguntas foi encerrado.', 409);
  const mine = await sql`SELECT count(*)::int AS n FROM questions WHERE activity_id = ${act.id} AND participant_id = ${ev.participant_id}`;
  if (mine[0].n >= MAX_PER_PERSON) return error(`Você já enviou ${MAX_PER_PERSON} perguntas.`, 409);
  const moderate = !(act.config && act.config.moderate === false);
  const author = body.anonymous ? '' : String(ev.name || '').trim();
  const ins = await sql`INSERT INTO questions (event_id, activity_id, participant_id, author, text, status) VALUES (${ev.event_id}, ${act.id}, ${ev.participant_id}, ${author}, ${text}, ${moderate ? 'pending' : 'approved'}) RETURNING id::text AS id, status`;
  return json({ ok: true, id: ins[0].id, status: ins[0].status, remaining: MAX_PER_PERSON - mine[0].n - 1 });
}
