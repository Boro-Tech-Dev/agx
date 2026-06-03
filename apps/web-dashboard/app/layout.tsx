import type React from 'react';

export const metadata = {
  title: 'RagTag',
  description: 'PM Operator Grid — chaos in, clarity out.',
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
