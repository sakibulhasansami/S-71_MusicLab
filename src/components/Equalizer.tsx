import React from 'react';
import { X, RotateCcw } from 'lucide-react';
import { Theme } from '../types';
import { getThemeStyles } from '../utils';

interface EqualizerProps {
  theme: Theme;
  onClose: () => void;
  gains: number[];
  onUpdateGain: (index: number, value: number) => void;
  preset: string;
  onSelectPreset: (name: string, gains: number[]) => void;
}

const FREQUENCIES = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];

export const PRESETS: Record<string, number[]> = {
  'Off': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Custom': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Placeholder, logic handles actual custom values
  'Pop': [-1, 2, 4, 4, 3, 0, -1, -2, -2, -2],
  'Dance': [4, 6, 2, 0, 0, 2, 4, 4, 2, 0],
  'Blues': [3, 5, 3, 1, 0, 0, 0, 1, 2, 2],
  'Classical': [4, 3, 2, 1, -1, -1, 0, 2, 3, 3],
  'Jazz': [3, 3, 1, 1, -1, -1, 0, 1, 3, 4],
  'Rock': [5, 4, 3, 1, -1, -1, 1, 3, 4, 5],
  'Bass Boost': [6, 5, 4, 2, 1, 0, 0, 0, 0, 0],
  'Vocal Boost': [-2, -2, -1, 1, 3, 5, 4, 3, 1, 0],
};

const Equalizer: React.FC<EqualizerProps> = ({ theme, onClose, gains, onUpdateGain, preset, onSelectPreset }) => {
  const styles = getThemeStyles(theme);

  return (
    <div 
      className={`absolute inset-0 z-50 flex flex-col ${styles.appBg} animate-in slide-in-from-bottom-10 duration-300`}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className={`flex items-center justify-between p-6 ${styles.textMain}`}>
        <h3 className="text-xl font-bold tracking-widest uppercase">Equalizer</h3>
        <button onClick={onClose} className={`p-2 rounded-full ${styles.iconBg} hover:bg-white/20`}>
          <X size={24} />
        </button>
      </div>

      {/* Presets Scroll */}
      <div className="px-6 mb-8">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          {Object.keys(PRESETS).map((p) => (
            <button
              key={p}
              onClick={() => onSelectPreset(p, PRESETS[p])}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                preset === p 
                  ? styles.accent 
                  : `bg-white/5 border border-white/10 ${styles.textMain} hover:bg-white/10`
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders Container */}
      <div className="flex-1 px-4 pb-8 flex items-center justify-center">
        <div className="w-full max-w-3xl flex justify-between gap-2 h-64 md:h-80">
          {gains.map((gain, i) => (
            <div key={i} className="flex-1 flex flex-col items-center h-full group">
              {/* Slider Track Container */}
              <div className="relative flex-1 w-full flex justify-center">
                {/* Visual Track Line */}
                <div className={`absolute top-0 bottom-0 w-0.5 bg-white/10 rounded-full`} />
                
                {/* Range Input */}
                <input
                  type="range"
                  min="-20"
                  max="20"
                  step="1"
                  value={gain}
                  onChange={(e) => onUpdateGain(i, parseFloat(e.target.value))}
                  className="absolute top-0 bottom-0 h-full w-full appearance-none bg-transparent cursor-pointer z-10 opacity-0"
                  style={{ WebkitAppearance: 'slider-vertical' as any }} // Type cast for non-standard prop
                />

                {/* Custom Thumb/Bar Visual */}
                <div 
                  className={`absolute w-1.5 rounded-full transition-all duration-100 ease-out ${styles.accent}`}
                  style={{
                    height: `${Math.abs(gain) / 20 * 50}%`,
                    bottom: gain >= 0 ? '50%' : 'auto',
                    top: gain < 0 ? '50%' : 'auto',
                  }}
                />
                
                {/* Thumb Handle Visual */}
                <div 
                  className={`absolute w-8 h-4 rounded-sm shadow-lg border border-white/20 transition-all duration-75 pointer-events-none ${theme === 'PEARL_LIQUID' ? 'bg-white' : 'bg-white'}`}
                  style={{
                    bottom: `calc(50% + ${(gain / 20) * 50}% - 8px)`, // Center based on gain
                  }}
                >
                    <div className="w-full h-full flex items-center justify-center">
                        <div className={`w-4 h-0.5 ${styles.accent}`}></div>
                    </div>
                </div>

                {/* Center Line Indicator */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-0.5 bg-white/30" />
              </div>

              {/* Frequency Label */}
              <div className={`mt-4 text-[10px] font-mono font-bold opacity-60 ${styles.textSec}`}>
                {FREQUENCIES[i]}
              </div>
              {/* Gain Value Label (Visible on hover/active) */}
              <div className={`text-[9px] font-mono opacity-0 group-hover:opacity-100 transition-opacity absolute -top-6 ${styles.textMain}`}>
                {gain > 0 ? '+' : ''}{gain}dB
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Reset Button */}
      <div className="p-6 flex justify-center">
          <button 
            onClick={() => onSelectPreset('Off', PRESETS['Off'])}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 ${styles.textMain} transition-all`}
          >
              <RotateCcw size={16} /> <span className="text-xs font-bold uppercase">Reset Flat</span>
          </button>
      </div>
    </div>
  );
};

export default Equalizer;
