import { db } from '@/lib/db';
import { json, error, readJson } from '@/lib/http';

export const dynamic = 'force-dynamic';

// Curtir uma pergunta do público (uma curtida por pessoa).
export async function POST(req, { params }) {
  const { pin } = await params;
  if (!/^\d{6}$/.test(String(pin))) return error('PIN inválido.', 404);
  const body = await readJson(req);
  const token = String(body.token || '');
  const qid = String(body.questionId || '');
  if (!token) return error('Entre no evento primeiro.', 401);
  if (!/^\d{1,18}$/.test(qid)) return error('Pergunta inválida.');
  const sql = db();
  const rows = await sql`
    SELECT p.id AS participant_id FROM participants p JOIN events e ON e.id = p.event_id
    JOIN questions q ON q.event_id = e.id AND q.id = ${qid}::bigint AND q.status = 'approved'
    WHERE p.token = ${token} AND e.pin = ${pin} AND e.status = 'live'`;
  if (!rows.length) return error('Não foi possível curtir esta pergunta.', 409);
  const ins = await sql`INSERT INTO question_likes (question_id, participant_id) VALUES (${qid}::bigint, ${rows[0].participant_id}) ON CONFLICT DO NOTHING RETURNING question_id`;
  if (ins.length) await sql`UPDATE questions SET likes = likes + 1 WHERE id = ${qid}::bigint`;
  return json({ ok: true, liked: true });
}
