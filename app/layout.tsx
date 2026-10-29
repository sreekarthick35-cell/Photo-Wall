import type { Metadata, Viewport } from 'next';
import { Caveat, Chango, Space_Mono } from 'next/font/google';
import './globals.css';
import { EVENT_NAME } from '@/lib/config';

const script = Caveat({ subsets: ['latin'], variable: '--font-script', display: 'swap' });
const mono = Space_Mono({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-mono', display: 'swap' });
const display = Chango({ subsets: ['latin'], weight: '400', variable: '--font-display', display: 'swap' });

export const metadata: Metadata = {
  title: `${EVENT_NAME}`,
  description: 'Pin your photo to the shared wall.',
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#f4efe6',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${script.variable} ${mono.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
