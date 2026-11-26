import { db } from '@/lib/db';
import { json, error, readJson } from '@/lib/http';

export const dynamic = 'force-dynamic';

const REACTIONS = ['👏', '❤️', '🔥', '😂', '💡', '🙌'];

// Reação ao vivo do público (sobe flutuando no telão). Máx. 1 a cada 1,5 s por pessoa.
export async function POST(req, { params }) {
  const { pin } = await params;
  if (!/^\d{6}$/.test(String(pin))) return error('PIN inválido.', 404);
  const body = await readJson(req);
  const emoji = String(body.emoji || '');
  if (!REACTIONS.includes(emoji)) return error('Reação inválida.');
  const token = String(body.token || '');
  if (!token) return error('Entre no evento primeiro.', 401);
  const sql = db();
  const rows = await sql`
    UPDATE participants p SET last_react = now()
    FROM events e
    WHERE p.token = ${token} AND p.event_id = e.id AND e.pin = ${pin} AND e.status = 'live'
      AND (p.last_react IS NULL OR p.last_react < now() - interval '1.5 seconds')
    RETURNING e.id AS event_id`;
  if (!rows.length) return json({ ok: false, throttled: true }, { status: 429 });
  await sql`INSERT INTO reactions (event_id, emoji) VALUES (${rows[0].event_id}, ${emoji})`;
  return json({ ok: true });
}
