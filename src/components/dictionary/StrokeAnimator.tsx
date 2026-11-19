'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowCounterClockwise,
  CaretLeft,
  CaretRight,
  Eye,
  EyeSlash,
  Pause,
  Play,
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

const EMPTY_STROKE_PATHS: StrokePath[] = [];

export function StrokeAnimator({
  literal,
  strokePaths: initialStrokePaths = EMPTY_STROKE_PATHS,
  strokeSvgRaw,
  strokeCount: initialStrokeCount,
  className = '',
}: StrokeAnimatorProps) {
  const [fetchedPaths, setFetchedPaths] = useState<StrokePath[]>([]);
  const [fetchedLiteral, setFetchedLiteral] = useState('');
  const [strokeNumbers, setStrokeNumbers] = useState<StrokeNumber[]>([]);
  const [svgViewBox, setSvgViewBox] = useState('0 0 109 109');
  const [isFillFormat, setIsFillFormat] = useState(false);
  const [isLoadingSvg, setIsLoadingSvg] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeStrokeIndex, setActiveStrokeIndex] = useState(0);
  const [playbackState, setPlaybackState] = useState<'idle' | 'playing' | 'paused' | 'finished'>('idle');
  const [showGuides, setShowGuides] = useState(true);
  const reduceMotion = useReducedMotion();

  const activeStrokePaths = useMemo(
    () => (initialStrokePaths.length > 0 ? initialStrokePaths : fetchedLiteral === literal ? fetchedPaths : []),
    [fetchedLiteral, fetchedPaths, initialStrokePaths, literal],
  );
  const pathCount = activeStrokePaths.length;
  const totalStrokes = pathCount || initialStrokeCount || 0;
  const isPlaying = playbackState === 'playing';

  const parseSvgString = (svgText: string) => {
    try {
      const xmlDoc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
      if (xmlDoc.querySelector('parsererror')) throw new Error('Invalid stroke SVG');

      const svgEl = xmlDoc.querySelector('svg');
      const viewBox = svgEl?.getAttribute('viewBox') || '0 0 109 109';
      const isAnimCJK = viewBox.includes('1024') || svgText.includes('acjk');
      let pathElements: Element[];

      if (isAnimCJK) {
        pathElements = Array.from(xmlDoc.querySelectorAll('path[id]')).filter((path) =>
          /d\d+$/i.test(path.getAttribute('id') || ''),
        );
      } else {
        const kanjiVgPaths = Array.from(xmlDoc.querySelectorAll('g[id*="StrokePaths"] path, path[id*="kvg:"]'));
        pathElements = kanjiVgPaths.length > 0 ? kanjiVgPaths : Array.from(xmlDoc.querySelectorAll('path'));
      }

      const paths = pathElements
        .filter((path) => {
          const d = path.getAttribute('d') || '';
          const style = path.getAttribute('style') || '';
          return d.trim().length > 0 && !style.includes('--d:') && !style.includes('stroke:#ddd');
        })
        .map((path, index) => ({ id: index + 1, d: path.getAttribute('d') || '' }));

      const numbers = Array.from(xmlDoc.querySelectorAll('text')).map((text, index) => {
        const transform = text.getAttribute('transform') || '';
        const matrix = transform.match(
          /matrix\s*\(\s*[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+([\d.-]+)\s+([\d.-]+)\s*\)/i,
        );
        const x = Number.parseFloat(matrix?.[1] || text.getAttribute('x') || '0') || 0;
        const y = Number.parseFloat(matrix?.[2] || text.getAttribute('y') || '0') || 0;
        return { num: Number.parseInt(text.textContent || `${index + 1}`, 10) || index + 1, x, y };
      });

      if (paths.length === 0) throw new Error('No stroke paths found');
      setFetchedPaths(paths);
      setFetchedLiteral(literal);
      setStrokeNumbers(numbers);
      setSvgViewBox(viewBox);
      setIsFillFormat(isAnimCJK);
      setLoadError(false);
    } catch (error) {
      console.error('Error parsing SVG text:', error);
      setFetchedPaths([]);
      setStrokeNumbers([]);
      setLoadError(true);
    }
  };

  useEffect(() => {
    setFetchedPaths([]);
    setFetchedLiteral('');
    setStrokeNumbers([]);
    setSvgViewBox('0 0 109 109');
    setIsFillFormat(false);
    setLoadError(false);
    setActiveStrokeIndex(0);
    setPlaybackState('idle');

    if (!literal || initialStrokePaths.length > 0) {
      setIsLoadingSvg(false);
      return;
    }

    if (strokeSvgRaw) {
      parseSvgString(strokeSvgRaw);
      setIsLoadingSvg(false);
      return;
    }

    const codePoint = literal.codePointAt(0);
    if (!codePoint) {
      setIsLoadingSvg(false);
      return;
    }

    const controller = new AbortController();
    const hex = codePoint.toString(16).padStart(5, '0').toLowerCase();
    const sources = [
      `/dict/strokes/${hex}.svg`,
      `https://cdn.jsdelivr.net/gh/kanjivg/kanjivg/kanji/${hex}.svg`,
      `https://raw.githubusercontent.com/kanjivg/kanjivg/master/kanji/${hex}.svg`,
    ];

    setIsLoadingSvg(true);
    const loadFrom = async (index: number): Promise<string> => {
      try {
        const response = await fetch(sources[index], { cache: 'force-cache', signal: controller.signal });
        if (response.ok) return response.text();
      } catch {
        if (controller.signal.aborted) throw new Error('Stroke SVG request aborted');
      }
      if (index === sources.length - 1) throw new Error('Stroke SVG not found');
      return loadFrom(index + 1);
    };

    loadFrom(0)
      .then((svgText) => {
        if (!controller.signal.aborted) parseSvgString(svgText);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadError(true);
          setIsLoadingSvg(false);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingSvg(false);
      });

    return () => {
      controller.abort();
      setFetchedPaths([]);
      setFetchedLiteral('');
      setStrokeNumbers([]);
    };
  }, [literal, initialStrokePaths, reloadKey, strokeSvgRaw]);

  useEffect(() => {
    if (!isPlaying || !pathCount || reduceMotion) return;

    const timer = window.setTimeout(() => {
      if (activeStrokeIndex >= pathCount - 1) setPlaybackState('finished');
      else setActiveStrokeIndex((stroke) => stroke + 1);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [activeStrokeIndex, isPlaying, pathCount, reduceMotion]);

  const startPlayback = () => {
    if (!pathCount) return;
    if (reduceMotion) {
      if (playbackState === 'idle') {
        setActiveStrokeIndex(0);
        setPlaybackState('paused');
      } else if (activeStrokeIndex >= pathCount - 1) {
        setActiveStrokeIndex(0);
        setPlaybackState('paused');
      } else {
        setActiveStrokeIndex((stroke) => stroke + 1);
      }
      return;
    }
    if (playbackState === 'idle' || playbackState === 'finished') {
      setActiveStrokeIndex(0);
      setPlaybackState('playing');
      return;
    }
    setPlaybackState(playbackState === 'playing' ? 'paused' : 'playing');
  };

  const step = (direction: -1 | 1) => {
    if (!pathCount) return;
    const index = playbackState === 'idle' && direction === 1
      ? 0
      : Math.max(0, Math.min(pathCount - 1, activeStrokeIndex + direction));
    setActiveStrokeIndex(index);
    setPlaybackState('paused');
  };

  const replay = () => {
    if (!pathCount) {
      if (loadError) setReloadKey((key) => key + 1);
      return;
    }
    setActiveStrokeIndex(0);
    setPlaybackState(reduceMotion ? 'paused' : 'playing');
  };

  const playbackLabel = playbackState === 'idle'
    ? 'Xem cách viết'
    : playbackState === 'playing'
      ? 'Tạm dừng'
      : playbackState === 'finished'
        ? 'Vẽ lại từ đầu'
        : reduceMotion
          ? activeStrokeIndex >= pathCount - 1
            ? 'Xem lại từ đầu'
            : 'Tiếp tục từng nét'
          : 'Tiếp tục';

  return (
    <Card padding="sm" className={`study-card border-[var(--color-border)] bg-[var(--color-surface)] ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <span className="text-xs font-semibold tabular-nums text-[var(--color-text-secondary)]" aria-live="polite">
          {totalStrokes > 0
            ? playbackState === 'idle'
              ? `${totalStrokes} nét`
              : `Nét ${activeStrokeIndex + 1}/${totalStrokes}`
            : 'Cách viết nét'}
          {isPlaying ? ' · đang phát' : playbackState === 'paused' ? ' · đã dừng' : ''}
        </span>
        {isLoadingSvg && <span className="text-xs text-[var(--color-text-muted)]">Đang tải dữ liệu nét…</span>}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={startPlayback}
          disabled={!pathCount}
          className="min-h-11"
          title={playbackLabel}
        >
          {isPlaying && !reduceMotion ? <Pause aria-hidden="true" size={18} /> : <Play aria-hidden="true" size={18} />}
          {playbackLabel}
        </Button>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Nét trước"
            onClick={() => step(-1)}
            disabled={!pathCount || playbackState === 'idle' || activeStrokeIndex === 0}
            className="min-h-11 min-w-11 px-2"
            title="Nét trước"
          >
            <CaretLeft aria-hidden="true" size={18} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Nét tiếp theo"
            onClick={() => step(1)}
            disabled={!pathCount || playbackState !== 'idle' && activeStrokeIndex >= pathCount - 1}
            className="min-h-11 min-w-11 px-2"
            title="Nét tiếp theo"
          >
            <CaretRight aria-hidden="true" size={18} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={showGuides ? 'Ẩn hướng dẫn nét' : 'Hiện hướng dẫn nét'}
            aria-pressed={showGuides}
            onClick={() => setShowGuides((visible) => !visible)}
            className={`min-h-11 min-w-11 px-2 ${showGuides ? 'text-[var(--color-primary-700)]' : 'text-[var(--color-text-muted)]'}`}
            title={showGuides ? 'Ẩn hướng dẫn nét' : 'Hiện hướng dẫn nét'}
          >
            {showGuides ? <Eye aria-hidden="true" size={17} /> : <EyeSlash aria-hidden="true" size={17} />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={loadError ? 'Tải lại nét vẽ' : 'Phát lại'}
            onClick={replay}
            disabled={!pathCount && !loadError}
            className="min-h-11 min-w-11 px-2"
            title={loadError ? 'Tải lại nét vẽ' : 'Phát lại'}
          >
            <ArrowCounterClockwise aria-hidden="true" size={18} />
          </Button>
        </div>
      </div>

      <div className="relative aspect-square w-full overflow-hidden rounded-[--radius-md] border border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_srgb,var(--color-border)_35%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_srgb,var(--color-border)_35%,transparent)_1px,transparent_1px)] bg-[length:50%_50%]" />
        <div className="absolute left-1/2 top-0 h-full border-l border-dashed border-[var(--color-border-strong)] opacity-40" />
        <div className="absolute left-0 top-1/2 w-full border-t border-dashed border-[var(--color-border-strong)] opacity-40" />
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-20" viewBox="0 0 100 100" aria-hidden="true">
          <line x1="0" y1="0" x2="100" y2="100" stroke="var(--color-border-strong)" strokeDasharray="2,2" strokeWidth="0.5" />
          <line x1="100" y1="0" x2="0" y2="100" stroke="var(--color-border-strong)" strokeDasharray="2,2" strokeWidth="0.5" />
        </svg>

        {pathCount > 0 ? (
          <svg viewBox={svgViewBox} className="absolute inset-0 h-full w-full p-4" role="img" aria-label={`Thứ tự nét chữ ${literal}`}>
            {activeStrokePaths.map((stroke, index) => {
              const isIdle = playbackState === 'idle';
              const isDrawn = playbackState === 'finished' || index < activeStrokeIndex;
              const isCurrent = (playbackState === 'playing' || playbackState === 'paused') && index === activeStrokeIndex;

              if (isFillFormat) {
                return (
                  <motion.path
                    key={stroke.id || index}
                    d={stroke.d}
                    fill={isCurrent ? 'var(--color-stroke-active, #0D9488)' : 'var(--color-primary-800, #1b4d4f)'}
                    initial={false}
                    animate={{ opacity: isIdle || isDrawn || isCurrent ? 1 : showGuides ? 0.12 : 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.25, ease: 'easeInOut' }}
                  />
                );
              }

              return (
                <React.Fragment key={stroke.id || index}>
                  {showGuides && (
                    <path
                      d={stroke.d}
                      fill="none"
                      stroke="var(--color-stroke-guide, rgba(0,0,0,0.1))"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                    />
                  )}
                  <motion.path
                    d={stroke.d}
                    fill="none"
                    stroke={isCurrent ? 'var(--color-stroke-active, #0D9488)' : 'var(--color-primary-800, #1b4d4f)'}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={isCurrent ? 4.2 : 3.8}
                    initial={false}
                    animate={{ pathLength: isIdle || isDrawn || isCurrent ? 1 : 0 }}
                    transition={{ duration: isCurrent && playbackState === 'playing' && !reduceMotion ? 0.3 : 0, ease: 'easeInOut' }}
                  />
                </React.Fragment>
              );
            })}

            {showGuides &&
              strokeNumbers.map((number) => {
                const isCurrent = number.num === activeStrokeIndex + 1 && (playbackState === 'playing' || playbackState === 'paused');
                const isVisible = playbackState === 'idle' || playbackState === 'finished' || number.num <= activeStrokeIndex;
                return (
                  <text
                    key={`num-${number.num}`}
                    x={number.x}
                    y={number.y}
                    fontSize={isFillFormat ? 44 : 7}
                    fontWeight={isCurrent ? 'bold' : 'normal'}
                    fill={isCurrent ? 'var(--color-stroke-active, #0D9488)' : 'var(--color-primary-700, #047857)'}
                    opacity={isVisible ? 0.8 : 0.2}
                    style={{ userSelect: 'none' }}
                  >
                    {number.num}
                  </text>
                );
              })}
          </svg>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center" aria-live="polite">
            <span lang="ja" className="jp-text text-6xl font-bold text-[var(--color-primary-800)]">{literal}</span>
            <span className="mt-2 text-xs text-[var(--color-text-muted)]">
              {isLoadingSvg ? 'Đang tải nét vẽ…' : loadError ? 'Chưa tải được nét vẽ ký tự này' : 'Chưa có dữ liệu vẽ nét'}
            </span>
            {isLoadingSvg && <Spinner aria-hidden="true" size={22} className="mt-2 animate-spin text-[var(--color-primary-600)]" />}
          </div>
        )}
      </div>
    </Card>
  );
}
