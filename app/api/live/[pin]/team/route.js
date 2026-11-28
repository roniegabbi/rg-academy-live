import { db } from '@/lib/db';
import { json, error, readJson } from '@/lib/http';

export const dynamic = 'force-dynamic';

// Participante escolhe a equipe (vale para todos os quizzes por equipes do evento).
export async function POST(req, { params }) {
  const { pin } = await params;
  if (!/^\d{6}$/.test(String(pin))) return error('PIN inválido.', 404);
  const body = await readJson(req);
  const token = String(body.token || '');
  const team = String(body.team || '').trim().slice(0, 30);
  if (!token) return error('Entre no evento primeiro.', 401);
  const sql = db();
  const ok = await sql`SELECT 1 FROM activities a JOIN events e ON e.id = a.event_id
    WHERE e.pin = ${pin} AND a.kind = 'quiz' AND a.config->'teams' ? ${team} LIMIT 1`;
  if (!ok.length) return error('Equipe não encontrada.', 404);
  const upd = await sql`UPDATE participants p SET team = ${team} FROM events e
    WHERE p.event_id = e.id AND e.pin = ${pin} AND p.token = ${token} RETURNING p.id`;
  if (!upd.length) return error('Entre no evento primeiro.', 401);
  return json({ ok: true, team });
}
