import { db } from '@/lib/db';
import { json, error, readJson, isUuid } from '@/lib/http';
import { userIdFrom } from '@/lib/auth';
import { cleanConfig } from '@/lib/activity';

export const dynamic = 'force-dynamic';

async function owned(req, id) {
  const uid = userIdFrom(req);
  if (!uid) return { status: 401 };
  if (!isUuid(id)) return { status: 404 };
  const sql = db();
  const rows = await sql`SELECT a.* FROM activities a JOIN events e ON e.id = a.event_id WHERE a.id = ${id} AND e.owner_id = ${uid}`;
  if (!rows.length) return { status: 404 };
  return { act: rows[0] };
}

export async function PATCH(req, { params }) {
  const { id } = await params;
  const o = await owned(req, id);
  if (!o.act) return error('Atividade não encontrada', o.status);
  const body = await readJson(req);
  const title = body.title !== undefined ? String(body.title).trim().slice(0, 140) : o.act.title;
  const config = body.config !== undefined ? cleanConfig(o.act.kind, body.config) : o.act.config;
  const sql = db();
  const rows = await sql`UPDATE activities SET title = ${title}, config = ${JSON.stringify(config)}::jsonb WHERE id = ${id} RETURNING id, position, kind, title, config`;
  return json({ ok: true, activity: rows[0] });
}

export async function POST(req, { params }) {
  // Duplicar atividade (vai para logo depois da original).
  const { id } = await params;
  const o = await owned(req, id);
  if (!o.act) return error('Atividade não encontrada', o.status);
  const sql = db();
  await sql`UPDATE activities SET position = position + 1 WHERE event_id = ${o.act.event_id} AND position > ${o.act.position}`;
  const rows = await sql`INSERT INTO activities (event_id, position, kind, title, config) VALUES (${o.act.event_id}, ${o.act.position + 1}, ${o.act.kind}, ${(o.act.title + ' (cópia)').slice(0, 140)}, ${JSON.stringify(o.act.config)}::jsonb) RETURNING id`;
  return json({ ok: true, id: rows[0].id });
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const o = await owned(req, id);
  if (!o.act) return error('Atividade não encontrada', o.status);
  const sql = db();
  await sql`DELETE FROM activities WHERE id = ${id}`;
  return json({ ok: true });
}
