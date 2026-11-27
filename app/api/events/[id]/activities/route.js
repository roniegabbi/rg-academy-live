import { db } from '@/lib/db';
import { json, error, readJson, isUuid } from '@/lib/http';
import { ownedEvent } from '@/lib/auth';
import { KINDS } from '@/lib/live';
import { cleanConfig, defaultConfig, defaultTitle } from '@/lib/activity';

export const dynamic = 'force-dynamic';

// Cria uma ou várias atividades (várias = importação de PDF, uma por página).
export async function POST(req, { params }) {
  const { id } = await params;
  const o = await ownedEvent(req, id);
  if (!o.event) return error('Evento não encontrado', o.status);
  const body = await readJson(req);
  const items = Array.isArray(body.items) ? body.items : [body];
  if (!items.length || items.length > 200) return error('Nada para criar.');
  const sql = db();
  const before = (await sql`SELECT id FROM activities WHERE event_id = ${id} ORDER BY position, created_at`).map((r) => r.id);
  const maxr = await sql`SELECT coalesce(max(position), -1)::int AS m FROM activities WHERE event_id = ${id}`;
  let pos = maxr[0].m + 1;
  const created = [];
  for (const it of items) {
    const kind = KINDS.includes(it.kind) ? it.kind : null;
    if (!kind) return error('Tipo de atividade inválido.');
    const config = cleanConfig(kind, it.config || defaultConfig(kind));
    const title = String(it.title || defaultTitle(kind)).trim().slice(0, 140);
    const rows = await sql`INSERT INTO activities (event_id, position, kind, title, config) VALUES (${id}, ${pos}, ${kind}, ${title}, ${JSON.stringify(config)}::jsonb) RETURNING id, position, kind, title, config`;
    created.push(rows[0]);
    pos++;
  }
  // Inserir logo depois de uma atividade escolhida (em vez de no fim).
  const at = isUuid(body.after) ? before.indexOf(body.after) : -1;
  if (at >= 0 && at < before.length - 1) {
    const ids = [...before.slice(0, at + 1), ...created.map((c) => c.id), ...before.slice(at + 1)];
    await saveOrder(sql, o.event, before, ids);
    created.forEach((c, i) => { c.position = at + 1 + i; });
  }
  return json({ ok: true, activities: created });
}

// Reordena: recebe a lista de ids na nova ordem.
export async function PUT(req, { params }) {
  const { id } = await params;
  const o = await ownedEvent(req, id);
  if (!o.event) return error('Evento não encontrado', o.status);
  const body = await readJson(req);
  const ids = Array.isArray(body.order) ? body.order.filter(isUuid) : [];
  const sql = db();
  const before = (await sql`SELECT id FROM activities WHERE event_id = ${id} ORDER BY position, created_at`).map((r) => r.id);
  await saveOrder(sql, o.event, before, ids);
  return json({ ok: true });
}

// Grava a ordem e, com o evento ao vivo, mantém o telão na mesma atividade.
async function saveOrder(sql, ev, beforeIds, ids) {
  const currentId = beforeIds[Math.min(ev.current_index || 0, Math.max(0, beforeIds.length - 1))];
  for (let i = 0; i < ids.length; i++) {
    await sql`UPDATE activities SET position = ${i} WHERE id = ${ids[i]} AND event_id = ${ev.id}`;
  }
  let idx = currentId ? ids.indexOf(currentId) : -1;
  if (idx < 0) idx = Math.min(ev.current_index || 0, Math.max(0, ids.length - 1));
  if (idx !== ev.current_index) await sql`UPDATE events SET current_index = ${idx} WHERE id = ${ev.id}`;
}

// Exclui várias atividades de uma vez (ex.: páginas do PDF que sobraram).
export async function DELETE(req, { params }) {
  const { id } = await params;
  const o = await ownedEvent(req, id);
  if (!o.event) return error('Evento não encontrado', o.status);
  const body = await readJson(req);
  const del = new Set((Array.isArray(body.ids) ? body.ids : []).filter(isUuid));
  if (!del.size) return error('Nada selecionado.');
  const sql = db();
  const before = (await sql`SELECT id FROM activities WHERE event_id = ${id} ORDER BY position, created_at`).map((r) => r.id);
  const gone = before.filter((x) => del.has(x));
  for (const a of gone) await sql`DELETE FROM activities WHERE id = ${a} AND event_id = ${id}`;
  const left = before.filter((x) => !del.has(x));
  for (let i = 0; i < left.length; i++) await sql`UPDATE activities SET position = ${i} WHERE id = ${left[i]}`;
  // Ao vivo: o telão fica na mesma atividade; se ela foi excluída, vai para a anterior que sobrou.
  const cur = Math.min(o.event.current_index || 0, Math.max(0, before.length - 1));
  let k = cur;
  while (k >= 0 && del.has(before[k])) k--;
  const idx = k >= 0 ? left.indexOf(before[k]) : 0;
  if (del.has(before[cur])) await sql`UPDATE events SET current_index = ${Math.max(0, idx)}, run = '{}'::jsonb WHERE id = ${id}`;
  else if (idx !== o.event.current_index) await sql`UPDATE events SET current_index = ${Math.max(0, idx)} WHERE id = ${id}`;
  return json({ ok: true, deleted: gone.length });
}
