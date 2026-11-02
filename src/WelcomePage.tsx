import React from 'react';
import { motion } from 'motion/react';

const FLOATING = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש', 'מ', 'ל', 'ת'];

function Card({
  href,
  badge,
  emoji,
  title,
  subtitle,
  gradient,
}: {
  href: string;
  badge?: string;
  emoji: string;
  title: string;
  subtitle: string;
  gradient: string;
}) {
  return (
    <motion.a
      href={href}
      whileTap={{ scale: 0.96 }}
      whileHover={{ y: -4 }}
      className={`relative block w-full sm:w-[22rem] rounded-[2.5rem] p-8 text-center text-white shadow-[0_10px_0_rgba(0,0,0,0.15)] active:translate-y-1.5 active:shadow-[0_3px_0_rgba(0,0,0,0.15)] ${gradient}`}
    >
      {badge && (
        <span className="absolute -top-4 right-6 bg-yellow-300 text-yellow-900 text-lg font-bold rounded-full px-4 py-1 shadow">
          {badge}
        </span>
      )}
      <div className="text-8xl leading-none mb-3" aria-hidden>
        {emoji}
      </div>
      <h2 className="text-4xl font-bold">{title}</h2>
      <p className="mt-2 text-xl text-white/90">{subtitle}</p>
    </motion.a>
  );
}

/** The first page visitors see: pick which area to play in. */
export default function WelcomePage() {
  return (
    <div className="fs-root fixed inset-0 overflow-y-auto" dir="rtl">
      {FLOATING.map((c, i) => (
        <motion.span
          key={c}
          aria-hidden
          className="absolute text-indigo-300/40 font-bold pointer-events-none select-none"
          style={{ fontSize: 60 + (i % 3) * 30, top: `${(i * 37) % 85}%`, left: `${(i * 23 + 5) % 90}%` }}
          animate={{ y: [0, -18, 0], rotate: [0, i % 2 ? 8 : -8, 0] }}
          transition={{ repeat: Infinity, duration: 4 + (i % 4), ease: 'easeInOut', delay: i * 0.3 }}
        >
          {c}
        </motion.span>
      ))}
      <div className="relative min-h-full flex flex-col items-center justify-center gap-10 px-5 py-10 text-center">
        <div>
          <motion.div
            className="text-8xl mb-2"
            animate={{ rotate: [-6, 6, -6] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
            aria-hidden
          >
            🦊
          </motion.div>
          <h1 className="text-5xl sm:text-6xl font-bold text-indigo-700">ברוכים הבאים!</h1>
          <p className="text-2xl text-indigo-900/70 mt-2">איפה משחקים היום?</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-10 items-center justify-center w-full">
          <Card
            href="#/first-steps"
            badge="חדש!"
            emoji="👣"
            title="צעדים ראשונים"
            subtitle="לומדים את האותיות בקול ובמשחק"
            gradient="bg-gradient-to-br from-emerald-400 to-teal-500"
          />
          <Card
            href="#/grade1"
            emoji="✏️"
            title="משחקי כיתה א'"
            subtitle="תשחץ, סודוקו, זיכרון ועוד"
            gradient="bg-gradient-to-br from-indigo-400 to-violet-500"
          />
        </div>
      </div>
    </div>
  );
}
