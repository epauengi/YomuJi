'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowCounterClockwise, Eye, EyeSlash, Spinner } from '@phosphor-icons/react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { StrokePath } from '@/types/dictionary';

interface StrokeNumber {
  num: number;
  x: number;
  y: number;
}

interface StrokeAnimatorProps {
  literal: string;
  strokePaths?: StrokePath[];
  strokeSvgRaw?: string;
  strokeCount?: number;
  className?: string;
}

export function StrokeAnimator({
  literal,
  strokePaths: initialStrokePaths = [],
  strokeSvgRaw,
  strokeCount: initialStrokeCount,
  className = '',
}: StrokeAnimatorProps) {
  const [fetchedPaths, setFetchedPaths] = useState<StrokePath[]>([]);
  const [strokeNumbers, setStrokeNumbers] = useState<StrokeNumber[]>([]);
  const [svgViewBox, setSvgViewBox] = useState<string>('0 0 109 109');
  const [isFillFormat, setIsFillFormat] = useState<boolean>(false);

  const [isLoadingSvg, setIsLoadingSvg] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [showNumbers, setShowNumbers] = useState(true);

  // Determine active stroke paths to render
  const activeStrokePaths = useMemo(() => {
    return initialStrokePaths.length > 0 ? initialStrokePaths : fetchedPaths;
  }, [initialStrokePaths, fetchedPaths]);

  const totalStrokes = activeStrokePaths.length || initialStrokeCount || 0;

  // Universal Helper: Parse raw SVG XML string (KanjiVG or AnimCJK format)
  const parseSvgString = (svgText: string) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(svgText, 'image/svg+xml');
      const svgEl = xmlDoc.querySelector('svg');
      const viewBox = svgEl?.getAttribute('viewBox') || '0 0 109 109';
      const isAnimCJK = viewBox.includes('1024') || svgText.includes('acjk');

      let pathElements: Element[] = [];
      if (isAnimCJK) {
        // AnimCJK format: stroke shapes have id matching /d\d+$/ e.g. z24859d1
        const animPaths = Array.from(xmlDoc.querySelectorAll('path[id]')).filter((p) => {
          const id = p.getAttribute('id') || '';
          return /d\d+$/i.test(id);
        });
        pathElements = animPaths.length > 0 ? animPaths : Array.from(xmlDoc.querySelectorAll('svg > path'));
      } else {
        // KanjiVG format: stroke lines
        const kvgPaths = Array.from(xmlDoc.querySelectorAll('g[id*="StrokePaths"] path, path[id*="kvg:"]'));
        pathElements = kvgPaths.length > 0 ? kvgPaths : Array.from(xmlDoc.querySelectorAll('path'));
      }

      const paths: StrokePath[] = pathElements
        .filter((p) => {
          const d = p.getAttribute('d');
          const style = p.getAttribute('style') || '';
          const clipPath = p.getAttribute('clip-path') || '';
          return d && d.trim().length > 0 && !clipPath && !style.includes('--d:') && !style.includes('stroke:#ddd');
        })
        .map((p, idx) => ({
          id: idx + 1,
          d: p.getAttribute('d') || '',
        }));

      // Extract stroke order numbers
      const textElements = Array.from(xmlDoc.querySelectorAll('text'));
      const numbers: StrokeNumber[] = textElements.map((t, idx) => {
        const transform = t.getAttribute('transform') || '';
        const matrixMatch = transform.match(
          /matrix\s*\(\s*[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+([\d.-]+)\s+([\d.-]+)\s*\)/i
        );
        let x = matrixMatch ? parseFloat(matrixMatch[1]) : parseFloat(t.getAttribute('x') || '0');
        let y = matrixMatch ? parseFloat(matrixMatch[2]) : parseFloat(t.getAttribute('y') || '0');
        if (isNaN(x)) x = 0;
        if (isNaN(y)) y = 0;
        return {
          num: parseInt(t.textContent || `${idx + 1}`, 10) || idx + 1,
          x,
          y,
        };
      });

      if (paths.length > 0) {
        setFetchedPaths(paths);
        setStrokeNumbers(numbers);
        setSvgViewBox(viewBox);
        setIsFillFormat(isAnimCJK);
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    } catch (err) {
      console.error('Error parsing SVG text:', err);
      setLoadError(true);
    }
  };

  useEffect(() => {
    setLoadError(false);
  }, [literal]);

  // Fetch or parse stroke SVG when literal or props change
  useEffect(() => {
    if (!literal) return;

    if (initialStrokePaths.length > 0) {
      setFetchedPaths([]);
      setIsLoadingSvg(false);
      return;
    }

    if (strokeSvgRaw) {
      parseSvgString(strokeSvgRaw);
      setIsLoadingSvg(false);
      return;
    }

    let isMounted = true;
    setIsLoadingSvg(true);
    setLoadError(false);

    const codePoint = literal.codePointAt(0);
    if (!codePoint) {
      setIsLoadingSvg(false);
      return;
    }

    const hex = codePoint.toString(16).padStart(5, '0').toLowerCase();
    const localUrl = `/dict/strokes/${hex}.svg`;
    const cdnUrl = `https://cdn.jsdelivr.net/gh/kanjivg/kanjivg/kanji/${hex}.svg`;
    const fallbackCdnUrl = `https://raw.githubusercontent.com/kanjivg/kanjivg/master/kanji/${hex}.svg`;

    setFetchedPaths([]);
    setStrokeNumbers([]);

    // Bundled SVGs avoid remote CDN latency; use CDNs only when absent locally.
    fetch(localUrl, { cache: 'force-cache' })
      .then((res) => {
        if (!res.ok) return fetch(cdnUrl);
        return res;
      })
      .then((res) => {
        if (!res.ok) return fetch(fallbackCdnUrl);
        return res;
      })
      .then((res) => {
        if (!res.ok) throw new Error('Stroke SVG not found');
        return res.text();
      })
      .then((svgText) => {
        if (isMounted) {
          parseSvgString(svgText);
          setIsLoadingSvg(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoadError(true);
          setIsLoadingSvg(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [literal, initialStrokePaths, reloadKey, strokeSvgRaw]);


  return (
    <Card padding="sm" className={`study-card border-[var(--color-border)] bg-[var(--color-surface)] ${className}`}>
      {/* Controls Header */}
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
          {totalStrokes} nét
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label={showNumbers ? 'Ẩn số nét' : 'Hiện số nét'}
            onClick={() => setShowNumbers(!showNumbers)}
            className={showNumbers ? 'text-[var(--color-primary-700)]' : 'text-[var(--color-text-muted)]'}
            title={showNumbers ? 'Ẩn số nét' : 'Hiện số nét'}
          >
            {showNumbers ? <Eye size={17} /> : <EyeSlash size={17} />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Tải lại nét vẽ"
            onClick={() => setReloadKey((key) => key + 1)}
            title="Tải lại nét vẽ"
          >
            <ArrowCounterClockwise size={18} />
          </Button>
        </div>
      </div>

      {/* SVG Canvas Box */}
      <div className="relative aspect-square w-full overflow-hidden rounded-[--radius-md] border border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
        {/* Grid Guidelines (Mễ tự cách 米 & Diagonals) */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_srgb,var(--color-border)_35%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_srgb,var(--color-border)_35%,transparent)_1px,transparent_1px)] bg-[length:50%_50%]" />
        <div className="absolute left-1/2 top-0 h-full border-l border-dashed border-[var(--color-border-strong)] opacity-40" />
        <div className="absolute left-0 top-1/2 w-full border-t border-dashed border-[var(--color-border-strong)] opacity-40" />
        
        {/* Diagonal Guides */}
        <svg className="absolute inset-0 h-full w-full opacity-20 pointer-events-none" viewBox="0 0 100 100">
          <line x1="0" y1="0" x2="100" y2="100" stroke="var(--color-border-strong)" strokeDasharray="2,2" strokeWidth="0.5" />
          <line x1="100" y1="0" x2="0" y2="100" stroke="var(--color-border-strong)" strokeDasharray="2,2" strokeWidth="0.5" />
        </svg>

        {isLoadingSvg ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <Spinner size={28} className="animate-spin text-[var(--color-primary-600)]" />
            <span className="text-xs text-[var(--color-text-muted)]">Đang tải nét vẽ Kanji...</span>
          </div>
        ) : activeStrokePaths.length > 0 ? (
          /* Universal Kanji SVG Renderer (KanjiVG stroke lines or AnimCJK fill shapes) */
          <svg viewBox={svgViewBox} className="absolute inset-0 h-full w-full p-4" aria-label={`Thứ tự nét chữ ${literal}`}>
            {activeStrokePaths.map((stroke, index) =>
              isFillFormat ? (
                <path
                  key={stroke.id || index}
                  d={stroke.d}
                  fill="var(--color-primary-800, #1b4d4f)"
                />
              ) : (
                <path
                  key={stroke.id || index}
                  d={stroke.d}
                  fill="none"
                  stroke="var(--color-primary-800, #1b4d4f)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3.8}
                />
              )
            )}

            {/* Stroke Numbers Overlay */}
            {showNumbers &&
              strokeNumbers.map((sn) => (
                <text
                  key={`num-${sn.num}`}
                  x={sn.x}
                  y={sn.y}
                  fontSize={isFillFormat ? 44 : 7}
                  fill="var(--color-primary-700, #047857)"
                  opacity={0.8}
                  style={{ userSelect: 'none' }}
                >
                  {sn.num}
                </text>
              ))}
          </svg>
        ) : (
          /* Fallback static kanji display */
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
            <span className="jp-text text-6xl font-bold text-[var(--color-primary-800)] dark:text-[var(--color-primary-300)]">
              {literal}
            </span>
            <span className="mt-2 text-xs text-[var(--color-text-muted)]">
              {loadError ? 'Chưa tải được nét vẽ ký tự này' : 'Chưa có dữ liệu vẽ nét'}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
