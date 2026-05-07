import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';

import { MainShell } from '@/components/main-shell';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

export const metadata: Metadata = {
  title: {
    default: 'Vid Aider',
    template: '%s | Vid Aider',
  },
  description: 'Browser-based video helper for importing 3D files, spinning models, and recording showcase loops.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body>
        <MainShell>{children}</MainShell>
      </body>
    </html>
  );
}
