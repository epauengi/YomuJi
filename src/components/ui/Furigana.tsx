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
    return <span lang="ja" className={`jp-text ${className}`}>{kanji}</span>;
  }

  return (
    <ruby lang="ja" className={`jp-ruby jp-text ${className}`}>
      {kanji}
      <rt>{reading}</rt>
    </ruby>
  );
}
