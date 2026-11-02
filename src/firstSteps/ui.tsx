import React from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { sfx } from './sfx';

export function burst(x = 0.5, y = 0.5, big = false) {
  try {
    confetti({
      particleCount: big ? 140 : 50,
      spread: big ? 100 : 70,
      startVelocity: big ? 45 : 32,
      origin: { x, y },
      zIndex: 9999,
      disableForReducedMotion: true,
    });
  } catch {
    /* confetti is decoration only */
  }
}

export function burstAt(e?: React.SyntheticEvent) {
  const t = e?.currentTarget as HTMLElement | undefined;
  if (!t) return burst();
  const r = t.getBoundingClientRect();
  burst((r.left + r.width / 2) / window.innerWidth, (r.top + r.height / 2) / window.innerHeight);
}

export function Mascot({ size = 88, dance = false }: { size?: number; dance?: boolean }) {
  return (
    <motion.div
      aria-hidden
      style={{ fontSize: size, lineHeight: 1 }}
      animate={dance ? { rotate: [-10, 10, -10], y: [0, -14, 0] } : { y: [0, -6, 0] }}
      transition={{ repeat: Infinity, duration: dance ? 0.7 : 2.4, ease: 'easeInOut' }}
    >
      🦊
    </motion.div>
  );
}

export function BigButton({
  children,
  onClick,
  color = 'bg-emerald-500',
  className = '',
}: {
  children: React.ReactNode;
  onClick: () => void;
  color?: string;
  className?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={() => {
        sfx.tap();
        onClick();
      }}
      className={`${color} text-white rounded-[2rem] px-8 py-4 text-3xl font-bold shadow-[0_8px_0_rgba(0,0,0,0.18)] active:shadow-[0_2px_0_rgba(0,0,0,0.18)] active:translate-y-1.5 ${className}`}
    >
      {children}
    </motion.button>
  );
}

export function StarsChip({ stars }: { stars: number }) {
  return (
    <div className="flex items-center gap-1.5 bg-white/80 rounded-full px-4 py-2 text-2xl font-bold text-amber-600 shadow">
      <span>⭐</span>
      <span>{stars}</span>
    </div>
  );
}

