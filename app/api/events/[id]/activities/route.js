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
  // Se o evento está ao vivo, o telão continua na mesma atividade depois da troca de ordem.
  const before = await sql`SELECT id FROM activities WHERE event_id = ${id} ORDER BY position, created_at`;
  const currentId = before[Math.min(o.event.current_index || 0, Math.max(0, before.length - 1))]?.id;
  for (let i = 0; i < ids.length; i++) {
    await sql`UPDATE activities SET position = ${i} WHERE id = ${ids[i]} AND event_id = ${id}`;
  }
  const newIndex = currentId ? ids.indexOf(currentId) : -1;
  if (newIndex >= 0 && newIndex !== o.event.current_index) await sql`UPDATE events SET current_index = ${newIndex} WHERE id = ${id}`;
  return json({ ok: true });
}
