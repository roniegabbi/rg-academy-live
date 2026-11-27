'use client';

import { useEffect, useRef, useState } from 'react';

export async function api(url, opts = {}) {
  const init = { method: opts.method || 'GET', headers: {}, cache: 'no-store' };
  if (opts.body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }
  let res;
  try {
    res = await fetch(url, init);
  } catch {
    return { ok: false, error: 'Sem conexão. Tentando de novo…', network: true };
  }
  let data = {};
  try { data = await res.json(); } catch { /* sem corpo */ }
  if (!res.ok) return { ok: false, status: res.status, error: data.error || 'Algo deu errado.' };
  return data;
}

// Consulta periódica com reconexão automática (Wi-Fi do auditório cai muito).
export function usePoll(url, intervalMs, { bust = false } = {}) {
  const [data, setData] = useState(null);
  const [offline, setOffline] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const fails = useRef(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!url) return undefined;
    let stop = false;
    let timer;
    let inflight = false;
    const run = async () => {
      inflight = true;
      const u = bust ? `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}` : url;
      const r = await api(u);
      inflight = false;
      if (stop) return;
      if (r.ok) {
        fails.current = 0;
        setOffline(false);
        setNotFound(false);
        setData({ ...r, _recv: Date.now() });
      } else if (r.status === 404) {
        setNotFound(true);
      } else {
        fails.current += 1;
        if (fails.current >= 2) setOffline(true);
      }
      const wait = fails.current ? Math.min(8000, intervalMs * (1 + fails.current)) : intervalMs;
      timer = setTimeout(run, wait);
    };
    run();
    // Celular voltando do modo de espera (ou a rede voltando): atualiza na hora, sem esperar.
    const kick = () => {
      if (document.visibilityState !== 'visible' || inflight || stop) return;
      fails.current = 0;
      clearTimeout(timer);
      run();
    };
    document.addEventListener('visibilitychange', kick);
    window.addEventListener('online', kick);
    window.addEventListener('focus', kick);
    window.addEventListener('pageshow', kick);
    return () => {
      stop = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', kick);
      window.removeEventListener('online', kick);
      window.removeEventListener('focus', kick);
      window.removeEventListener('pageshow', kick);
    };
  }, [url, intervalMs, bust, tick]);

  const refresh = () => setTick((t) => t + 1);
  return { data, offline, notFound, refresh, setData };
}

export function useNow(ms = 250) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export const KIND_LABEL = { slide: 'Slide', cloud: 'Mapa de palavras', choice: 'Múltipla escolha', quiz: 'Quiz competitivo', qa: 'Perguntas ao palestrante', raffle: 'Sorteio' };
export const SLIDE_MODE_LABEL = { cover: 'Capa', qr: 'QR code', image: 'Imagem', youtube: 'Vídeo do YouTube', text: 'Texto' };

export function kindLabel(a) {
  if (!a) return '';
  if (a.kind === 'slide') {
    const mode = a.mode || (a.config && a.config.mode);
    return 'Slide · ' + (SLIDE_MODE_LABEL[mode] || 'Texto');
  }
  return KIND_LABEL[a.kind] || a.kind;
}

export function letters(i) {
  return 'ABCDEFGHIJ'[i] || String(i + 1);
}
