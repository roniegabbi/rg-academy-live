import { db } from '@/lib/db';
import { json, error, readJson } from '@/lib/http';
import { userIdFrom, randomPin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const uid = userIdFrom(req);
  if (!uid) return error('Não autenticado', 401);
  const sql = db();
  const rows = await sql`
    SELECT e.id, e.title, e.pin, e.status, e.created_at, e.started_at, e.ended_at,
      (SELECT count(*)::int FROM activities a WHERE a.event_id = e.id) AS activities,
      (SELECT count(*)::int FROM participants p WHERE p.event_id = e.id) AS participants
    FROM events e WHERE e.owner_id = ${uid} ORDER BY e.created_at DESC`;
  return json({ ok: true, events: rows });
}

export async function POST(req) {
  const uid = userIdFrom(req);
  if (!uid) return error('Não autenticado', 401);
  const body = await readJson(req);
  const title = String(body.title || '').trim().slice(0, 140) || 'Novo evento';
  const sql = db();
  for (let i = 0; i < 8; i++) {
    const pin = randomPin();
    try {
      const rows = await sql`INSERT INTO events (owner_id, title, pin) VALUES (${uid}, ${title}, ${pin}) RETURNING id`;
      const id = rows[0].id;
      // Todo evento começa com a capa de entrada pelo QR code.
      const cfg = JSON.stringify({ mode: 'qr', heading: title, text: '' });
      await sql`INSERT INTO activities (event_id, position, kind, title, config) VALUES (${id}, 0, 'slide', 'Capa com QR code', ${cfg}::jsonb)`;
      return json({ ok: true, id });
    } catch (e) {
      if (!String(e.message || '').includes('events_pin_key')) throw e;
    }
  }
  return error('Não foi possível gerar um PIN. Tente de novo.', 500);
}
