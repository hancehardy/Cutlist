import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cabinet Cutlist',
  description: 'Build cabinet cut lists, door and drawer lists, nests and shop packets.',
  icons: { icon: '/assets/logo-mark.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
