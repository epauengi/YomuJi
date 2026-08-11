'use client';

import React from 'react';

interface FuriganaProps {
  kanji: string;
  reading: string;
  className?: string;
}

export function Furigana({ kanji, reading, className = '' }: FuriganaProps) {
  // If there's no reading, just show the kanji
  if (!reading) {
    return <span className={`jp-text ${className}`}>{kanji}</span>;
  }

  return (
    <ruby className={`jp-ruby jp-text furigana-reveal ${className}`}>
      {kanji}
      <rt>{reading}</rt>
    </ruby>
  );
}
