'use client';

import { useEffect } from 'react';

// Registers the minimal service worker at /sw.js. Without a registered SW,
// browsers won't offer the "Add to Home Screen" install prompt. We only do
// this in production to avoid dev-mode cache confusion.
export function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Silent — registration failure shouldn't break the app. The site still
      // works as a regular web page; just no install prompt.
    });
  }, []);
  return null;
}
