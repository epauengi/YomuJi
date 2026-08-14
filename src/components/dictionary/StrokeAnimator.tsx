'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ArrowCounterClockwise,
  Eye,
  EyeSlash,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Spinner,
} from '@phosphor-icons/react';
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
  const [isLoadingSvg, setIsLoadingSvg] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [currentStroke, setCurrentStroke] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showNumbers, setShowNumbers] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);

  // Determine active stroke paths to render
  const activeStrokePaths = useMemo(() => {
    return initialStrokePaths.length > 0 ? initialStrokePaths : fetchedPaths;
  }, [initialStrokePaths, fetchedPaths]);

  const totalStrokes = activeStrokePaths.length || initialStrokeCount || 0;

  // Helper: Parse raw SVG XML string into StrokePath[] and StrokeNumber[]
  const parseSvgString = (svgText: string) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(svgText, 'image/svg+xml');

      const pathElements = Array.from(xmlDoc.querySelectorAll('path'));
      const paths: StrokePath[] = pathElements
        .filter((p) => {
          const d = p.getAttribute('d');
          const style = p.getAttribute('style');
          return d && d.trim().length > 0 && !style?.includes('stroke:#ddd');
        })
        .map((p, idx) => ({
          id: idx + 1,
          d: p.getAttribute('d') || '',
        }));

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
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    } catch (err) {
      console.error('Error parsing SVG text:', err);
      setLoadError(true);
    }
  };

  // Reset state when literal changes
  useEffect(() => {
    setCurrentStroke(0);
    setIsPlaying(false);
    setHasInteracted(false);
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
    const fallbackUrl = `https://raw.githubusercontent.com/kanjivg/kanjivg/master/kanji/${hex}.svg`;

    fetch(localUrl)
      .then((res) => {
        if (!res.ok) return fetch(cdnUrl);
        return res;
      })
      .then((res) => {
        if (!res.ok) return fetch(fallbackUrl);
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
  }, [literal, initialStrokePaths, strokeSvgRaw]);

  // Animation Timer Loop
  const delayMs = Math.round(600 / speedMultiplier);

  useEffect(() => {
    if (!isPlaying || !totalStrokes) return;

    const timer = window.setInterval(() => {
      setCurrentStroke((val) => {
        if (val >= totalStrokes) {
          setIsPlaying(false);
          return totalStrokes;
        }
        return val + 1;
      });
    }, delayMs);

    return () => window.clearInterval(timer);
  }, [isPlaying, totalStrokes, delayMs]);

  // Controls Handlers
  const handleReset = () => {
    setHasInteracted(true);
    setCurrentStroke(0);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    setIsPlaying(false);
    if (!hasInteracted) {
      setHasInteracted(true);
      setCurrentStroke(Math.max(0, totalStrokes - 1));
    } else {
      setCurrentStroke((v) => Math.max(0, v - 1));
    }
  };

  const handleNext = () => {
    setIsPlaying(false);
    if (!hasInteracted) {
      setHasInteracted(true);
      setCurrentStroke(1);
    } else {
      setCurrentStroke((v) => Math.min(totalStrokes, v + 1));
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (currentStroke >= totalStrokes || !hasInteracted) {
        setCurrentStroke(0);
      }
      setHasInteracted(true);
      setIsPlaying(true);
    }
  };

  const toggleSpeed = () => {
    setSpeedMultiplier((prev) => {
      if (prev === 1) return 1.5;
      if (prev === 1.5) return 2;
      if (prev === 2) return 0.5;
      return 1;
    });
  };

  const displayStrokeCount = !hasInteracted && currentStroke === 0 ? totalStrokes : currentStroke;

  return (
    <Card padding="sm" className={`study-card border-[var(--color-border)] bg-[var(--color-surface)] ${className}`}>
      {/* Controls Header */}
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
          {displayStrokeCount} / {totalStrokes} nét
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
            aria-label="Vẽ lại từ đầu"
            onClick={handleReset}
            title="Vẽ lại từ đầu"
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
          /* Kanji stroke path animation */
          <svg viewBox="0 0 109 109" className="absolute inset-0 h-full w-full p-4" aria-label={`Thứ tự nét chữ ${literal}`}>
            {activeStrokePaths.map((stroke, index) => {
              const isDrawn = !hasInteracted && currentStroke === 0 ? true : index < currentStroke;
              const isCurrent = hasInteracted && currentStroke > 0 && index === currentStroke - 1;
              
              const strokeColor = isCurrent
                ? 'var(--color-stroke-active, #0D9488)'
                : isDrawn
                ? 'var(--color-primary-800, #1b4d4f)'
                : 'var(--color-stroke-guide, rgba(0,0,0,0.1))';

              const strokeWidth = isCurrent ? 4.2 : isDrawn ? 3.8 : 2.5;

              return (
                <motion.path
                  key={stroke.id || index}
                  d={stroke.d}
                  fill="none"
                  stroke={strokeColor}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={strokeWidth}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: isDrawn ? 1 : 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                />
              );
            })}

            {/* Stroke Numbers Overlay */}
            {showNumbers &&
              strokeNumbers.map((sn) => {
                const isVisible = !hasInteracted && currentStroke === 0 ? true : sn.num <= currentStroke;
                const isCurrentNum = hasInteracted && currentStroke > 0 && sn.num === currentStroke;

                return (
                  <text
                    key={`num-${sn.num}`}
                    x={sn.x}
                    y={sn.y}
                    fontSize="7"
                    fontWeight={isCurrentNum ? 'bold' : 'normal'}
                    fill={
                      isCurrentNum
                        ? 'var(--color-stroke-active, #0D9488)'
                        : isVisible
                        ? 'var(--color-primary-700, #047857)'
                        : 'var(--color-text-muted)'
                    }
                    opacity={isVisible ? (isCurrentNum ? 1 : 0.8) : 0.2}
                    style={{ userSelect: 'none', transition: 'all 0.2s ease' }}
                  >
                    {sn.num}
                  </text>
                );
              })}
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

      {/* Animation Playback Bar */}
      {totalStrokes > 0 && (
        <div className="mt-3 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              aria-label="Nét trước"
              onClick={handlePrev}
              disabled={hasInteracted && currentStroke === 0}
              title="Nét trước"
            >
              <SkipBack size={15} />
            </Button>
            <Button
              variant="primary"
              size="sm"
              aria-label={isPlaying ? 'Tạm dừng' : 'Phát nét'}
              onClick={handlePlayPause}
              className="px-3"
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              <span className="ml-1 text-xs">{isPlaying ? 'Tạm dừng' : 'Phát nét'}</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              aria-label="Nét tiếp"
              onClick={handleNext}
              disabled={hasInteracted && currentStroke >= totalStrokes}
              title="Nét tiếp"
            >
              <SkipForward size={15} />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            aria-label="Tốc độ phát"
            onClick={toggleSpeed}
            className="text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-primary-700)]"
            title="Đổi tốc độ phát (0.5x, 1x, 1.5x, 2x)"
          >
            {speedMultiplier}x
          </Button>
        </div>
      )}
    </Card>
  );
}
