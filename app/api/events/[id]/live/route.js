import { json, error } from '@/lib/http';
import { db } from '@/lib/db';
import { ownedEvent } from '@/lib/auth';
import { loadEventById, publicState, activityResults, countParticipants } from '@/lib/live';

export const dynamic = 'force-dynamic';

// Estado + resultado sem cache, só para o palestrante (painel de controle).
export async function GET(req, { params }) {
  const { id } = await params;
  const o = await ownedEvent(req, id);
  if (!o.event) return error('Evento não encontrado', o.status);
  const data = await loadEventById(id);
  const state = publicState(data.ev, data.acts);
  const act = data.acts[state.index];
  const [results, participants] = await Promise.all([
    activityResults(act, data.ev.run || {}),
    countParticipants(id)
  ]);
  const rc = await db()`SELECT count(*)::int AS n FROM responses WHERE event_id = ${id}`;
  const stats = { responses: rc[0].n, activities: data.acts.filter((a) => a.kind !== 'slide').length };
  const reactions = data.ev.status === 'live'
    ? await db()`SELECT id::text AS id, emoji FROM reactions WHERE event_id = ${id} AND created_at > now() - interval '3 seconds' ORDER BY id DESC LIMIT 60`
    : [];
  return json({ ...state, results, participants, stats, reactions, activities: data.acts.map((a) => ({ id: a.id, kind: a.kind, title: a.title, mode: a.config && a.config.mode })) });
}
