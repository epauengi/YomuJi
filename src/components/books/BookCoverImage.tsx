'use client';

import { useCallback, useState, type ReactNode } from 'react';

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
  const [status, setStatus] = useState<{ src: string; state: 'loaded' | 'failed' } | null>(null);

  const isLoaded = Boolean(src && status?.src === src && status.state === 'loaded');
  const isFailed = Boolean(src && status?.src === src && status.state === 'failed');

  const handleRef = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img || !src || !img.complete) return;
      const next = img.naturalWidth > 0 ? 'loaded' : 'failed';
      setStatus((prev) => (prev?.src === src && prev.state === next ? prev : { src, state: next }));
    },
    [src],
  );

  return (
    <>
      {!isLoaded && children}
      {src && !isFailed && (
        <img
          ref={handleRef}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          aria-hidden={!isLoaded}
          className={`${className} transition-opacity duration-200 ${isLoaded ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          onLoad={(event) => {
            const ok = event.currentTarget.naturalWidth > 0;
            setStatus({ src, state: ok ? 'loaded' : 'failed' });
          }}
          onError={() => setStatus({ src, state: 'failed' })}
        />
      )}
    </>
  );
}
