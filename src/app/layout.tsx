import type { Metadata } from 'next';
import ExperienceShell from '@/components/ExperienceShell';
import { site } from '@/data/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: 'DO U KNOW ME? · Vinay Jakkula', template: '%s · Vinay Jakkula' },
  description: "Explore Vinay Jakkula's universe: data engineering, personal curiosities, and Project Pandora — where ideas become experiments.",
  applicationName: 'douknowme',
  authors: [{ name: site.author }],
  openGraph: { title: 'DO U KNOW ME? · Vinay Jakkula', description: 'Engineer. Builder. Curious human. There is more than one answer.', type: 'website', url: site.url, siteName: 'douknowme' },
  twitter: { card: 'summary', title: 'DO U KNOW ME? · Vinay Jakkula', description: 'A personal universe of engineering, curiosity, and experiments.' },
  alternates: { canonical: '/' },
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body><ExperienceShell>{children}</ExperienceShell></body></html>;
}
