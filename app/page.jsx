'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Página inicial: o participante sem câmera digita o PIN aqui.
export default function Home() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const go = (e) => {
    e.preventDefault();
    const p = pin.replace(/\D/g, '');
    if (p.length === 6) router.push(`/p/${p}`);
  };
  return (
    <main className="phone">
      <div className="phone-body" style={{ justifyContent: 'center', gap: 22 }}>
        <img src="/rg-academy-logo.png" alt="RG Academy — Educação Corporativa" style={{ width: 240, height: 'auto', alignSelf: 'center' }} />
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
