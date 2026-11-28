// Um único "Avançar" que sempre faz o próximo passo certo (inclusive dentro do quiz).
export function nextStep(data) {
  if (!data || !data.event) return null;
  const { event, activity: a, run = {}, index = 0, total = 0 } = data;
  if (event.status !== 'live') return { action: 'start', label: event.status === 'ended' ? 'Reabrir evento' : 'Iniciar evento' };
  if (event.showQr) return { action: 'qrHide', label: 'Voltar ao evento' };
  if (a && a.kind === 'quiz') {
    const n = (a.qIndex || 0) + 1;
    if (run.phase === 'ready') return { action: 'quizStart', label: `Iniciar pergunta ${n}` };
    if (run.phase === 'question' || run.phase === 'closed') return { action: 'quizReveal', label: 'Revelar resposta' };
    if (run.phase === 'reveal') return { action: 'quizRank', label: 'Mostrar ranking' };
    if (run.phase === 'rank' && n < (a.qTotal || 0)) return { action: 'quizNext', label: `Ir para pergunta ${n + 1}` };
  }
  if (a && a.kind === 'timer' && run.state !== 'running' && run.state !== 'done' && (run.left == null || run.left > 0)) {
    return { action: 'timerStart', label: run.state === 'paused' ? 'Continuar cronômetro' : 'Iniciar cronômetro' };
  }
  if (a && a.kind === 'raffle' && data.results && data.results.kind === 'raffle' && !(data.results.winners || []).length) return { action: 'raffleDraw', label: 'Sortear agora' };
  if (index < total - 1) return { action: 'next', label: 'Próxima atividade' };
  return { action: 'end', label: 'Encerrar evento', last: true };
}

export function prevStep(data) {
  if (!data || !data.event || data.event.status !== 'live') return null;
  if ((data.index || 0) <= 0) return null;
  return { action: 'prev', label: 'Voltar' };
}
