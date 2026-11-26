import { db } from '@/lib/db';
import { isUuid } from '@/lib/http';

export const dynamic = 'force-dynamic';

// Imagens dos slides: servidas uma vez pelo banco e depois pela CDN (nunca mudam).
export async function GET(req, { params }) {
  const { id } = await params;
  if (!isUuid(id)) return new Response('Not found', { status: 404 });
  const sql = db();
  const rows = await sql`SELECT mime, data_b64 FROM images WHERE id = ${id}`;
  if (!rows.length) return new Response('Not found', { status: 404 });
  return new Response(Buffer.from(rows[0].data_b64, 'base64'), {
    headers: {
      'Content-Type': rows[0].mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'CDN-Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
}
