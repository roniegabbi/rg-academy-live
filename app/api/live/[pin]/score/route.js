import { json, error } from '@/lib/http';
import { db } from '@/lib/db';
import { eventScores } from '@/lib/live';

export const dynamic = 'force-dynamic';

// Pontos de participação de uma pessoa no evento inteiro (para a tela de ranking no celular).
export async function GET(req, { params }) {
  const { pin } = await params;
  const token = new URL(req.url).searchParams.get('token') || '';
  if (!/^\d{6}$/.test(String(pin)) || !token) return error('Parâmetros ausentes.');
  const me = await db()`SELECT p.id, p.event_id FROM participants p JOIN events e ON e.id = p.event_id WHERE p.token = ${token} AND e.pin = ${pin}`;
  if (!me.length) return error('Participante não encontrado.', 401);
  const rows = await eventScores(me[0].event_id);
  const i = rows.findIndex((r) => r.id === me[0].id);
  const mine = rows[i] || { score: 0, actions: 0 };
  const ahead = rows.filter((r) => r.score > mine.score);
  const gap = ahead.length ? ahead[ahead.length - 1].score - mine.score : 0;
  return json({ ok: true, score: mine.score, actions: mine.actions, position: ahead.length + 1, players: rows.filter((r) => r.score > 0).length || rows.length, gap });
}
