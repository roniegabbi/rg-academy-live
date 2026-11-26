'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from './client';

// Barra do painel do palestrante; também protege as páginas (redireciona ao login).
export default function Topbar({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  useEffect(() => {
    api('/api/auth/me').then((r) => {
      if (r.ok) setUser(r.user);
      else router.replace('/login');
    });
  }, [router]);
  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  };
  return (
    <header className="topbar no-print">
      <Link href="/painel" aria-label="Meus eventos"><img src="/rg-academy-logo.png" alt="RG Academy" className="logo" /></Link>
      <span className="tag">Live</span>
      {children}
      <div className="spacer" />
      {user ? <span className="muted" style={{ fontSize: 14 }}>{user.name}</span> : null}
      <button className="btn btn-sm" onClick={logout}>Sair</button>
    </header>
  );
}
