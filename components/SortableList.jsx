'use client';

import { useRef, useState } from 'react';

// Lista que se reordena arrastando (mouse ou dedo), como cartões de um kanban.
// No mouse, arrasta pelo cartão inteiro; no toque, pela alça ⋮⋮ (para não travar a rolagem).
export default function SortableList({ items, selectedId, onSelect, onReorder, renderItem }) {
  const [order, setOrder] = useState(null); // ordem provisória enquanto arrasta
  const [drag, setDrag] = useState(null); // { id, dy }
  const st = useRef(null);
  const suppressClick = useRef(false);
  const live = useRef(null); // ordem mais recente (não depende do próximo render)
  const els = useRef({});
  const list = order || items;

  const begin = (e, item, fromHandle) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.pointerType === 'touch' && !fromHandle) return;
    const el = els.current[item.id];
    if (!el) return;
    const r = el.getBoundingClientRect();
    st.current = { id: item.id, x0: e.clientX, y0: e.clientY, grab: e.clientY - r.top, h: r.height, started: false, moved: false, pointerId: e.pointerId, el };
  };

  const move = (e) => {
    const s = st.current;
    if (!s || e.pointerId !== s.pointerId) return;
    if (!s.started) {
      if (Math.abs(e.clientY - s.y0) < 6 && Math.abs(e.clientX - s.x0) < 6) return;
      s.started = true;
      try { s.el.setPointerCapture(e.pointerId); } catch { /* ok */ }
      live.current = items.slice();
      setOrder(live.current);
    }
    e.preventDefault();
    const cur = live.current || items;
    // Centro "virtual" do cartão que está sendo arrastado.
    const center = e.clientY - s.grab + s.h / 2;
    const others = cur.filter((x) => x.id !== s.id);
    let target = 0;
    for (const o of others) {
      const oe = els.current[o.id];
      if (!oe) continue;
      const r = oe.getBoundingClientRect();
      if (r.top + r.height / 2 < center) target++;
    }
    const dragged = cur.find((x) => x.id === s.id);
    const next = [...others.slice(0, target), dragged, ...others.slice(target)];
    if (next.some((x, i) => x.id !== cur[i].id)) { live.current = next; setOrder(next); s.moved = true; }
    // Desloca o cartão para seguir o ponteiro (a partir da posição natural dele na lista).
    const parent = s.el.offsetParent;
    const naturalTop = (parent ? parent.getBoundingClientRect().top : 0) + s.el.offsetTop;
    setDrag({ id: s.id, dy: e.clientY - s.grab - naturalTop });
    if (e.clientY < 70) window.scrollBy(0, -14);
    else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
  };

  const end = (e) => {
    const s = st.current;
    if (!s || (e && e.pointerId !== s.pointerId)) return;
    st.current = null;
    if (!s.started) return;
    const final = live.current;
    live.current = null;
    setDrag(null);
    setOrder(null);
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 0);
    if (final && final.some((x, i) => x.id !== items[i].id)) onReorder(final);
  };

  const click = (item) => {
    if (drag || suppressClick.current) { suppressClick.current = false; return; }
    onSelect(item);
  };

  return (
    <div className="sortable" style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
      {list.map((a, i) => {
        const isDrag = drag && drag.id === a.id;
        return (
          <div
            key={a.id}
            ref={(el) => { if (el) els.current[a.id] = el; else delete els.current[a.id]; }}
            className={'act-item sortable-item' + (a.id === selectedId ? ' on' : '') + (isDrag ? ' dragging' : '')}
            style={isDrag ? { transform: `translateY(${drag.dy}px)`, zIndex: 5, position: 'relative' } : undefined}
            role="button"
            tabIndex={0}
            onPointerDown={(e) => begin(e, a, false)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onClick={() => click(a)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(a); }
              if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                e.preventDefault();
                const j = i + (e.key === 'ArrowUp' ? -1 : 1);
                if (j < 0 || j >= items.length) return;
                const next = items.slice();
                [next[i], next[j]] = [next[j], next[i]];
                onReorder(next);
              }
            }}
            aria-label={`${i + 1}. ${a.title}. Arraste para mudar a ordem (ou Alt + setas).`}
          >
            {renderItem(a, i)}
            <span
              className="drag-handle"
              aria-hidden="true"
              onPointerDown={(e) => { e.stopPropagation(); begin(e, a, true); }}
              title="Arraste para mudar a ordem"
            >
              <svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor"><circle cx="4" cy="4" r="1.8" /><circle cx="10" cy="4" r="1.8" /><circle cx="4" cy="10" r="1.8" /><circle cx="10" cy="10" r="1.8" /><circle cx="4" cy="16" r="1.8" /><circle cx="10" cy="16" r="1.8" /></svg>
            </span>
          </div>
        );
      })}
    </div>
  );
}
