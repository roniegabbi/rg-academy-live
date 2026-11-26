// Filtro básico de palavrões para o mapa de palavras (o telão é público).
// Compara sem acentos e sem diferenciar maiúsculas; bloqueia a palavra inteira ou o começo dela.
const BLOCK = [
  'porra', 'caralho', 'cacete', 'merda', 'bosta', 'foda', 'fodase', 'foder', 'fodido', 'puta', 'puto', 'putaria',
  'viado', 'veado', 'bicha', 'boiola', 'cuzao', 'cu', 'buceta', 'boceta', 'xoxota', 'piroca', 'pica', 'rola',
  'pau no cu', 'arrombado', 'arrombada', 'babaca', 'otario', 'otaria', 'idiota', 'imbecil', 'retardado', 'retardada',
  'vagabundo', 'vagabunda', 'vadia', 'piranha', 'corno', 'corna', 'escroto', 'escrota', 'desgracado', 'desgracada',
  'filho da puta', 'fdp', 'vsf', 'pqp', 'tnc', 'krl', 'crl', 'prr', 'nazista', 'hitler'
];

function fold(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const FOLDED = BLOCK.map(fold);

const BLOCK_EMOJI = ['\u{1F595}', '\u{1F346}', '\u{1F4A9}', '\u{1F51E}', '\u{1F52B}', '\u{1F4A3}'];

export function isBlocked(text) {
  if (BLOCK_EMOJI.some((e) => String(text || '').includes(e))) return true;
  const t = fold(text);
  if (!t) return false;
  const words = t.split(' ');
  const squeezed = t.replace(/ /g, '');
  return FOLDED.some((b) => {
    if (b.includes(' ')) return t.includes(b) || squeezed.includes(b.replace(/ /g, ''));
    return words.some((w) => w === b || (b.length >= 5 && w.startsWith(b))) || squeezed === b;
  });
}

export function foldWord(s) {
  return fold(s);
}
