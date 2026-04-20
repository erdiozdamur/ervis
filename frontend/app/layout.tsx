import type { Metadata, Viewport } from 'next';
import { Fraunces, Manrope } from 'next/font/google';
import './globals.css';
import { APP_DESCRIPTION, APP_NAME } from '@/lib/config/app';

const sans = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#0f766e',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="h-full">
      <body className={`${sans.variable} ${display.variable} min-h-full bg-app text-slate-950 antialiased`}>
        {children}
      </body>
    </html>
  );
}
