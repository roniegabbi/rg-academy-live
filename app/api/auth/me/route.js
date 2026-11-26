import { db } from '@/lib/db';
import { json, error } from '@/lib/http';
import { userIdFrom } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const uid = userIdFrom(req);
  if (!uid) return error('Não autenticado', 401);
  const sql = db();
  const rows = await sql`SELECT id, name, email FROM users WHERE id = ${uid}`;
  if (!rows.length) return error('Não autenticado', 401);
  return json({ ok: true, user: rows[0] });
}
