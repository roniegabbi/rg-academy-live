import { db } from '@/lib/db';
import { json, error } from '@/lib/http';

export const dynamic = 'force-dynamic';

// Resultado individual no quiz (acertou? pontos? posição?). Sem cache: é por pessoa.
export async function GET(req, { params }) {
  const { pin } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  const activityId = url.searchParams.get('activity') || '';
  const qIndex = parseInt(url.searchParams.get('q') || '0', 10) || 0;
  if (!token || !activityId) return error('Parâmetros ausentes.');
  const sql = db();
  const me = await sql`SELECT p.id, p.name FROM participants p JOIN events e ON e.id = p.event_id WHERE p.token = ${token} AND e.pin = ${pin}`;
  if (!me.length) return error('Participante não encontrado.', 401);
  const pid = me[0].id;
  const ans = await sql`SELECT correct, points, options FROM responses WHERE activity_id = ${activityId} AND participant_id = ${pid} AND q_index = ${qIndex}`;
  const rank = await sql`
    WITH s AS (SELECT participant_id, sum(points)::int AS score FROM responses WHERE activity_id = ${activityId} GROUP BY participant_id)
    SELECT (SELECT score FROM s WHERE participant_id = ${pid}) AS score,
      (SELECT count(*)::int FROM s WHERE score > coalesce((SELECT score FROM s WHERE participant_id = ${pid}), 0)) + 1 AS pos,
      (SELECT count(*)::int FROM s) AS players`;
  const r = rank[0];
  // Acertos seguidos até esta pergunta e distância para quem está logo à frente.
  const hist = await sql`SELECT q_index, correct FROM responses WHERE activity_id = ${activityId} AND participant_id = ${pid} AND q_index <= ${qIndex} ORDER BY q_index DESC`;
  let streak = 0;
  let expect = qIndex;
  for (const h of hist) {
    if (h.q_index !== expect || !h.correct) break;
    streak++;
    expect--;
  }
  const ahead = await sql`
    WITH s AS (SELECT participant_id, sum(points)::int AS score FROM responses WHERE activity_id = ${activityId} GROUP BY participant_id)
    SELECT min(score)::int AS next FROM s WHERE score > ${r.score || 0}`;
  const gap = ahead[0].next != null ? ahead[0].next - (r.score || 0) : 0;
  return json({
    ok: true,
    answered: ans.length > 0,
    correct: ans.length ? !!ans[0].correct : false,
    points: ans.length ? ans[0].points : 0,
    option: ans.length && ans[0].options ? ans[0].options[0] : null,
    score: r.score || 0,
    position: r.pos,
    players: r.players,
    streak,
    gap
  });
}
