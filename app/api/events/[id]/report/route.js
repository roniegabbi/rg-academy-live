import { db } from '@/lib/db';
import { json, error } from '@/lib/http';
import { ownedEvent } from '@/lib/auth';
import { activityResults, quizQuestions } from '@/lib/live';

export const dynamic = 'force-dynamic';

// Dados completos do relatório em PDF: resultado final de cada atividade.
export async function GET(req, { params }) {
  const { id } = await params;
  const o = await ownedEvent(req, id);
  if (!o.event) return error('Evento não encontrado', o.status);
  const sql = db();
  const acts = await sql`SELECT id, position, kind, title, config FROM activities WHERE event_id = ${id} ORDER BY position, created_at`;
  const parts = await sql`SELECT count(*)::int AS n FROM participants WHERE event_id = ${id}`;
  const resp = await sql`SELECT count(*)::int AS n FROM responses WHERE event_id = ${id}`;
  const owner = await sql`SELECT name FROM users WHERE id = ${o.uid}`;
  const out = [];
  for (const a of acts) {
    const item = { id: a.id, kind: a.kind, title: a.title, config: a.config };
    if (a.kind === 'cloud' || a.kind === 'choice') item.results = await activityResults(a, {});
    if (a.kind === 'quiz') {
      const qs = quizQuestions(a);
      item.questions = [];
      for (let i = 0; i < qs.length; i++) {
        const r = await activityResults(a, {}, { qIndex: i, all: true, rankLimit: 10 });
        item.questions.push({ ...qs[i], counts: r.counts, answered: r.answered });
        item.ranking = r.ranking;
      }
    }
    out.push(item);
  }
  return json({
    ok: true,
    event: { id: o.event.id, title: o.event.title, pin: o.event.pin, status: o.event.status, started_at: o.event.started_at, ended_at: o.event.ended_at, created_at: o.event.created_at },
    presenter: owner[0] ? owner[0].name : '',
    participants: parts[0].n,
    responses: resp[0].n,
    activities: out
  });
}
