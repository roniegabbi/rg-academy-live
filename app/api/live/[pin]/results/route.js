import { cachedJson, error } from '@/lib/http';
import { loadEventByPin, publicState, activityResults, countParticipants } from '@/lib/live';

export const dynamic = 'force-dynamic';

// Resultado agregado da atividade atual, para o telão.
export async function GET(req, { params }) {
  const { pin } = await params;
  const data = await loadEventByPin(pin);
  if (!data) return error('Evento não encontrado.', 404);
  const state = publicState(data.ev, data.acts);
  const act = data.acts[state.index];
  const [results, participants] = await Promise.all([
    activityResults(act, data.ev.run || {}),
    countParticipants(data.ev.id)
  ]);
  return cachedJson({ ...state, results, participants }, 1);
}
