import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Salon Management System',
  description: 'Premium SaaS beauty salon management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
