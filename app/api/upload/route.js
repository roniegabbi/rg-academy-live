import { db } from '@/lib/db';
import { json, error } from '@/lib/http';
import { userIdFrom } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

// Recebe imagens já comprimidas no navegador (slides e páginas de PDF).
export async function POST(req) {
  const uid = userIdFrom(req);
  if (!uid) return error('Não autenticado', 401);
  let form;
  try {
    form = await req.formData();
  } catch {
    return error('Envio inválido.');
  }
  const file = form.get('file');
  if (!file || typeof file === 'string') return error('Arquivo ausente.');
  if (!ALLOWED.includes(file.type)) return error('Formato não suportado. Use JPG, PNG ou WEBP.');
  if (file.size > 4 * 1024 * 1024) return error('Imagem grande demais (máx. 4 MB).');
  const buf = Buffer.from(await file.arrayBuffer());
  const sql = db();
  const rows = await sql`INSERT INTO images (owner_id, mime, data_b64) VALUES (${uid}, ${file.type}, ${buf.toString('base64')}) RETURNING id`;
  return json({ ok: true, url: `/api/img/${rows[0].id}` });
}
