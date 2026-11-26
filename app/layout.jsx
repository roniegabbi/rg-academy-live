import { Outfit } from 'next/font/google';
import './globals.css';

const outfit = Outfit({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800', '900'], variable: '--font-outfit', display: 'swap' });

export const metadata = {
  title: 'RG Academy Live',
  description: 'Interação ao vivo entre palestrante e público — RG Academy Educação Corporativa'
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B2238'
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={outfit.variable}>
      <body>{children}</body>
    </html>
  );
}
