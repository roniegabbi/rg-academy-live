// Limpa e valida a configuração de cada tipo de atividade vinda do painel.
const str = (v, max) => String(v == null ? '' : v).slice(0, max);

export function youtubeIdFrom(input) {
  const s = String(input || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/);
  return m ? m[1] : '';
}

export function defaultConfig(kind) {
  if (kind === 'slide') return { mode: 'text', heading: 'Novo slide', text: '' };
  if (kind === 'cloud') return { question: 'Em uma palavra: o que você espera deste encontro?' };
  if (kind === 'choice') return { question: 'Nova pergunta', options: ['Opção A', 'Opção B'], multi: false, maxSelect: 1 };
  if (kind === 'quiz') return { questions: [{ text: 'Nova pergunta do quiz', options: ['Resposta A', 'Resposta B', 'Resposta C', 'Resposta D'], correct: 0, seconds: 15 }] };
  if (kind === 'qa') return { question: 'Qual é a sua pergunta para o palestrante?', moderate: true };
  if (kind === 'raffle') return { prize: '', onlyNamed: true, weighted: false };
  if (kind === 'scale') return { question: 'De 0 a 10, quanto você concorda?', minLabel: 'Nada', maxLabel: 'Totalmente', showResults: true };
  if (kind === 'wall') return { question: 'Em uma frase: o que você leva da aula de hoje?', moderate: true };
  if (kind === 'rating') return { question: 'Como você avalia o encontro de hoje?', comment: true };
  if (kind === 'timer') return { label: 'Converse com quem está ao seu lado', seconds: 180 };
  if (kind === 'leaderboard') return { heading: 'Ranking do evento', top: 10 };
  return {};
}

export function defaultTitle(kind) {
  return { slide: 'Slide', cloud: 'Mapa de palavras', choice: 'Múltipla escolha', quiz: 'Quiz competitivo', qa: 'Perguntas ao palestrante', raffle: 'Sorteio', scale: 'Escala de 0 a 10', wall: 'Mural de respostas', rating: 'Avaliação do encontro', timer: 'Cronômetro', leaderboard: 'Ranking do evento' }[kind] || 'Atividade';
}

export function cleanConfig(kind, c = {}) {
  if (kind === 'slide') {
    const mode = ['cover', 'qr', 'image', 'youtube', 'text'].includes(c.mode) ? c.mode : 'text';
    const out = { mode, heading: str(c.heading, 140), text: str(c.text, 1000) };
    if (mode === 'cover') {
      out.eyebrow = str(c.eyebrow, 40);
      out.bgWord = str(c.bgWord, 16);
      out.presenter = str(c.presenter, 80);
      out.date = str(c.date, 60);
      out.place = str(c.place, 80);
    }
    if (mode === 'image') out.imageUrl = /^(\/api\/img\/[0-9a-f-]{36}|https:\/\/[^\s"'<>]+)$/i.test(c.imageUrl || '') ? c.imageUrl : '';
    if (mode === 'youtube') {
      out.youtubeUrl = str(c.youtubeUrl, 300);
      out.youtubeId = youtubeIdFrom(c.youtubeUrl || c.youtubeId);
    }
    // Botão no celular junto do slide (ex.: formulário de presença, material da aula).
    const link = String(c.linkUrl || '').trim();
    out.linkUrl = /^https?:\/\/[^\s"'<>]{3,500}$/i.test(link) ? link : '';
    out.linkLabel = out.linkUrl ? (str(c.linkLabel, 40).trim() || 'Abrir link') : '';
    return out;
  }
  if (kind === 'cloud') {
    const hidden = (Array.isArray(c.hidden) ? c.hidden : []).map((w) => str(w, 25)).filter(Boolean).slice(0, 200);
    return { question: str(c.question, 140), hidden, allowEmoji: c.allowEmoji !== false };
  }
  if (kind === 'choice') {
    const options = (Array.isArray(c.options) ? c.options : []).map((o) => str(o, 80).trim()).filter(Boolean).slice(0, 10);
    const multi = !!c.multi;
    const maxSelect = multi ? Math.max(1, Math.min(options.length || 1, parseInt(c.maxSelect, 10) || options.length || 1)) : 1;
    const compareWith = /^[0-9a-f-]{36}$/i.test(String(c.compareWith || '')) ? String(c.compareWith) : '';
    return { question: str(c.question, 140), options, multi, maxSelect, showResults: c.showResults !== false, compareWith };
  }
  if (kind === 'scale') return { question: str(c.question, 140), minLabel: str(c.minLabel, 30), maxLabel: str(c.maxLabel, 30), showResults: c.showResults !== false };
  if (kind === 'wall') return { question: str(c.question, 140), moderate: c.moderate !== false };
  if (kind === 'rating') return { question: str(c.question, 140), comment: c.comment !== false };
  if (kind === 'timer') return { label: str(c.label, 120), seconds: Math.max(10, Math.min(3600, parseInt(c.seconds, 10) || 180)) };
  if (kind === 'leaderboard') return { heading: str(c.heading, 80), top: Math.max(3, Math.min(10, parseInt(c.top, 10) || 10)) };
  if (kind === 'qa') return { question: str(c.question, 140), moderate: c.moderate !== false };
  if (kind === 'raffle') return { prize: str(c.prize, 80), onlyNamed: c.onlyNamed !== false, weighted: !!c.weighted };
  if (kind === 'quiz') {
    const questions = (Array.isArray(c.questions) ? c.questions : []).slice(0, 30).map((q) => {
      const options = (Array.isArray(q.options) ? q.options : []).map((o) => str(o, 80).trim()).slice(0, 4);
      const kept = options.map((o, i) => ({ o, i })).filter((x) => x.o);
      const filled = kept.map((x) => x.o);
      let correct = kept.findIndex((x) => x.i === parseInt(q.correct, 10));
      if (correct < 0) correct = 0;
      const seconds = Math.max(5, Math.min(120, parseInt(q.seconds, 10) || 15));
      return { text: str(q.text, 200), options: filled, correct, seconds };
    });
    // Quiz por equipes: 2 a 8 equipes (mesas, setores…). Vazio = quiz individual.
    const teams = [...new Set((Array.isArray(c.teams) ? c.teams : []).map((t) => str(t, 30).trim()).filter(Boolean))].slice(0, 8);
    return { questions, teams: teams.length >= 2 ? teams : [] };
  }
  return {};
}

export function validateForLive(kind, c) {
  if (kind === 'choice' && (!c.options || c.options.length < 2)) return 'A múltipla escolha precisa de pelo menos 2 alternativas.';
  if (kind === 'quiz') {
    if (!c.questions || !c.questions.length) return 'O quiz precisa de pelo menos 1 pergunta.';
    if (c.questions.some((q) => q.options.length < 2)) return 'Cada pergunta do quiz precisa de pelo menos 2 alternativas.';
  }
  return null;
}
