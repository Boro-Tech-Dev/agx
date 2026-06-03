import type React from 'react';

import './globals.css';

export const metadata = {
  title: 'RagTag',
  description: 'PM Operator Grid — chaos in, clarity out.',
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className="bg-app-canvas font-sans text-app-text antialiased">{children}</body>
    </html>
  );
}
