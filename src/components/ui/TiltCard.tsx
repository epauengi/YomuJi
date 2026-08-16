'use client';

import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxAngle?: number;
  scale?: number;
}

export function TiltCard({
  children,
  className = '',
  maxAngle = 7,
  scale = 1.015,
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 250 };
  const mouseXSpring = useSpring(x, springConfig);
  const mouseYSpring = useSpring(y, springConfig);

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], [maxAngle, -maxAngle]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], [-maxAngle, maxAngle]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;

    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX: isHovered ? rotateX : 0,
        rotateY: isHovered ? rotateY : 0,
        transformStyle: 'preserve-3d',
      }}
      animate={{ scale: isHovered ? scale : 1 }}
      transition={{ duration: 0.2 }}
      className={`relative overflow-hidden rounded-[--radius-xl] border border-[var(--color-border-strong)] bg-[var(--color-surface)] transition-colors duration-200 ${className}`}
    >
      {/* Subtle Dynamic Glare Overlay */}
      {isHovered && (
        <div
          className="pointer-events-none absolute inset-0 z-30 opacity-40 mix-blend-soft-light transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${(mouseXSpring.get() + 0.5) * 100}% ${(mouseYSpring.get() + 0.5) * 100}%, rgba(255,255,255,0.3) 0%, transparent 60%)`,
          }}
        />
      )}
      {children}
    </motion.div>
  );
}
