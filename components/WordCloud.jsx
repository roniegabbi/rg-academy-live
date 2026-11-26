'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const DARK = ['#7FD35F', '#FFFFFF', '#A9D8FF', '#45B02B', '#C9D6E2', '#E8F5E1', '#6FB7FF'];
const LIGHT = ['#2E7D1E', '#0B2238', '#2F5B82', '#45B02B', '#4A5D70', '#1F5A14', '#3D6E99'];

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Encaixe em espiral: a mais citada no centro, as outras se acomodam nos espaços livres ao redor.
function layoutCloud(words, family, aspect) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const list = words.slice(0, 70);
  const max = list[0].count;
  const min = list[list.length - 1].count;
  const MAXF = 130;
  const MINF = 24;
  const placed = [];
  const boxes = [];
  list.forEach((w, i) => {
    const r = max === min ? 1 : (w.count - min) / (max - min);
    const size = Math.round(MINF + (MAXF - MINF) * Math.pow(r, 0.75) * (i === 0 ? 1 : 0.92));
    const weight = r > 0.55 ? 800 : r > 0.25 ? 700 : r > 0.1 ? 600 : 500;
    ctx.font = `${weight} ${size}px ${family}`;
    const width = ctx.measureText(w.text).width;
    const height = size * 0.92;
    const pad = Math.max(3, size * 0.07);
    const h = hash(w.text);
    let x = -width / 2;
    let y = -height / 2;
    if (i > 0) {
      const start = (h % 628) / 100;
      const dir = h % 2 ? 1 : -1;
      let found = false;
      for (let t = 0; t < 1400; t += 0.12) {
        const rad = 3.2 * t;
        const cx = rad * Math.cos(start + dir * t) * aspect;
        const cy = rad * Math.sin(start + dir * t);
        x = cx - width / 2;
        y = cy - height / 2;
        let hit = false;
        for (let k = 0; k < boxes.length; k++) {
          const b = boxes[k];
          if (x < b.x + b.w + pad && x + width + pad > b.x && y < b.y + b.h + pad && y + height + pad > b.y) { hit = true; break; }
        }
        if (!hit) { found = true; break; }
      }
      if (!found) return;
    }
    boxes.push({ x, y, w: width, h: height });
    placed.push({ ...w, x, y, width, height, size, weight, colorIndex: i === 0 ? 0 : (h % 7) });
  });
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  placed.forEach((p) => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x + p.width); maxY = Math.max(maxY, p.y + p.height); });
  return { placed, bounds: { minX, minY, w: maxX - minX, h: maxY - minY } };
}

export default function WordCloud({ words = [], light = false, empty = 'Aguardando as primeiras palavras do público…' }) {
  const ref = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0, family: 'sans-serif', ready: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      setBox((b) => ({ ...b, w: el.offsetWidth, h: el.offsetHeight, family: getComputedStyle(el).fontFamily || 'sans-serif' }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setBox((b) => ({ ...b, ready: true })));
    return () => ro.disconnect();
  }, []);

  const key = words.slice(0, 70).map((w) => w.text + ':' + w.count).join('|');
  const result = useMemo(() => {
    if (!words.length || !box.w || !box.h) return null;
    return layoutCloud(words, box.family, Math.max(1, Math.min(2.4, box.w / box.h)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, box.w, box.h, box.family, box.ready]);

  const palette = light ? LIGHT : DARK;
  let scale = 1;
  let offX = 0;
  let offY = 0;
  if (result && result.placed.length) {
    const { bounds } = result;
    scale = Math.min((box.w * 0.94) / bounds.w, (box.h * 0.9) / bounds.h, 1.6);
    offX = box.w / 2 - (bounds.minX + bounds.w / 2) * scale;
    offY = box.h / 2 - (bounds.minY + bounds.h / 2) * scale;
  }

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, width: '100%', minHeight: 240, overflow: 'hidden' }}>
      {!words.length ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: light ? '#4A5D70' : '#9FB3C6' }}>{empty}</div>
      ) : null}
      {result ? result.placed.map((p) => (
        <span
          key={p.text}
          title={`${p.text}: ${p.count}`}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transform: `translate(${offX + p.x * scale}px, ${offY + p.y * scale}px)`,
            fontSize: p.size * scale,
            lineHeight: 0.92,
            fontWeight: p.weight,
            color: palette[p.colorIndex % palette.length],
            whiteSpace: 'nowrap',
            transition: 'transform .8s cubic-bezier(.2,.8,.2,1), font-size .8s cubic-bezier(.2,.8,.2,1)',
            willChange: 'transform'
          }}
        >{p.text}</span>
      )) : null}
    </div>
  );
}
