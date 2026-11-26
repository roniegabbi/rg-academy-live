import { db } from '@/lib/db';
import { json, error, readJson } from '@/lib/http';
import { verifyPassword, sessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const body = await readJson(req);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email || !password) return error('Informe e-mail e senha.');
  const sql = db();
  const rows = await sql`SELECT id, name, pass_hash FROM users WHERE email = ${email}`;
  if (!rows.length || !verifyPassword(password, rows[0].pass_hash)) {
    await new Promise((r) => setTimeout(r, 900)); // freia tentativas em série
    return error('E-mail ou senha incorretos.', 401);
  }
  return json({ ok: true, user: { id: rows[0].id, name: rows[0].name } }, { headers: { 'Set-Cookie': sessionCookie(rows[0].id) } });
}
