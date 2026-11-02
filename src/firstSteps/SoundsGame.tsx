import React from 'react';
import { Home } from 'lucide-react';

/** Placeholder: צלילים. Replaced by the real game. */
export default function SoundsGame({ onExit }: { onExit: () => void }) {
  return (
    <div className="fs-root fixed inset-0 flex flex-col items-center justify-center gap-4" dir="rtl">
      <div className="text-7xl">🔊</div>
      <p className="text-3xl font-bold text-indigo-700">צלילים — בקרוב</p>
      <button aria-label="חזרה" onClick={onExit} className="w-16 h-16 rounded-full bg-white shadow flex items-center justify-center">
        <Home className="w-8 h-8" />
      </button>
    </div>
  );
}
