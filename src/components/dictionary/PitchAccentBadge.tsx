'use client';

import { useState } from 'react';
import {
  classifyPitchAccent,
  getPitchPattern,
  normalizePitchAccents,
  splitMorae,
} from '@/lib/pitchAccent';

interface PitchAccentBadgeProps {
  reading: string;
  pitches?: number[];
  variant?: 'compact' | 'detail';
  className?: string;
}

function PitchContourSvg({
  morae,
  downstep,
  compact,
}: {
  morae: string[];
  downstep: number;
  compact: boolean;
}) {
  const pattern = getPitchPattern(morae.length, downstep);
  if (pattern.length === 0) return null;

  const hasDigraph = morae.some((m) => m.length > 1);
  const stepX = compact ? 9 : hasDigraph ? 26 : 22;
  const padX = compact ? 5 : 13;
  const yHigh = compact ? 3.5 : 8;
  const yLow = compact ? 10.5 : 22;
  const svgHeight = compact ? 14 : 46;
  const svgWidth = padX * 2 + (pattern.length - 1) * stepX;

  const points = pattern.map((level, index) => ({
    x: padX + index * stepX,
    y: level === 'H' ? yHigh : yLow,
    isParticle: index === morae.length,
    isNucleus: downstep > 0 && index === downstep - 1,
    mora: index < morae.length ? morae[index] : 'が',
  }));

  const wordPoints = points.slice(0, morae.length);
  const particlePoint = points[morae.length];
  const lastWordPoint = wordPoints[wordPoints.length - 1];
  const isDropToParticle = downstep > 0 && downstep === morae.length;

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="shrink-0 overflow-visible"
      aria-hidden="true"
    >
      {/* Segments between word morae */}
      {wordPoints.slice(0, -1).map((pt, i) => {
        const next = wordPoints[i + 1];
        const isDownstepSegment = pt.isNucleus && pt.y < next.y;
        return (
          <line
            key={`seg-${i}`}
            x1={pt.x}
            y1={pt.y}
            x2={next.x}
            y2={next.y}
            stroke={isDownstepSegment ? 'var(--color-error)' : 'var(--color-primary-600)'}
            strokeWidth={compact ? 1.5 : 2}
            strokeLinecap="round"
          />
        );
      })}

      {/* Dashed connector to trailing particle (distinguishes Heiban [0] vs Odaka [N]) */}
      {lastWordPoint && particlePoint && (
        <line
          x1={lastWordPoint.x}
          y1={lastWordPoint.y}
          x2={particlePoint.x}
          y2={particlePoint.y}
          stroke={isDropToParticle ? 'var(--color-error)' : 'var(--color-text-muted)'}
          strokeWidth={compact ? 1.25 : 1.75}
          strokeDasharray={compact ? '2 2' : '3 2.5'}
          strokeLinecap="round"
          opacity={isDropToParticle ? 0.9 : 0.6}
        />
      )}

      {/* Mora dots */}
      {wordPoints.map((pt, i) => (
        <circle
          key={`dot-${i}`}
          cx={pt.x}
          cy={pt.y}
          r={compact ? (pt.isNucleus ? 2.2 : 1.7) : (pt.isNucleus ? 3.8 : 3.2)}
          fill={pt.isNucleus ? 'var(--color-error)' : 'var(--color-primary-600)'}
        />
      ))}

      {/* Hollow trailing particle dot */}
      {particlePoint && (
        <circle
          cx={particlePoint.x}
          cy={particlePoint.y}
          r={compact ? 1.6 : 3}
          fill="var(--color-surface)"
          stroke={isDropToParticle ? 'var(--color-error)' : 'var(--color-text-muted)'}
          strokeWidth={compact ? 1.2 : 1.75}
          opacity={isDropToParticle ? 0.95 : 0.75}
        />
      )}

      {/* Mora labels in detail variant */}
      {!compact &&
        points.map((pt, i) => (
          <text
            key={`lbl-${i}`}
            x={pt.x}
            y={40}
            textAnchor="middle"
            lang="ja"
            className="jp-text select-none"
            fontSize={pt.isParticle ? 10.5 : 12.5}
            fontWeight={pt.isNucleus ? 700 : pt.isParticle ? 400 : 500}
            fill={
              pt.isParticle
                ? 'var(--color-text-muted)'
                : pt.isNucleus
                  ? 'var(--color-error)'
                  : 'var(--color-text-primary)'
            }
            opacity={pt.isParticle ? 0.65 : 1}
          >
            {pt.mora}
          </text>
        ))}
    </svg>
  );
}

export function PitchAccentBadge({
  reading,
  pitches,
  variant = 'compact',
  className = '',
}: PitchAccentBadgeProps) {
  const validPitches = normalizePitchAccents(pitches);
  const morae = splitMorae(reading);
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (validPitches.length === 0 || morae.length === 0) return null;

  const activeIndex = selectedIndex < validPitches.length ? selectedIndex : 0;
  const activeDownstep = validPitches[activeIndex];
  const info = classifyPitchAccent(morae.length, activeDownstep);
  const a11yLabel = `Trọng âm [${activeDownstep}] ${info.labelJa} (${info.labelVi})`;

  if (variant === 'compact') {
    const extraCount = validPitches.length - 1;
    // Cap compact SVG contour width cleanly for very long readings
    const showSvg = morae.length <= 7;
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--color-text-secondary)] ${className}`}
        title={`${a11yLabel}${extraCount > 0 ? ` · Khác: ${validPitches.slice(1).map((n) => `[${n}]`).join(' ')}` : ''}`}
        aria-label={a11yLabel}
      >
        {showSvg && <PitchContourSvg morae={morae} downstep={activeDownstep} compact />}
        <span className={activeDownstep > 0 ? 'text-[var(--color-error)]' : 'text-[var(--color-primary-700)]'}>
          [{activeDownstep}]
        </span>
        {extraCount > 0 && (
          <span className="text-[10px] font-medium text-[var(--color-text-muted)]">+{extraCount}</span>
        )}
      </span>
    );
  }

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3.5 py-2 ${className}`}
      aria-label={a11yLabel}
    >
      <div className="max-w-full overflow-x-auto">
        <PitchContourSvg morae={morae} downstep={activeDownstep} compact={false} />
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:border-l sm:border-[var(--color-border)] sm:pl-3">
        <span
          className={`inline-flex items-center rounded-[var(--radius-sm)] px-1.5 py-0.5 text-xs font-bold tabular-nums ${
            activeDownstep > 0
              ? 'bg-[var(--color-error-bg)] text-[var(--color-error)]'
              : 'bg-[var(--color-primary-100)] text-[var(--color-primary-700)]'
          }`}
        >
          [{activeDownstep}]
        </span>
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
          <span lang="ja" className="jp-text font-semibold text-[var(--color-text-primary)]">{info.labelJa}</span>
          {' · '}
          {info.labelVi}
        </span>

        {validPitches.length > 1 && (
          <div className="flex items-center gap-1 pl-1" role="group" aria-label="Chọn kiểu trọng âm">
            {validPitches.map((n, idx) => {
              const active = idx === activeIndex;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSelectedIndex(idx)}
                  aria-pressed={active}
                  className={`min-h-7 min-w-7 rounded-[var(--radius-sm)] px-1.5 text-xs font-semibold tabular-nums transition-colors ${
                    active
                      ? 'bg-[var(--color-primary-600)] text-white'
                      : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary-400)]'
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
