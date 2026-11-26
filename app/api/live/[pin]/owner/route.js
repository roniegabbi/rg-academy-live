import { db } from '@/lib/db';
import { json } from '@/lib/http';
import { userIdFrom } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// O telão pergunta se quem está vendo é o dono do evento (para mostrar os controles).
export async function GET(req, { params }) {
  const { pin } = await params;
  const uid = userIdFrom(req);
  if (!uid || !/^\d{6}$/.test(String(pin))) return json({ ok: true, owner: false });
  const sql = db();
  const rows = await sql`SELECT id FROM events WHERE pin = ${pin} AND owner_id = ${uid}`;
  return json({ ok: true, owner: rows.length > 0, eventId: rows.length ? rows[0].id : null });
}
