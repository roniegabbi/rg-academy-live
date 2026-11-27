import { db } from '@/lib/db';
import { json, error, readJson } from '@/lib/http';
import { ownedEvent } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const { id } = await params;
  const o = await ownedEvent(req, id);
  if (!o.event) return error('Evento não encontrado', o.status);
  const sql = db();
  const acts = await sql`SELECT id, position, kind, title, config FROM activities WHERE event_id = ${id} ORDER BY position, created_at`;
  const p = await sql`SELECT count(*)::int AS n FROM participants WHERE event_id = ${id}`;
  return json({ ok: true, event: o.event, activities: acts, participants: p[0].n });
}

export async function PATCH(req, { params }) {
  const { id } = await params;
  const o = await ownedEvent(req, id);
  if (!o.event) return error('Evento não encontrado', o.status);
  const body = await readJson(req);
  const title = body.title !== undefined ? String(body.title).trim().slice(0, 140) || o.event.title : o.event.title;
  const requireName = body.requireName !== undefined ? !!body.requireName : o.event.require_name;
  const reactionsOn = body.reactionsOn !== undefined ? !!body.reactionsOn : o.event.reactions_on !== false;
  const sql = db();
  await sql`UPDATE events SET title = ${title}, require_name = ${requireName}, reactions_on = ${reactionsOn}, updated_at = now() WHERE id = ${id}`;
  return json({ ok: true });
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const o = await ownedEvent(req, id);
  if (!o.event) return error('Evento não encontrado', o.status);
  const sql = db();
  await sql`DELETE FROM events WHERE id = ${id}`;
  return json({ ok: true });
}
