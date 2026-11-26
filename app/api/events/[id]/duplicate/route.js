import { db } from '@/lib/db';
import { json, error } from '@/lib/http';
import { ownedEvent, randomPin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Duplica o evento (atividades incluídas, sem respostas) para usar como modelo.
export async function POST(req, { params }) {
  const { id } = await params;
  const o = await ownedEvent(req, id);
  if (!o.event) return error('Evento não encontrado', o.status);
  const sql = db();
  for (let i = 0; i < 8; i++) {
    const pin = randomPin();
    try {
      const rows = await sql`INSERT INTO events (owner_id, title, pin, require_name) VALUES (${o.uid}, ${(o.event.title + ' (cópia)').slice(0, 140)}, ${pin}, ${o.event.require_name}) RETURNING id`;
      const nid = rows[0].id;
      await sql`INSERT INTO activities (event_id, position, kind, title, config) SELECT ${nid}, position, kind, title, config FROM activities WHERE event_id = ${id}`;
      return json({ ok: true, id: nid });
    } catch (e) {
      if (!String(e.message || '').includes('events_pin_key')) throw e;
    }
  }
  return error('Não foi possível duplicar. Tente de novo.', 500);
}
