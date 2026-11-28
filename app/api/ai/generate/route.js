import { json, error, readJson } from '@/lib/http';
import { userIdFrom } from '@/lib/auth';
import { cleanConfig } from '@/lib/activity';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
const LEVELS = { facil: 'fácil (conceitos básicos)', medio: 'médio (aplicação prática)', dificil: 'difícil (situações complexas e nuances)' };

function systemPrompt() {
  return 'Você é um designer instrucional da RG Academy, empresa de educação corporativa no Brasil. ' +
    'Cria atividades interativas para palestras e workshops corporativos, em português do Brasil, com linguagem clara, profissional e objetiva. ' +
    'Responda SOMENTE com JSON válido, sem texto antes ou depois e sem blocos de código.';
}

function userPrompt(kind, p) {
  const base = `Tema: ${p.topic}\n` + (p.context ? `\nMaterial de apoio do palestrante (use como base principal):\n"""\n${p.context}\n"""\n` : '');
  if (kind === 'quiz') {
    return base + `\nCrie um quiz competitivo com exatamente ${p.count} perguntas de nível ${LEVELS[p.level] || LEVELS.medio}.\n` +
      'Regras:\n- Cada pergunta tem no máximo 160 caracteres e exatamente 4 alternativas curtas (máximo 60 caracteres cada).\n' +
      '- Apenas UMA alternativa correta, sem ambiguidade; as erradas devem ser plausíveis.\n' +
      '- Varie a posição da resposta correta entre as perguntas.\n- Não use "todas as anteriores" nem "nenhuma das anteriores".\n' +
      'Formato: {"questions":[{"text":"...","options":["...","...","...","..."],"correct":0}]} (correct = índice 0 a 3).';
  }
  if (kind === 'choice') {
    return base + `\nCrie ${p.count || 3} perguntas de enquete (múltipla escolha de opinião, sem resposta certa) para gerar discussão com o público.\n` +
      'Regras: pergunta com no máximo 120 caracteres; de 4 a 5 opções curtas (máximo 50 caracteres) e mutuamente exclusivas.\n' +
      'Formato: {"polls":[{"question":"...","options":["...","...","...","..."]}]}';
  }
  const n = p.count || 4;
  if (kind === 'scale') {
    return base + `\nSugira ${n} perguntas de autoavaliação para uma escala de 0 a 10 respondida pelo público no celular, que gerem reflexão e debate.\n` +
      'Regras: comece com "De 0 a 10," e tenha no máximo 120 caracteres; diga o que significa 0 e o que significa 10 (máximo 25 caracteres cada).\n' +
      'Formato: {"items":[{"question":"De 0 a 10, ...","minLabel":"...","maxLabel":"..."}]}';
  }
  if (kind === 'wall') {
    return base + `\nSugira ${n} perguntas para um mural ao vivo, em que cada pessoa responde com UMA frase curta (até 120 caracteres) que aparece num cartão no telão.\n` +
      'Regras: perguntas abertas, inspiradoras e práticas, com no máximo 110 caracteres; prefira começar com "Em uma frase: ...".\nFormato: {"items":[{"question":"..."}]}';
  }
  if (kind === 'qa') {
    return base + `\nSugira ${n} chamadas curtas para convidar o público a enviar perguntas ao palestrante pelo celular.\n` +
      'Regras: tom acolhedor, máximo 90 caracteres, ligadas ao tema.\nFormato: {"items":[{"question":"..."}]}';
  }
  if (kind === 'rating') {
    return base + `\nSugira ${n} perguntas para o público avaliar o encontro com estrelas de 1 a 5 no fim do evento.\n` +
      'Regras: claras, máximo 90 caracteres, que possam ser respondidas com uma nota de 1 a 5.\nFormato: {"items":[{"question":"..."}]}';
  }
  if (kind === 'timer') {
    return base + `\nSugira ${n} dinâmicas rápidas em duplas ou pequenos grupos, para fazer durante a palestra com um cronômetro no telão.\n` +
      'Regras: a instrução tem no máximo 110 caracteres, é direta e começa com um verbo (ex.: "Converse com quem está ao seu lado: ..."); ' +
      'sugira a duração em segundos entre 60 e 600, adequada à dinâmica.\nFormato: {"items":[{"label":"...","seconds":180}]}';
  }
  return base + `\nSugira ${p.count || 4} perguntas para um mapa de palavras ao vivo, que o público responde com UMA palavra.\n` +
    'Regras: máximo 100 caracteres; comece pedindo uma palavra (ex.: "Em uma palavra: ...").\nFormato: {"questions":["...","..."]}';
}

