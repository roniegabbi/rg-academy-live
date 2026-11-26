import { json, error } from '@/lib/http';
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
  return json({ ...state, results, participants, activities: data.acts.map((a) => ({ id: a.id, kind: a.kind, title: a.title, mode: a.config && a.config.mode })) });
}
