import { Theme } from "./types";

/**
 * Processes an input URL to ensure it is playable.
 */
export const convertDriveLink = (url: string): string | null => {
  if (!url) return null;

  const drivePatterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/
  ];

  let fileId = null;
  for (const pattern of drivePatterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      fileId = match[1];
      break;
    }
  }

  if (fileId) {
    return `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
  }
  return url;
};

export const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

/**
 * Centralized Theme Engine
 * Returns CSS classes for specific UI elements based on the active theme.
 */
export const getThemeStyles = (theme: Theme) => {
  const liquidClass = theme === 'PEARL_LIQUID' ? 'glass-liquid-light' : 'glass-liquid-true';
  
  switch (theme) {
    case 'PEACE_LIQUID': // Halal/Peace Theme (Vibrant Emerald/Mint)
      return {
        appBg: 'bg-[#022c22] text-emerald-50 font-[Space_Grotesk]',
        card: `${liquidClass} hover:bg-emerald-500/10 transition-all duration-300`,
        textMain: 'text-emerald-50 text-glow',
        textSec: 'text-emerald-200/70',
        accent: 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.6)]',
        border: 'border-emerald-200/30',
        iconBg: 'glass-chip text-emerald-200',
        player: `${liquidClass} bg-[#022c22]/80`
      };
    case 'SAKURA_LIQUID': // Vibrant Deep Magenta/Hot Pink
      return {
        appBg: 'bg-[#1a0510] text-white font-[Space_Grotesk]', // Deep dark base
        card: `${liquidClass} hover:bg-white/10 transition-all duration-300`,
        textMain: 'text-white text-glow',
        textSec: 'text-pink-100/70',
        accent: 'bg-pink-500 text-white shadow-[0_0_20px_rgba(236,72,153,0.6)]',
        border: 'border-pink-200/30',
        iconBg: 'glass-chip text-pink-200',
        player: `${liquidClass} bg-[#1a0510]/80`
      };
    case 'NEON_LIQUID': 
      return {
        appBg: 'bg-[#050505] text-cyan-50 font-[Space_Grotesk]',
        card: `${liquidClass} hover:bg-cyan-900/10 transition-all duration-300`,
        textMain: 'text-cyan-50 text-glow',
        textSec: 'text-cyan-400/60',
        accent: 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.4)]',
        border: 'border-cyan-500/30',
        iconBg: 'glass-chip text-cyan-400',
        player: `${liquidClass} bg-black/80`
      };
    case 'PEARL_LIQUID': // Light Mode - DARK TEXT
      return {
        appBg: 'bg-[#f8fafc] text-gray-900 font-[Space_Grotesk]',
        card: `${liquidClass} hover:bg-white/80 transition-all duration-300`,
        textMain: 'text-gray-900', // Enforce dark text
        textSec: 'text-gray-600',
        accent: 'bg-gray-900 text-white shadow-lg',
        border: 'border-gray-300',
        iconBg: 'bg-white/60 text-gray-800',
        player: `${liquidClass} bg-white/80`
      };
    case 'DARK_LIQUID': // Default S-71
    default:
      return {
        appBg: 'bg-[#0f0720] text-white font-[Space_Grotesk]',
        card: `${liquidClass} hover:bg-white/10 transition-transform duration-300 active:scale-[0.99]`,
        textMain: 'text-white text-glow',
        textSec: 'text-white/60',
        accent: 'bg-white text-black shadow-[0_0_25px_rgba(255,255,255,0.4)]',
        border: 'border-white/10',
        iconBg: 'glass-chip text-white',
        player: `${liquidClass} bg-[#0f0720]/50`
      };
  }
};