function parseJson(text) {
  const t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('Resposta da IA sem JSON');
  return JSON.parse(t.slice(start, end + 1));
}

// Gera atividades com o Claude (Anthropic). O palestrante revisa antes de salvar.
export async function POST(req) {
  const uid = userIdFrom(req);
  if (!uid) return error('Não autenticado', 401);
  if (!process.env.ANTHROPIC_API_KEY) return error('A IA ainda não está configurada (falta a chave ANTHROPIC_API_KEY na Vercel).', 503);
  const body = await readJson(req);
  const kind = ['quiz', 'choice', 'cloud', 'scale', 'wall', 'qa', 'rating', 'timer'].includes(body.kind) ? body.kind : 'quiz';
  const p = {
    topic: String(body.topic || '').trim().slice(0, 400),
    context: String(body.context || '').trim().slice(0, 12000),
    count: Math.max(1, Math.min(kind === 'quiz' ? 20 : 6, parseInt(body.count, 10) || (kind === 'quiz' ? 10 : 3))),
    level: String(body.level || 'medio'),
    seconds: Math.max(5, Math.min(120, parseInt(body.seconds, 10) || 15))
  };
  if (p.topic.length < 3 && p.context.length < 30) return error('Descreva o tema (ou cole um texto de apoio).');

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 6000, system: systemPrompt(), messages: [{ role: 'user', content: userPrompt(kind, p) }] })
    });
  } catch {
    return error('Não foi possível falar com a IA agora. Tente de novo.', 502);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || `erro ${res.status}`;
    console.error('anthropic_error', res.status, msg);
    if (res.status === 401) return error('A chave da Anthropic foi recusada. Confira a ANTHROPIC_API_KEY na Vercel.', 502);
    if (res.status === 429) return error('A IA está ocupada no momento. Tente de novo em alguns segundos.', 503);
    return error('A IA não conseguiu gerar agora. Tente de novo.', 502);
  }
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  let out;
  try {
    out = parseJson(text);
  } catch {
    return error('A IA respondeu num formato inesperado. Tente de novo.', 502);
  }

  if (kind === 'quiz') {
    const raw = (out.questions || []).map((q) => ({ ...q, seconds: p.seconds }));
    const cfg = cleanConfig('quiz', { questions: raw });
    const questions = cfg.questions.filter((q) => q.text && q.options.length >= 2);
    if (!questions.length) return error('A IA não gerou perguntas válidas. Tente detalhar o tema.', 502);
    return json({ ok: true, questions });
  }
  if (kind === 'choice') {
    const polls = (out.polls || []).map((x) => cleanConfig('choice', { question: x.question, options: x.options })).filter((x) => x.question && x.options.length >= 2);
    return json({ ok: true, polls });
  }
  if (['scale', 'wall', 'qa', 'rating', 'timer'].includes(kind)) {
    const items = (out.items || []).map((x) => cleanConfig(kind, x || {})).filter((x) => (x.question || x.label || '').trim());
    if (!items.length) return error('A IA não gerou sugestões válidas. Tente detalhar o tema.', 502);
    return json({ ok: true, items });
  }
  const questions = (out.questions || []).map((q) => String(q).slice(0, 140)).filter(Boolean);
  return json({ ok: true, questions });
}
