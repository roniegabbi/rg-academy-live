import { db } from '@/lib/db';
import { json, error, readJson } from '@/lib/http';
import { hashPassword, sessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Cadastro de palestrante: exige o código de convite da RG Academy.
export async function POST(req) {
  const body = await readJson(req);
  const name = String(body.name || '').trim().slice(0, 80);
  const email = String(body.email || '').trim().toLowerCase().slice(0, 160);
  const password = String(body.password || '');
  const code = String(body.code || '').trim();
  if (!process.env.SIGNUP_CODE || code !== process.env.SIGNUP_CODE) return error('Código de convite inválido.', 403);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error('Informe nome e um e-mail válido.');
  if (password.length < 8) return error('A senha precisa ter pelo menos 8 caracteres.');
  const sql = db();
  const exists = await sql`SELECT 1 FROM users WHERE email = ${email}`;
  if (exists.length) return error('Já existe uma conta com este e-mail.', 409);
  const rows = await sql`INSERT INTO users (email, name, pass_hash) VALUES (${email}, ${name}, ${hashPassword(password)}) RETURNING id, name`;
  return json({ ok: true, user: rows[0] }, { headers: { 'Set-Cookie': sessionCookie(rows[0].id) } });
}
