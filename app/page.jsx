'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Página inicial: o participante sem câmera digita o PIN aqui.
export default function Home() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [back, setBack] = useState(null);

  // Quem fechou a aba no meio do evento volta com um toque, sem ler o QR de novo.
  useEffect(() => {
    let last = null;
    try { last = window.localStorage.getItem('rg:last'); if (last && !window.localStorage.getItem(`rg:${last}:token`)) last = null; } catch { /* ok */ }
    if (!last) return;
    fetch(`/api/live/${last}`).then((r) => r.json()).then((d) => {
      if (d && d.ok && d.event && d.event.status !== 'ended') setBack({ pin: last, title: d.event.title });
    }).catch(() => {});
  }, []);
  const go = (e) => {
    e.preventDefault();
    const p = pin.replace(/\D/g, '');
    if (p.length === 6) router.push(`/p/${p}`);
  };
  return (
    <main className="phone">
      <div className="phone-body" style={{ justifyContent: 'center', gap: 22 }}>
        <img src="/rg-academy-logo.png" alt="RG Academy — Educação Corporativa" style={{ width: 240, height: 'auto', alignSelf: 'center' }} />
        {back ? (
          <Link href={`/p/${back.pin}`} className="card stack" style={{ gap: 6, textDecoration: 'none', color: 'inherit', borderColor: 'var(--green)', background: 'var(--green-soft)' }}>
            <span className="eyebrow">Você estava participando</span>
            <strong style={{ fontSize: 20 }}>{back.title}</strong>
            <span className="btn btn-primary btn-block" style={{ marginTop: 6 }}>Voltar ao evento →</span>
          </Link>
        ) : null}
        <h1 style={{ fontSize: 30, fontWeight: 800, textAlign: 'center' }}>Participe ao vivo</h1>
        <p className="muted" style={{ textAlign: 'center', fontSize: 17 }}>Aponte a câmera para o QR code do telão ou digite o PIN do evento.</p>
        <form onSubmit={go} className="stack" style={{ gap: 12 }}>
          <label htmlFor="pin" className="label">PIN do evento</label>
          <input id="pin" className="input" inputMode="numeric" autoComplete="off" maxLength={7} placeholder="000000" value={pin} onChange={(e) => setPin(e.target.value)} style={{ fontSize: 30, textAlign: 'center', letterSpacing: '.3em', fontWeight: 800, padding: 16 }} />
          <button className="btn btn-primary btn-lg btn-block" disabled={pin.replace(/\D/g, '').length !== 6}>Entrar</button>
        </form>
      </div>
      <div className="phone-foot" style={{ textAlign: 'center' }}>
        <Link href="/login" style={{ fontSize: 15 }}>Sou palestrante · entrar no painel</Link>
      </div>
    </main>
  );
}
