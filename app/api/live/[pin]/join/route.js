import { db } from '@/lib/db';
import { json, error, readJson } from '@/lib/http';
import { randomToken } from '@/lib/auth';
import { isBlocked } from '@/lib/moderation';

export const dynamic = 'force-dynamic';

// Participante entra pelo QR code (ou PIN). Recebe um token guardado no celular.
export async function POST(req, { params }) {
  const { pin } = await params;
  if (!/^\d{6}$/.test(String(pin))) return error('PIN inválido.', 404);
  const body = await readJson(req);
  const sql = db();
  const evs = await sql`SELECT id, status, require_name FROM events WHERE pin = ${pin}`;
  if (!evs.length) return error('Evento não encontrado. Confira o PIN.', 404);
  const ev = evs[0];
  if (ev.status === 'ended') return error('Este evento já foi encerrado.', 410);
  const name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (ev.require_name && name.length < 2) return error('Informe seu nome para entrar.');
  if (name && isBlocked(name)) return error('Esse nome não é permitido. Use seu nome ou apelido.', 422);
  // Reaproveita o token se o celular já tinha entrado antes (recarregou a página).
  if (body.token && typeof body.token === 'string') {
    const ex = await sql`SELECT id, name FROM participants WHERE token = ${body.token} AND event_id = ${ev.id}`;
    if (ex.length) {
      if (name && name !== ex[0].name) await sql`UPDATE participants SET name = ${name} WHERE id = ${ex[0].id}`;
      return json({ ok: true, token: body.token, name: name || ex[0].name });
    }
  }
  const token = randomToken();
  await sql`INSERT INTO participants (event_id, name, token) VALUES (${ev.id}, ${name}, ${token})`;
  return json({ ok: true, token, name });
}
