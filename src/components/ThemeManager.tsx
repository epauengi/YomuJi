'use client';

import { useEffect } from 'react';
import { subscribeToTheme } from '@/lib/browserState';

export function ThemeManager() {
  useEffect(() => subscribeToTheme(() => {}), []);

  return null;
}
