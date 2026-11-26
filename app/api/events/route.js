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
      // Todo evento começa com a capa (slide 1) e o QR code de entrada (slide 2).
      const me = await sql`SELECT name FROM users WHERE id = ${uid}`;
      const words = title.split(/\s+/).filter((w) => w.length > 3);
      const cover = JSON.stringify({ mode: 'cover', heading: title, text: '', eyebrow: 'Workshop', bgWord: (words[words.length - 1] || title).toUpperCase().slice(0, 16), presenter: me.length ? me[0].name : '', date: '', place: '' });
      const qr = JSON.stringify({ mode: 'qr', heading: '', text: '' });
      await sql`INSERT INTO activities (event_id, position, kind, title, config) VALUES (${id}, 0, 'slide', ${title}, ${cover}::jsonb)`;
      await sql`INSERT INTO activities (event_id, position, kind, title, config) VALUES (${id}, 1, 'slide', 'QR code para participar', ${qr}::jsonb)`;
      return json({ ok: true, id });
    } catch (e) {
      if (!String(e.message || '').includes('events_pin_key')) throw e;
    }
  }
  return error('Não foi possível gerar um PIN. Tente de novo.', 500);
}
