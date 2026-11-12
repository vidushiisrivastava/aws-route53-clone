'use client';

import React, { useEffect, useState } from 'react';

/**
 * Delays mounting Cloudscape UI trees until after client hydration so
 * Cloudscape's runtime random performance-mark IDs and viewport hooks
 * never mismatch Next.js server-rendered HTML attributes.
 */
export default function ClientShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div style={{ minHeight: '100vh', backgroundColor: '#0f141a' }} />;
  }

  return <>{children}</>;
}
