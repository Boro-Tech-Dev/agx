import type React from 'react';

import './landing.css';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="landing-root">{children}</div>;
}
