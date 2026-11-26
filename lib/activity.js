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
  if (kind === 'quiz') return { questions: [{ text: 'Nova pergunta do quiz', options: ['Resposta A', 'Resposta B', 'Resposta C', 'Resposta D'], correct: 0, seconds: 20 }] };
  return {};
}

export function defaultTitle(kind) {
  return { slide: 'Slide', cloud: 'Mapa de palavras', choice: 'Múltipla escolha', quiz: 'Quiz competitivo' }[kind] || 'Atividade';
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
    return { question: str(c.question, 140), options, multi, maxSelect };
  }
  if (kind === 'quiz') {
    const questions = (Array.isArray(c.questions) ? c.questions : []).slice(0, 30).map((q) => {
      const options = (Array.isArray(q.options) ? q.options : []).map((o) => str(o, 80).trim()).slice(0, 4);
      const kept = options.map((o, i) => ({ o, i })).filter((x) => x.o);
      const filled = kept.map((x) => x.o);
      let correct = kept.findIndex((x) => x.i === parseInt(q.correct, 10));
      if (correct < 0) correct = 0;
      const seconds = Math.max(5, Math.min(120, parseInt(q.seconds, 10) || 20));
      return { text: str(q.text, 200), options: filled, correct, seconds };
    });
    return { questions };
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
