'use client';

import { useState, type ReactNode } from 'react';

export default function BookCoverImage({
  src,
  alt,
  className,
  children,
}: {
  src?: string;
  alt: string;
  className: string;
  children: ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  return <>
    {src && !failed && <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" className={className} onError={() => setFailed(true)} />}
    {(!src || failed) && children}
  </>;
}
