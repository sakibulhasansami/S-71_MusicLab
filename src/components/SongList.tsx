import React from 'react';
import { Song, Theme } from '../types';
import { Play, BarChart2, Disc, Mic2, Music, Loader2, Headphones, Pin } from 'lucide-react';
import { getThemeStyles } from '../utils';

interface SongListProps {
  songs: Song[];
  loading: boolean;
  onPlay: (song: Song) => void;
  currentSong: Song | null;
  isPlaying: boolean;
  isPlayerLoading?: boolean; // Received from App
  theme: Theme;
}

const SongList: React.FC<SongListProps> = ({ 
  songs, 
  loading, 
  onPlay, 
  currentSong, 
  isPlaying,
  isPlayerLoading = false,
  theme
}) => {
  const styles = getThemeStyles(theme);

  if (loading) {
    return (
      <div className="flex flex-col gap-3 px-2 mt-2">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className={`h-16 w-full rounded-2xl opacity-30 animate-pulse ${styles.card}`}></div>
        ))}
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-20 text-center`}>
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 opacity-50 ${styles.iconBg}`}>
          <Disc size={32} />
        </div>
        <h3 className={`text-xl font-bold opacity-90 ${styles.textMain}`}>Void Detected</h3>
        <p className={`opacity-60 mt-1 text-sm ${styles.textSec}`}>No frequencies match criteria.</p>
      </div>
    );
  }

  return (
    <div className="px-2 pb-28 flex flex-col gap-3 mt-2">
      {songs.map((song) => {
        const isActive = currentSong?.id === song.id;
        const isLoadingThis = isActive && isPlayerLoading;
        
        return (
          <div 
            key={song.id}
            onClick={() => onPlay(song)}
            className={`group relative w-full p-3 pl-4 cursor-pointer rounded-2xl flex items-center gap-3 ${styles.card} ${isActive ? 'ring-1 ring-white/30' : ''} ${song.isPinned ? 'border-l-4 border-l-yellow-400' : ''}`}
          >
            {/* Left Icon Container */}
            <div className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all ${isActive ? styles.accent : `bg-white/5 border border-white/10 ${styles.textMain}`}`}>
              {isLoadingThis ? (
                <Loader2 className="animate-spin" size={16} />
              ) : isActive && isPlaying ? (
                 <BarChart2 className="animate-pulse" size={16} />
              ) : (
                 <Music size={16} className="opacity-80" />
              )}
            </div>

            {/* Text Info */}
            <div className="min-w-0 flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-2">
                 {song.isPinned && <Pin size={12} className="text-yellow-400 rotate-45" fill="currentColor" />}
                 <h4 className={`font-bold text-base leading-tight truncate ${styles.textMain}`}>
                   {song.title}
                 </h4>
              </div>
              <div className="flex items-center gap-2 mt-1">
                 <p className={`text-xs font-medium tracking-wide truncate ${styles.textSec}`}>
                   {song.artist}
                 </p>
                 <div className={`flex items-center gap-1 text-[9px] opacity-60 ${styles.textSec} bg-white/5 px-1.5 py-0.5 rounded-md`}>
                    <Headphones size={8} /> 
                    <span>{song.playCount || 0}</span>
                 </div>
              </div>
            </div>

            {/* Active Indicator (Right Side) */}
            {isActive && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                 <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor] animate-pulse ${theme === 'PEARL_LIQUID' ? 'bg-black' : 'bg-white'}`} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SongList;