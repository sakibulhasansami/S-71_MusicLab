import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, ChevronDown, Loader2, Music, ListMusic, FileText, Share2, Copy, Check, Shuffle, Repeat, Repeat1, MoreVertical, Sliders, Gauge, Timer, X, Minus, Plus } from 'lucide-react';
import { Song, Theme, RepeatMode } from '../types';
import { formatTime, convertDriveLink, getThemeStyles } from '../utils';
import Equalizer, { PRESETS } from './Equalizer';
import { AnimatePresence, motion } from 'framer-motion';

interface PlayerProps {
  currentSong: Song | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSongEnd: () => void;
  theme: Theme;
  onLoadingChange?: (loading: boolean) => void;
  allSongs: Song[]; // Pass all songs for "Up Next" feature
  isShuffle: boolean;
  repeatMode: RepeatMode;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
}

const Player: React.FC<PlayerProps> = ({ 
  currentSong, 
  isPlaying, 
  onPlayPause, 
  onNext, 
  onPrev, 
  onSongEnd,
  theme,
  onLoadingChange,
  allSongs,
  isShuffle,
  repeatMode,
  onToggleShuffle,
  onToggleRepeat
}) => {
  const styles = getThemeStyles(theme);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // State
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [view, setView] = useState<'ARTWORK' | 'LYRICS' | 'UP_NEXT'>('ARTWORK');
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  
  // Menu & Modals State
  const [showMenu, setShowMenu] = useState(false);
  const [showEqualizer, setShowEqualizer] = useState(false);
  const [showSpeedControl, setShowSpeedControl] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  
  // Equalizer State
  const [eqGains, setEqGains] = useState<number[]>(PRESETS['Off']);
  const [eqPreset, setEqPreset] = useState('Off');

  // Sleep Timer State
  const [sleepTimer, setSleepTimer] = useState<number | null>(null); // Minutes
  const [sleepTimerId, setSleepTimerId] = useState<NodeJS.Timeout | null>(null);
  const [sleepEndTime, setSleepEndTime] = useState<number | null>(null);

  const isReadyToPlay = useRef(false);

  // Audio Context Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Full Player Swipe Refs
  const touchStart = useRef<{x: number, y: number} | null>(null);

  // Mini Player Swipe Refs
  const miniTouchStart = useRef<{x: number, y: number} | null>(null);
  const isMiniSwiping = useRef(false);
  
  // Menu Ref for click outside
  const menuRef = useRef<HTMLDivElement>(null);

  // Helper to sync loading state
  const setLoading = (loading: boolean) => {
    setLocalLoading(loading);
    if (onLoadingChange) onLoadingChange(loading);
  };

  // Reset view to ARTWORK whenever player is expanded
  useEffect(() => {
    if (isExpanded) {
      setView('ARTWORK');
    }
  }, [isExpanded]);

  // Handle click outside menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Initialize Audio Context & Filters & Analyser
  useEffect(() => {
    if (!audioRef.current || audioContextRef.current) return;

    try {
      // Create Context
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      // Create Source
      const source = ctx.createMediaElementSource(audioRef.current);
      sourceRef.current = source;

      // Create Analyser
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256; // Adjust for resolution vs performance
      analyserRef.current = analyser;

      // Create 10 Bands
      const frequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
      const filters = frequencies.map((freq, index) => {
        const filter = ctx.createBiquadFilter();
        // Use Lowshelf for bass and Highshelf for treble for more impact
        if (index === 0) {
            filter.type = 'lowshelf';
        } else if (index === frequencies.length - 1) {
            filter.type = 'highshelf';
        } else {
            filter.type = 'peaking';
            filter.Q.value = 1.0; // Wider Q for more noticeable effect
        }
        filter.frequency.value = freq;
        filter.gain.value = 0;
        return filter;
      });
      filtersRef.current = filters;

      // Connect Graph: Source -> Filter[0] -> ... -> Filter[9] -> Analyser -> Destination
      source.connect(filters[0]);
      for (let i = 0; i < filters.length - 1; i++) {
        filters[i].connect(filters[i + 1]);
      }
      filters[filters.length - 1].connect(analyser);
      analyser.connect(ctx.destination);

    } catch (e) {
      console.error("Audio Context Init Error:", e);
    }
  }, []);

  // Visualizer Animation Loop
  useEffect(() => {
    if (!canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw Bars
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2; // Scale height

        // Gradient based on theme
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        if (theme === 'NEON_LIQUID') {
            gradient.addColorStop(0, 'rgba(6, 182, 212, 0.8)'); // Cyan
            gradient.addColorStop(1, 'rgba(168, 85, 247, 0.8)'); // Purple
        } else if (theme === 'SAKURA_LIQUID') {
            gradient.addColorStop(0, 'rgba(236, 72, 153, 0.8)'); // Pink
            gradient.addColorStop(1, 'rgba(244, 114, 182, 0.8)'); // Light Pink
        } else {
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
        }

        ctx.fillStyle = gradient;
        
        // Rounded top bars
        ctx.beginPath();
        ctx.roundRect(x, canvas.height - barHeight, barWidth, barHeight, [4, 4, 0, 0]);
        ctx.fill();

        x += barWidth + 1;
      }
    };

    if (isPlaying && isExpanded) {
        draw();
    } else {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, isExpanded, theme]);

  // Handle Window Resize for Canvas
  useEffect(() => {
    const handleResize = () => {
        if (canvasRef.current) {
            canvasRef.current.width = window.innerWidth;
        }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update Filters when Gains Change
  useEffect(() => {
    filtersRef.current.forEach((filter, i) => {
      if (filter) {
        filter.gain.value = eqGains[i];
      }
    });
  }, [eqGains]);

  // Resume Context on Play
  useEffect(() => {
    if (isPlaying && audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Sleep Timer Logic
  useEffect(() => {
      if (sleepTimer !== null) {
          const id = setTimeout(() => {
              onPlayPause(); // Pause
              setSleepTimer(null);
              setSleepEndTime(null);
          }, sleepTimer * 60 * 1000);
          setSleepTimerId(id);
          setSleepEndTime(Date.now() + sleepTimer * 60 * 1000);
      } else {
          if (sleepTimerId) clearTimeout(sleepTimerId);
          setSleepTimerId(null);
          setSleepEndTime(null);
      }
      return () => {
          if (sleepTimerId) clearTimeout(sleepTimerId);
      };
  }, [sleepTimer]);

  useEffect(() => {
    if (!currentSong || !audioRef.current) return;
    const audio = audioRef.current;
    
    // START LOADING
    setLoading(true);
    isReadyToPlay.current = false;
    
    audio.src = convertDriveLink(currentSong.originalUrl) || currentSong.directUrl;
    audio.load();
    audio.playbackRate = playbackRate;
    
    const onCanPlay = () => {
      // STOP LOADING
      setLoading(false);
      isReadyToPlay.current = true;
      if (isPlaying) safePlay();
    };
    
    audio.addEventListener('canplay', onCanPlay);
    // Safety timeout to stop loading if network hangs
    const timeout = setTimeout(() => setLoading(false), 8000);

    return () => {
      audio.removeEventListener('canplay', onCanPlay);
      clearTimeout(timeout);
    };
  }, [currentSong?.id]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying && isReadyToPlay.current) safePlay();
    else if (!isPlaying) audioRef.current.pause();
  }, [isPlaying]);

  const safePlay = async () => {
    if (audioRef.current) {
      try { 
        audioRef.current.playbackRate = playbackRate;
        await audioRef.current.play(); 
      } catch (e) { console.error(e); }
    }
  };
  
  // Handle Song End with Repeat One Logic
  const handleInternalSongEnd = () => {
      if (repeatMode === 'ONE' && audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play();
      } else {
          onSongEnd();
      }
  };

  const togglePlaybackRate = () => {
    const rates = [0.5, 1, 1.25, 1.5, 2];
    const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
    setPlaybackRate(rates[nextIndex]);
  };

  const handleEqUpdate = (index: number, value: number) => {
    const newGains = [...eqGains];
    newGains[index] = value;
    setEqGains(newGains);
    setEqPreset('Custom');
  };

  const handlePresetSelect = (name: string, gains: number[]) => {
    setEqPreset(name);
    setEqGains([...gains]);
  };

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  const handleTimeUpdate = () => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); };
  const handleLoadedMetadata = () => { if (audioRef.current) setDuration(audioRef.current.duration); };
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) { audioRef.current.currentTime = time; setCurrentTime(time); }
  };

  // --- Full Player Swipe Handlers ---
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY
    };

    const deltaX = touchEnd.x - touchStart.current.x;
    const deltaY = touchEnd.y - touchStart.current.y;

    const Y_THRESHOLD = 50; 
    const X_THRESHOLD = 50;

    // 1. Swipe Down (Close ONLY - Keep Music Playing)
    if (deltaY > Y_THRESHOLD && Math.abs(deltaX) < 100) {
       setIsExpanded(false);
       touchStart.current = null;
       return;
    }

    // 2. Side Swipes (Only active in Artwork View)
    if (view === 'ARTWORK' && Math.abs(deltaX) > X_THRESHOLD && Math.abs(deltaY) < 100) {
        if (deltaX > 0) onNext();
        else onPrev();
    }
    
    touchStart.current = null;
  };

  // --- Mini Player Swipe Handlers ---
  const handleMiniTouchStart = (e: React.TouchEvent) => {
     miniTouchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
     isMiniSwiping.current = false;
  };

  const handleMiniTouchEnd = (e: React.TouchEvent) => {
     if (!miniTouchStart.current) return;
     const endX = e.changedTouches[0].clientX;
     const endY = e.changedTouches[0].clientY;
     const deltaX = endX - miniTouchStart.current.x;
     const deltaY = endY - miniTouchStart.current.y;

     // Thresholds
     if (Math.abs(deltaX) > 50) {
        // Left/Right -> Prev/Next
        isMiniSwiping.current = true;
        if (deltaX > 0) onNext(); 
        else onPrev();
     } else if (deltaY < -50) {
        // Swipe Up -> Expand
        isMiniSwiping.current = true;
        setIsExpanded(true);
     } else if (deltaY > 50) {
        // Swipe Down -> Stop Music
        isMiniSwiping.current = true;
        if (isPlaying) onPlayPause();
     }
     miniTouchStart.current = null;
  };

  const handleMiniClick = () => {
     if (!isMiniSwiping.current) {
        setIsExpanded(true);
     }
  };

  const shareSong = () => {
     if(!currentSong) return;
     const slug = encodeURIComponent(currentSong.title.replace(/\s+/g, '-'));
     const url = `${window.location.origin}${window.location.pathname}#/music/${slug}`;
     navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
     });
  };

  const currentIndex = allSongs.findIndex(s => s.id === currentSong?.id);
  const upNextSongs = allSongs.slice(currentIndex + 1, currentIndex + 6);

  // Helper for Sleep Timer Display
  const getSleepTimerDisplay = () => {
      if (!sleepEndTime) return null;
      const diff = Math.ceil((sleepEndTime - Date.now()) / 60000);
      return `${diff}m`;
  };

  if (!currentSong) return null;

  return (
    <>
      <style>{`
        @keyframes scroll-text {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .scrolling-text {
          animation: scroll-text 15s linear infinite;
          white-space: nowrap;
          display: inline-block;
          min-width: 100%;
          padding-right: 20px; /* Small padding to prevent cut-off at edge */
        }
        .scrolling-container {
          overflow: hidden;
          white-space: nowrap;
          mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
        }
      `}</style>
      <audio 
        ref={audioRef}
        crossOrigin="anonymous" // Required for Web Audio API
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleInternalSongEnd}
      />

      {/* --- Mini Player --- */}
      <div 
        onClick={handleMiniClick}
        onTouchStart={handleMiniTouchStart}
        onTouchEnd={handleMiniTouchEnd}
        className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-500 ${isExpanded ? 'translate-y-full' : 'translate-y-0'}`}
      >
        <div className="mx-auto max-w-4xl px-2 pb-2">
          {/* Background Visualizer (Mini) */}
          <div className={`absolute inset-0 rounded-[2rem] transition-opacity duration-1000 ${isPlaying ? 'opacity-30 visualizer-active' : 'opacity-0'} ${theme === 'SAKURA_LIQUID' ? 'bg-pink-500 blur-xl' : 'bg-white blur-xl'}`} style={{zIndex: -1}}></div>

          <div className={`${styles.player} rounded-[2rem] p-4 flex items-center justify-between shadow-2xl relative overflow-hidden group cursor-pointer`}>
            {/* Progress Line */}
            <div className={`absolute top-0 left-0 h-0.5 opacity-80 ${theme === 'NEON_LIQUID' ? 'bg-cyan-500' : theme === 'PEARL_LIQUID' ? 'bg-black' : 'bg-white'}`} style={{ width: `${(currentTime / (duration || 1)) * 100}%` }} />
            
            <div className="flex items-center gap-4 overflow-hidden flex-1">
               <div className={`w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden bg-cover bg-center ${styles.iconBg} ${isPlaying ? 'animate-pulse' : ''}`} style={currentSong.imageUrl ? { backgroundImage: `url(${currentSong.imageUrl})` } : {}}>
                 {!currentSong.imageUrl && (localLoading ? <Loader2 className="animate-spin" size={20} /> : <Music size={20} />)}
               </div>
               <div className="min-w-0 flex-1 overflow-hidden relative">
                 {/* Marquee Title */}
                 <div className="scrolling-container w-full">
                   <h4 className={`font-bold text-sm ${styles.textMain} scrolling-text`}>
                      {currentSong.title}
                   </h4>
                 </div>
                 <p className={`text-xs truncate ${styles.textSec}`}>{currentSong.artist}</p>
               </div>
            </div>

            <button 
              onClick={(e) => { e.stopPropagation(); onPlayPause(); }}
              className={`w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 ${styles.accent}`}
            >
              {localLoading ? <Loader2 size={20} className="animate-spin" /> : isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* --- Full Screen Player --- */}
      <div 
        className={`fixed inset-0 z-50 flex flex-col ${styles.appBg} transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isExpanded ? 'translate-y-0' : 'translate-y-[105%]'}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        
        {/* Background Visualizer (Full) */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[60%] rounded-full blur-[100px] transition-all duration-1000 pointer-events-none ${isPlaying ? 'opacity-40 visualizer-active scale-110' : 'opacity-10 scale-90'} ${theme === 'SAKURA_LIQUID' ? 'bg-pink-500' : theme === 'NEON_LIQUID' ? 'bg-cyan-500' : theme === 'PEARL_LIQUID' ? 'bg-gray-400' : 'bg-indigo-500'}`}></div>

        {/* Absolute glass background overlay */}
        <div className={`absolute inset-0 ${theme === 'PEARL_LIQUID' ? 'bg-white/30' : 'bg-black/10'} backdrop-blur-3xl -z-10`} />

        {/* Header */}
        <div className={`flex items-center justify-between p-6 ${styles.textMain} relative z-50`}>
          <button onClick={() => setIsExpanded(false)} className={`p-2 opacity-80 hover:opacity-100 transition-opacity rounded-full ${styles.iconBg}`}><ChevronDown size={28} /></button>
          
          {/* Tab Switcher */}
          <div className="flex bg-black/20 rounded-full p-1 backdrop-blur-md">
             <button onClick={() => setView('ARTWORK')} className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${view === 'ARTWORK' ? `${styles.accent}` : 'opacity-60'}`}>Song</button>
             <button onClick={() => setView('LYRICS')} className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${view === 'LYRICS' ? `${styles.accent}` : 'opacity-60'}`}>Lyrics</button>
             <button onClick={() => setView('UP_NEXT')} className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${view === 'UP_NEXT' ? `${styles.accent}` : 'opacity-60'}`}>Up Next</button>
          </div>

          {/* Menu Button */}
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setShowMenu(!showMenu)} 
              className={`p-2 opacity-80 hover:opacity-100 transition-opacity rounded-full ${styles.iconBg}`}
            >
              <MoreVertical size={24} />
            </button>

            {/* Menu Dropdown */}
            {showMenu && (
              <div className={`absolute right-0 top-full mt-2 w-56 rounded-xl border ${styles.border} ${styles.card} shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-[60]`}>
                  <div className="p-2 space-y-1">
                      {/* Playback Speed */}
                      <button 
                        onClick={() => { setShowSpeedControl(true); setShowMenu(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10 transition-colors text-left ${styles.textMain}`}
                      >
                         <Gauge size={16} />
                         <span className="text-sm font-bold">Speed: {playbackRate}x</span>
                      </button>

                      {/* Equalizer */}
                      <button 
                        onClick={() => { setShowEqualizer(true); setShowMenu(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10 transition-colors text-left ${styles.textMain}`}
                      >
                         <Sliders size={16} />
                         <span className="text-sm font-bold">Equalizer</span>
                      </button>

                      {/* Sleep Timer */}
                      <button 
                        onClick={() => { setShowSleepTimer(true); setShowMenu(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10 transition-colors text-left ${styles.textMain}`}
                      >
                         <Timer size={16} />
                         <span className="text-sm font-bold">Sleep Timer {getSleepTimerDisplay() && `(${getSleepTimerDisplay()})`}</span>
                      </button>

                      {/* Share */}
                      <button 
                        onClick={() => { shareSong(); setShowMenu(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10 transition-colors text-left ${styles.textMain}`}
                      >
                         {copied ? <Check size={16} className="text-green-400"/> : <Share2 size={16} />}
                         <span className="text-sm font-bold">{copied ? 'Link Copied!' : 'Share Song'}</span>
                      </button>
                  </div>
              </div>
            )}
          </div>
        </div>

        {/* Content Area - Adjusted alignment to justify-start and added padding top */}
        <div className="flex-1 flex flex-col items-center justify-start pt-10 md:pt-16 w-full relative z-10 overflow-hidden">
          
          {/* Visualizer Canvas */}
          <canvas 
            ref={canvasRef} 
            width={window.innerWidth} 
            height={200} 
            className="absolute bottom-0 left-0 w-full h-48 pointer-events-none opacity-50 z-0"
          />

          {/* View: ARTWORK */}
          {view === 'ARTWORK' && (
            <div className="flex flex-col items-center justify-center w-full px-8 animate-in fade-in zoom-in duration-500 relative z-10">
               {/* Artwork */}
               <AnimatePresence mode="wait">
                 <motion.div 
                   key={currentSong.id}
                   initial={{ opacity: 0, scale: 0.9, rotate: -5 }}
                   animate={{ opacity: 1, scale: 1, rotate: 0 }}
                   exit={{ opacity: 0, scale: 0.9, rotate: 5 }}
                   transition={{ duration: 0.4, ease: "easeOut" }}
                   className={`relative w-72 h-72 md:w-96 md:h-96 mb-8 rounded-3xl flex items-center justify-center overflow-hidden shadow-2xl ${isPlaying && !localLoading && !currentSong.imageUrl ? 'animate-[spin_8s_linear_infinite] rounded-full border-[12px] ' + styles.border : ''}`}
                 >
                   {currentSong.imageUrl ? (
                      <img src={currentSong.imageUrl} alt="Artwork" className="w-full h-full object-cover" />
                   ) : (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-50" />
                        <div className={`absolute inset-0 rounded-full border-[50px] ${theme === 'PEARL_LIQUID' ? 'border-gray-200/50' : 'border-black/10'}`} />
                        <Music size={80} className={`${styles.textMain} opacity-50`} />
                      </>
                   )}
                   
                   {/* Center Loading Spinner */}
                   {localLoading && (
                     <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-20">
                        <Loader2 size={48} className="text-white animate-spin" />
                     </div>
                   )}
                 </motion.div>
               </AnimatePresence>

              {/* Title & Artist - Adjusted spacing and Marquee */}
              <div className="w-full text-center mb-4 overflow-hidden relative px-4">
                <div className="scrolling-container w-full">
                  <h2 className={`text-3xl font-bold mb-2 ${styles.textMain} scrolling-text`}>
                    {currentSong.title}
                  </h2>
                </div>
                <p className={`text-xl opacity-60 truncate ${styles.textSec}`}>{currentSong.artist}</p>
              </div>
            </div>
          )}

          {/* View: LYRICS */}
          {view === 'LYRICS' && (
             <div className="w-full h-full px-8 pb-48 overflow-y-auto text-center animate-in slide-in-from-bottom-8 fade-in relative z-10">
                {currentSong.lyrics ? (
                   <p className={`text-xl md:text-2xl font-medium leading-relaxed whitespace-pre-line ${styles.textMain} opacity-90`}>
                      {currentSong.lyrics}
                   </p>
                ) : (
                   <div className="flex flex-col items-center justify-center h-full opacity-50">
                      <FileText size={48} className="mb-4" />
                      <p>Lyrics not available</p>
                   </div>
                )}
             </div>
          )}

          {/* View: UP NEXT */}
          {view === 'UP_NEXT' && (
              <div className="w-full h-full px-4 pb-48 overflow-y-auto animate-in slide-in-from-bottom-8 fade-in relative z-10">
                 <h3 className={`text-xs uppercase font-bold tracking-widest mb-6 opacity-60 ${styles.textSec}`}>Playing Next</h3>
                 {upNextSongs.length > 0 ? (
                    <div className="space-y-3">
                       {upNextSongs.map((s, idx) => (
                          <div key={s.id} className={`flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5`}>
                             <span className={`text-lg font-bold opacity-30 w-6 text-center ${styles.textMain}`}>{idx + 1}</span>
                             <div className={`w-12 h-12 rounded-lg bg-cover bg-center ${styles.iconBg} flex items-center justify-center`} style={s.imageUrl ? {backgroundImage: `url(${s.imageUrl})`} : {}}>
                                {!s.imageUrl && <Music size={16} />}
                             </div>
                             <div className="min-w-0 flex-1">
                                <h4 className={`font-bold text-sm truncate ${styles.textMain}`}>{s.title}</h4>
                                <p className={`text-xs truncate opacity-60 ${styles.textSec}`}>{s.artist}</p>
                             </div>
                          </div>
                       ))}
                    </div>
                 ) : (
                    <div className="flex flex-col items-center justify-center h-48 opacity-50 text-center">
                       <ListMusic size={32} className="mb-2" />
                       <p className={styles.textSec}>End of playlist</p>
                    </div>
                 )}
              </div>
          )}

          {/* Player Controls - Fixed to Bottom 0 with larger padding to cover shadow gap */}
          <div className="absolute bottom-0 w-full px-8 pb-12 pt-24 bg-gradient-to-t from-black via-black/90 to-transparent z-30">
              {/* Seek */}
              <div className="w-full mb-6 group">
                <input 
                  type="range" min="0" max={duration || 100} value={currentTime} onChange={handleSeek}
                  className={`w-full h-1.5 rounded-full appearance-none cursor-pointer transition-all hover:h-2 ${theme === 'NEON_LIQUID' ? 'bg-cyan-900' : theme === 'PEARL_LIQUID' ? 'bg-gray-300' : 'bg-white/10'}`}
                  style={{
                      boxShadow: isPlaying ? `0 0 10px ${theme === 'NEON_LIQUID' ? 'cyan' : 'white'}` : 'none'
                  }}
                />
                <div className={`flex justify-between text-xs opacity-50 mt-3 font-mono ${styles.textMain}`}>
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className={`flex items-center justify-between w-full ${styles.textMain}`}>
                <button 
                  onClick={onToggleShuffle} 
                  className={`p-3 rounded-full transition-all ${isShuffle ? styles.accent : 'opacity-50 hover:opacity-100'}`}
                >
                  <Shuffle size={20} />
                </button>

                <button onClick={onPrev} className="p-4 hover:scale-110 transition-transform active:scale-95"><SkipBack size={32} /></button>
                
                <button onClick={onPlayPause} className={`w-20 h-20 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(0,0,0,0.3)] hover:scale-105 transition-transform active:scale-95 ${styles.accent}`}>
                  {localLoading ? <Loader2 size={32} className="animate-spin" /> : isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                </button>
                
                <button onClick={onNext} className="p-4 hover:scale-110 transition-transform active:scale-95"><SkipForward size={32} /></button>

                <button 
                  onClick={onToggleRepeat} 
                  className={`p-3 rounded-full transition-all ${repeatMode !== 'OFF' ? styles.accent : 'opacity-50 hover:opacity-100'}`}
                >
                  {repeatMode === 'ONE' ? <Repeat1 size={20} /> : <Repeat size={20} />}
                </button>
              </div>
          </div>

        </div>

        {/* Equalizer Overlay */}
        {showEqualizer && (
          <Equalizer 
            theme={theme}
            onClose={() => setShowEqualizer(false)}
            gains={eqGains}
            onUpdateGain={handleEqUpdate}
            preset={eqPreset}
            onSelectPreset={handlePresetSelect}
          />
        )}

        {/* Speed Control Modal */}
        {showSpeedControl && (
            <div className="absolute inset-0 z-[60] flex flex-col items-center justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowSpeedControl(false)}>
                <div className={`w-full max-w-md ${styles.card} rounded-t-[2.5rem] p-8 pb-12 animate-in slide-in-from-bottom duration-300`} onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-8">
                        <h3 className={`text-xl font-bold uppercase tracking-widest ${styles.textMain}`}>Playback Speed</h3>
                        <button onClick={() => setShowSpeedControl(false)} className={`p-2 rounded-full ${styles.iconBg}`}><X size={20} /></button>
                    </div>
                    
                    <div className="flex flex-col gap-6">
                        {/* Current Value Display */}
                        <div className={`text-center text-4xl font-bold ${styles.textMain}`}>{playbackRate}x</div>
                        
                        {/* Slider */}
                        <div className="flex items-center gap-4">
                            <button onClick={() => setPlaybackRate(Math.max(0.25, playbackRate - 0.1))} className={`p-2 rounded-full ${styles.iconBg}`}><Minus size={20} /></button>
                            <input 
                                type="range" min="0.25" max="4" step="0.05" 
                                value={playbackRate} 
                                onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                                className="flex-1 h-2 rounded-full appearance-none bg-white/10 accent-white"
                            />
                            <button onClick={() => setPlaybackRate(Math.min(4, playbackRate + 0.1))} className={`p-2 rounded-full ${styles.iconBg}`}><Plus size={20} /></button>
                        </div>

                        {/* Presets */}
                        <div className="grid grid-cols-4 gap-3">
                            {[0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].map(rate => (
                                <button 
                                    key={rate} 
                                    onClick={() => setPlaybackRate(rate)}
                                    className={`py-3 rounded-xl font-bold text-sm transition-all ${playbackRate === rate ? styles.accent : `bg-white/5 ${styles.textMain} hover:bg-white/10`}`}
                                >
                                    {rate}x
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Sleep Timer Modal */}
        {showSleepTimer && (
            <div className="absolute inset-0 z-[60] flex flex-col items-center justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowSleepTimer(false)}>
                <div className={`w-full max-w-md ${styles.card} rounded-t-[2.5rem] p-8 pb-12 animate-in slide-in-from-bottom duration-300`} onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-8">
                        <h3 className={`text-xl font-bold uppercase tracking-widest ${styles.textMain}`}>Sleep Timer</h3>
                        <button onClick={() => setShowSleepTimer(false)} className={`p-2 rounded-full ${styles.iconBg}`}><X size={20} /></button>
                    </div>
                    
                    <div className="flex flex-col gap-6">
                        {/* Status Display */}
                        <div className={`text-center ${styles.textMain}`}>
                            {sleepEndTime ? (
                                <>
                                    <div className="text-4xl font-bold mb-2">{getSleepTimerDisplay()}</div>
                                    <p className="opacity-60 text-sm">Stopping playback in...</p>
                                </>
                            ) : (
                                <div className="text-xl font-bold opacity-50">Timer Off</div>
                            )}
                        </div>

                        {/* Presets */}
                        <div className="grid grid-cols-3 gap-3">
                            {[5, 10, 15, 30, 45, 60].map(min => (
                                <button 
                                    key={min} 
                                    onClick={() => { setSleepTimer(min); setShowSleepTimer(false); }}
                                    className={`py-4 rounded-xl font-bold text-sm transition-all bg-white/5 ${styles.textMain} hover:bg-white/10`}
                                >
                                    {min} min
                                </button>
                            ))}
                        </div>
                        
                        {sleepEndTime && (
                            <button 
                                onClick={() => setSleepTimer(null)}
                                className="w-full py-4 rounded-xl font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                            >
                                Turn Off Timer
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )}
      </div>
    </>
  );
};

export default Player;