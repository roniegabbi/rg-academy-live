import { json } from '@/lib/http';
import { clearCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  return json({ ok: true }, { headers: { 'Set-Cookie': clearCookie() } });
}
