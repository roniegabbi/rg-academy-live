import { db } from '@/lib/db';
import { json, error, readJson } from '@/lib/http';
import crypto from 'node:crypto';
import { randomToken } from '@/lib/auth';
import { isBlocked } from '@/lib/moderation';

export const dynamic = 'force-dynamic';

// Limites contra entradas falsas em massa. Generosos: num auditório, centenas de
// celulares saem pela mesma rede Wi-Fi (mesmo IP).
const PER_NETWORK_PER_MINUTE = 150;
const MAX_PER_EVENT = 2000;

function networkOf(req) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || '';
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip + '|' + (process.env.SESSION_SECRET || '')).digest('hex').slice(0, 16);
}

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
  const net = networkOf(req);
  const lim = await sql`SELECT
      (SELECT count(*)::int FROM participants WHERE event_id = ${ev.id}) AS total,
      (SELECT count(*)::int FROM participants WHERE event_id = ${ev.id} AND ip_hash = ${net} AND created_at > now() - interval '1 minute') AS recent`;
  if (lim[0].total >= MAX_PER_EVENT) return error('Este evento atingiu o limite de participantes.', 429);
  if (net && lim[0].recent >= PER_NETWORK_PER_MINUTE) return error('Muitas entradas pela mesma rede agora. Aguarde um minuto e tente de novo.', 429);
  const token = randomToken();
  await sql`INSERT INTO participants (event_id, name, token, ip_hash) VALUES (${ev.id}, ${name}, ${token}, ${net})`;
  return json({ ok: true, token, name });
}
