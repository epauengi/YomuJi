'use client';

import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react';
import { useInView, useMotionValue, useReducedMotion, useSpring } from 'motion/react';

interface NumberTickerProps extends ComponentPropsWithoutRef<'span'> {
  value: number;
  startValue?: number;
  direction?: 'up' | 'down';
  delay?: number;
  decimalPlaces?: number;
  suffix?: string;
}

function formatValue(value: number, decimalPlaces: number) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(Number(value.toFixed(decimalPlaces)));
}

export function NumberTicker({
  value,
  startValue = 0,
  direction = 'up',
  delay = 0,
  className = '',
  decimalPlaces = 0,
  suffix = '',
  ...props
}: NumberTickerProps) {
  const visualRef = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();
  const initialValue = direction === 'down' ? value : startValue;
  const targetValue = direction === 'down' ? startValue : value;
  const displayedInitialValue = reduceMotion ? targetValue : initialValue;
  const motionValue = useMotionValue(displayedInitialValue);
  const springValue = useSpring(motionValue, { damping: 60, stiffness: 100 });
  const isInView = useInView(visualRef, { once: true, margin: '0px' });
  const finalText = `${formatValue(targetValue, decimalPlaces)}${suffix}`;

  useEffect(() => {
    if (!isInView) return;

    if (reduceMotion) {
      motionValue.jump(targetValue);
      if (visualRef.current) visualRef.current.textContent = finalText;
      return;
    }

    const timer = window.setTimeout(() => motionValue.set(targetValue), delay * 1000);
    return () => window.clearTimeout(timer);
  }, [delay, finalText, isInView, motionValue, reduceMotion, targetValue]);

  useEffect(() => springValue.on('change', (latest) => {
    if (visualRef.current) {
      visualRef.current.textContent = `${formatValue(latest, decimalPlaces)}${suffix}`;
    }
  }), [decimalPlaces, springValue, suffix]);

  return (
    <span
      className={`inline-block tabular-nums ${className}`}
      aria-label={finalText}
      {...props}
    >
      <span ref={visualRef} aria-hidden="true">
        {formatValue(displayedInitialValue, decimalPlaces)}{suffix}
      </span>
    </span>
  );
}
