import type { Metadata } from 'next';
import '../index.css';

export const metadata: Metadata = {
  title: 'Triumph Insurance Agency',
  description: 'Clear advice. Dependable protection.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
