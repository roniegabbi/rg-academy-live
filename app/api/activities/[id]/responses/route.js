import { db } from '@/lib/db';
import { json, error, isUuid } from '@/lib/http';
import { userIdFrom } from '@/lib/auth';
import { initialRun } from '@/lib/live';

export const dynamic = 'force-dynamic';

// Zera uma atividade sem excluí-la: apaga respostas, perguntas do público e sorteados.
// Se ela estiver no telão agora, o andamento (quiz, sorteio, destaque) volta ao início.
export async function DELETE(req, { params }) {
  const { id } = await params;
  const uid = userIdFrom(req);
  if (!uid) return error('Entre novamente.', 401);
  if (!isUuid(id)) return error('Atividade não encontrada', 404);
  const sql = db();
  const rows = await sql`SELECT a.*, e.current_index FROM activities a JOIN events e ON e.id = a.event_id WHERE a.id = ${id} AND e.owner_id = ${uid}`;
  if (!rows.length) return error('Atividade não encontrada', 404);
  const act = rows[0];
  const r1 = await sql`DELETE FROM responses WHERE activity_id = ${id} RETURNING id`;
  const r2 = await sql`DELETE FROM questions WHERE activity_id = ${id} RETURNING id`;
  const order = await sql`SELECT id FROM activities WHERE event_id = ${act.event_id} ORDER BY position, created_at`;
  const cur = order[Math.min(act.current_index || 0, Math.max(0, order.length - 1))];
  if (cur && cur.id === id) await sql`UPDATE events SET run = ${JSON.stringify(initialRun(act))}::jsonb, paused = false WHERE id = ${act.event_id}`;
  return json({ ok: true, deleted: r1.length + r2.length });
}
