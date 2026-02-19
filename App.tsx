import React, { useState, useEffect, useMemo } from 'react';
import { Song, MediaType, Theme, SiteSettings, SortOption } from './types';
import { initFirebase, subscribeToSongs, subscribeToSettings, incrementSongPlayCount } from './services/firebase';
import { FIREBASE_CONFIG } from './constants';
import Player from './components/Player';
import SongList from './components/SongList';
import AdminPanel from './components/AdminPanel';
import Footer from './components/Footer';
import { Radio, Music, Mic2, Search, Droplets, Zap, Hexagon, Flower2, Leaf, ArrowUpDown, ListFilter } from 'lucide-react';
import { getThemeStyles } from './utils';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

// Removed "Halal" from this list
const GENRE_LIST = ["Rock", "Instrumental", "Lo-Fi", "Electronic", "Folk", "Acoustic", "Pop"];
const HALAL_SUB_GENRES = ["Nasheed", "Islamic Pop", "Quran Recitation", "Spoken Word", "Lofi Nasheed"];

const App: React.FC = () => {
  // STRICT ROUTING: Default to Home ('#/') unless specifically '#/admin'
  const getInitialRoute = () => {
    const hash = window.location.hash;
    return hash === '#/admin' ? '#/admin' : '#/';
  };

  const [route, setRoute] = useState(getInitialRoute);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  
  // Theme Engine
  const [currentTheme, setCurrentTheme] = useState<Theme>(() => (localStorage.getItem('s71_theme_v2') as Theme) || 'DARK_LIQUID');
  // Store previous theme to revert back from Halal mode
  const [previousTheme, setPreviousTheme] = useState<Theme | null>(null);
  
  const styles = getThemeStyles(currentTheme);
  const liquidClass = currentTheme === 'PEARL_LIQUID' ? 'glass-liquid-light' : 'glass-liquid-true';

  // Filters & Search
  const [activeTab, setActiveTab] = useState<MediaType>('Music');
  const [activeGenre, setActiveGenre] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sorting
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);
  
  // Player
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayerLoading, setIsPlayerLoading] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<import('./types').RepeatMode>('OFF');

  // Deep Link Handling Flag
  const [deepLinkProcessed, setDeepLinkProcessed] = useState(false);

  useEffect(() => {
    initFirebase(FIREBASE_CONFIG);
    const u1 = subscribeToSongs(s => { setSongs(s); setLoading(false); });
    const u2 = subscribeToSettings(s => setSettings(s));
    
    // Robust Hash Listener
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#/admin') {
        setRoute('#/admin');
      } else if (!hash.startsWith('#/music/')) {
        setRoute('#/');
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    
    // Ensure we are on a valid route on mount
    handleHashChange();

    // Splash Screen Timer - REDUCED TIME (800ms)
    const splashTimer = setTimeout(() => setShowSplash(false), 800);

    return () => { 
      u1(); 
      u2(); 
      window.removeEventListener('hashchange', handleHashChange); 
      clearTimeout(splashTimer); 
    };
  }, []);

  // --- Deep Link Logic ---
  useEffect(() => {
    if (!loading && songs.length > 0 && !deepLinkProcessed) {
        const hash = window.location.hash;
        if (hash.startsWith('#/music/')) {
            // Extract Slug
            const slug = hash.replace('#/music/', '');
            if (slug) {
                // Decode and format (Simple slug matching: "Cholna-Sujon" -> "Cholna Sujon")
                // We try to match roughly to the title.
                const searchTitle = decodeURIComponent(slug).replace(/-/g, ' ').toLowerCase();
                
                const foundSong = songs.find(s => s.title.toLowerCase().includes(searchTitle) || s.title.toLowerCase() === searchTitle);
                
                if (foundSong) {
                    setCurrentSong(foundSong);
                    setIsPlaying(true);
                }
            }
        }
        setDeepLinkProcessed(true);
    }
  }, [loading, songs, deepLinkProcessed]);


  // Theme Switching Logic (Manual)
  const switchTheme = (t: Theme) => {
    setCurrentTheme(t);
    setPreviousTheme(null); // Clear previous if user manually switches
    localStorage.setItem('s71_theme_v2', t);
  };

  // Helper: Revert theme if we are moving AWAY from Halal
  const checkAndRevertTheme = () => {
    if (activeTab === 'Halal') {
      if (previousTheme) {
        setCurrentTheme(previousTheme);
        setPreviousTheme(null);
      } else {
        // Fallback to default if no history
        setCurrentTheme('DARK_LIQUID');
      }
    }
  };

  const handleTabChange = (tab: MediaType) => {
    if (tab === 'Halal') {
       // Switching TO Halal
       if (activeTab !== 'Halal') {
           if (currentTheme !== 'PEACE_LIQUID') {
               setPreviousTheme(currentTheme);
               setCurrentTheme('PEACE_LIQUID');
           }
       }
    } else {
       // Switching AWAY from Halal
       if (activeTab === 'Halal') {
           checkAndRevertTheme();
       }
    }
    setActiveTab(tab);
    setActiveGenre('All'); // Reset genre filter on tab switch
  };

  // Swipe Logic
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50;
    if (info.offset.x < -threshold) {
      // Swipe Left -> Next Tab
      if (activeTab === 'Music') handleTabChange('Song');
      else if (activeTab === 'Song') handleTabChange('Halal');
    } else if (info.offset.x > threshold) {
      // Swipe Right -> Prev Tab
      if (activeTab === 'Halal') handleTabChange('Song');
      else if (activeTab === 'Song') handleTabChange('Music');
    }
  };

  const handleGenreClick = (genre: string) => {
      setActiveGenre(genre);
  };

  const filteredSongs = useMemo(() => {
    let result = songs.filter(s => {
      // 1. Tab Filter Logic
      if (activeTab === 'Halal') {
         // Allow both: explicit 'Halal' Type OR legacy/misclassified 'Halal' Genre
         if (s.type !== 'Halal' && s.genre !== 'Halal') return false;
      } else {
         // Music or Song
         if (s.type !== activeTab) return false;
         // Explicitly EXCLUDE Halal content from Music/Song tabs
         if (s.genre === 'Halal' || s.type === 'Halal') return false;
      }

      // 2. Genre/Sub-Genre Filter
      if (activeGenre !== 'All') {
          if (activeTab === 'Halal') {
              // For Halal tab, we filter by subGenre (or genre if needed, but UI shows sub-genres)
              if (s.subGenre !== activeGenre) return false;
          } else {
              // For Music/Song tabs, filter by main genre
              if (s.genre !== activeGenre) return false;
          }
      }

      // 3. Search Filter
      if (searchQuery) {
         const q = searchQuery.toLowerCase();
         return s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q);
      }
      return true;
    });

    // 4. Sorting & Pinning
    return result.sort((a, b) => {
        // Pinned items always first
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;

        // Then apply selected sort
        switch (sortOption) {
            case 'newest':
                return b.createdAt - a.createdAt;
            case 'oldest':
                return a.createdAt - b.createdAt;
            case 'title':
                return a.title.localeCompare(b.title);
            case 'artist':
                return a.artist.localeCompare(b.artist);
            case 'playCount':
                return (b.playCount || 0) - (a.playCount || 0);
            default:
                return 0;
        }
    });
  }, [songs, activeTab, activeGenre, searchQuery, sortOption]);

  // --- Player Controls & Logic ---
  
  const handleNext = () => {
    if (!currentSong || filteredSongs.length === 0) return;
    
    let nextIndex = -1;
    const currentIndex = filteredSongs.findIndex(s => s.id === currentSong.id);

    if (isShuffle) {
        // Pick random index, try to avoid current if possible
        if (filteredSongs.length > 1) {
            do {
                nextIndex = Math.floor(Math.random() * filteredSongs.length);
            } while (nextIndex === currentIndex);
        } else {
            nextIndex = 0;
        }
    } else {
        // Standard Next
        if (currentIndex < filteredSongs.length - 1) {
            nextIndex = currentIndex + 1;
        } else if (repeatMode === 'ALL') {
            // Loop back to start
            nextIndex = 0;
        }
    }

    if (nextIndex !== -1) {
        setCurrentSong(filteredSongs[nextIndex]);
        setIsPlaying(true);
    } else {
        // End of playlist and no repeat
        setIsPlaying(false);
    }
  };

  const handlePrev = () => {
    if (!currentSong || filteredSongs.length === 0) return;
    
    const currentIndex = filteredSongs.findIndex(s => s.id === currentSong.id);
    let prevIndex = -1;

    if (currentIndex > 0) {
        prevIndex = currentIndex - 1;
    } else if (repeatMode === 'ALL') {
        // Loop to end
        prevIndex = filteredSongs.length - 1;
    }

    if (prevIndex !== -1) {
        setCurrentSong(filteredSongs[prevIndex]);
        setIsPlaying(true);
    }
  };

  const handleSongEnd = () => {
    if (currentSong) {
      // 1. Increment Play Count in DB
      incrementSongPlayCount(currentSong.id);
    }
    // 2. Auto-advance (same logic as Next)
    handleNext();
  };

  const toggleShuffle = () => setIsShuffle(!isShuffle);
  
  const toggleRepeat = () => {
      setRepeatMode(prev => {
          if (prev === 'OFF') return 'ALL';
          if (prev === 'ALL') return 'ONE';
          return 'OFF';
      });
  };

  // Dynamic Background Renderer
  const renderBackground = () => {
    switch(currentTheme) {
       case 'PEACE_LIQUID': // New Emerald/Mint Animated Background
         return (
           <div className="fixed inset-0 bg-[#022c22] z-0 pointer-events-none overflow-hidden transition-colors duration-1000">
              <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-emerald-600/20 rounded-full blur-[120px] animate-blob" />
              <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-teal-600/20 rounded-full blur-[120px] animate-blob animation-delay-2000" />
              <div className="absolute top-[30%] left-[30%] w-[400px] h-[400px] bg-emerald-400/10 rounded-full blur-[80px] animate-blob animation-delay-4000" />
           </div>
         );
       case 'SAKURA_LIQUID':
         return (
           <div className="fixed inset-0 bg-[#1a0510] z-0 pointer-events-none overflow-hidden transition-colors duration-1000">
              <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-[#db2777]/30 rounded-full blur-[120px] animate-blob" />
              <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#9d174d]/30 rounded-full blur-[120px] animate-blob animation-delay-2000" />
           </div>
         );
       case 'NEON_LIQUID':
         return (
           <div className="fixed inset-0 bg-[#050505] z-0 pointer-events-none overflow-hidden transition-colors duration-1000">
              <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-cyan-600/10 rounded-full blur-[120px] animate-blob" />
              <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-green-600/10 rounded-full blur-[120px] animate-blob animation-delay-2000" />
           </div>
         );
       case 'PEARL_LIQUID':
         return (
           <div className="fixed inset-0 bg-[#f8fafc] z-0 pointer-events-none overflow-hidden transition-colors duration-1000">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white to-slate-200 opacity-80" />
           </div>
         );
       case 'DARK_LIQUID':
       default:
         return (
           <div className="fixed inset-0 bg-[#0f0720] z-0 pointer-events-none overflow-hidden transition-colors duration-1000">
             <div className="absolute top-[-20%] right-[-20%] w-[900px] h-[900px] bg-[#4c1d95]/20 rounded-full blur-[120px] animate-blob" />
             <div className="absolute bottom-[-10%] left-[-10%] w-[700px] h-[700px] bg-[#1e3a8a]/20 rounded-full blur-[120px] animate-blob animation-delay-2000" />
             <div className="absolute top-[40%] left-[30%] w-[400px] h-[400px] bg-white/5 rounded-full blur-[80px] animate-blob animation-delay-4000" />
             <div className="absolute inset-0 opacity-[0.05] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
           </div>
         );
    }
  };

  return (
    <div className={`min-h-screen relative flex flex-col transition-colors duration-1000 ${styles.appBg}`}>
      {renderBackground()}

      {/* --- Splash Screen --- */}
      <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black transition-opacity duration-1000 ${showSplash ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <div className="scale-150 mb-8">
            <div className="w-24 h-24 rounded-3xl flex items-center justify-center border border-white/20 bg-white/5 shadow-[0_0_50px_rgba(255,255,255,0.1)]">
               <Radio className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] animate-pulse" size={40} />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-widest uppercase animate-pulse">S-71 MusicLab</h1>
      </div>

      {/* --- Sticky Header --- */}
      <header className="sticky top-0 z-30 px-4 pt-4 pb-2 w-full max-w-4xl mx-auto">
        <div className="flex flex-col gap-4">
           
           {/* Row 1: Floating Title & Utilities (NO BG) */}
           <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.location.hash = '#/'}>
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] ${currentTheme === 'PEARL_LIQUID' ? 'bg-white text-black' : 'bg-white/5 text-white'}`}>
                   <Radio className="drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-pulse-slow" size={20} />
                </div>
                <h1 className={`text-2xl font-bold tracking-tight ${styles.textMain}`}>S-71 MusicLab</h1>
              </div>

              {/* Theme Switcher */}
              <div className="glass-chip rounded-full p-1 flex items-center gap-1">
                <button onClick={() => switchTheme('DARK_LIQUID')} className={`p-1.5 rounded-full transition-all hover:scale-110 ${currentTheme === 'DARK_LIQUID' ? 'bg-white text-black' : 'opacity-40 hover:opacity-100'}`}><Droplets size={14} /></button>
                <button onClick={() => switchTheme('SAKURA_LIQUID')} className={`p-1.5 rounded-full transition-all hover:scale-110 ${currentTheme === 'SAKURA_LIQUID' ? 'bg-pink-500 text-white' : 'opacity-40 hover:opacity-100'}`}><Flower2 size={14} /></button>
                <button onClick={() => switchTheme('NEON_LIQUID')} className={`p-1.5 rounded-full transition-all hover:scale-110 ${currentTheme === 'NEON_LIQUID' ? 'bg-cyan-500 text-black' : 'opacity-40 hover:opacity-100'}`}><Zap size={14} /></button>
                <button onClick={() => switchTheme('PEARL_LIQUID')} className={`p-1.5 rounded-full transition-all hover:scale-110 ${currentTheme === 'PEARL_LIQUID' ? 'bg-white text-black' : 'opacity-40 hover:opacity-100'}`}><Hexagon size={14} /></button>
                <button onClick={() => switchTheme('PEACE_LIQUID')} className={`p-1.5 rounded-full transition-all hover:scale-110 ${currentTheme === 'PEACE_LIQUID' ? 'bg-emerald-500 text-white' : 'opacity-40 hover:opacity-100'}`}><Leaf size={14} /></button>
              </div>
           </div>

           {/* Row 2: Floating Search Bar (NO BG, just outline/glass) */}
           <div className="relative w-full">
              <div className={`absolute left-4 top-1/2 -translate-y-1/2 opacity-50 ${styles.textMain}`}>
                 <Search size={18} />
              </div>
              <input 
                 type="text" 
                 placeholder="Search frequency..." 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className={`w-full h-12 rounded-2xl border bg-transparent pl-11 pr-4 text-sm transition-all shadow-inner focus:outline-none focus:ring-1 focus:ring-white/30 ${currentTheme === 'PEARL_LIQUID' ? 'border-gray-400/50 text-gray-900 placeholder:text-gray-500' : 'border-white/20 text-white placeholder:text-white/30'}`}
              />
           </div>

           {/* Row 3: Tabs & Genres (TRUE LIQUID CONTAINER) */}
           <div className={`${liquidClass} rounded-[2rem] p-4 flex flex-col gap-4 shadow-2xl transition-all duration-300`}>
             {/* Tabs - Added Halal */}
             <div className={`flex gap-4 border-b pb-1 px-1 overflow-x-auto scrollbar-hide ${currentTheme === 'PEARL_LIQUID' ? 'border-gray-300' : 'border-white/10'}`}>
                <button 
                  onClick={() => handleTabChange('Music')}
                  className={`flex-shrink-0 flex items-center gap-2 pb-2 text-sm font-bold tracking-widest uppercase transition-all border-b-2 hover:scale-105 active:scale-95 ${activeTab === 'Music' ? `border-current ${styles.textMain} drop-shadow-md` : 'border-transparent opacity-40 hover:opacity-80'}`}
                >
                  <Music size={16} /> Music
                </button>
                <button 
                  onClick={() => handleTabChange('Song')}
                  className={`flex-shrink-0 flex items-center gap-2 pb-2 text-sm font-bold tracking-widest uppercase transition-all border-b-2 hover:scale-105 active:scale-95 ${activeTab === 'Song' ? `border-current ${styles.textMain} drop-shadow-md` : 'border-transparent opacity-40 hover:opacity-80'}`}
                >
                  <Mic2 size={16} /> Songs
                </button>
                <button 
                  onClick={() => handleTabChange('Halal')}
                  className={`flex-shrink-0 flex items-center gap-2 pb-2 text-sm font-bold tracking-widest uppercase transition-all border-b-2 hover:scale-105 active:scale-95 ${activeTab === 'Halal' ? `border-current ${styles.textMain} drop-shadow-md` : 'border-transparent opacity-40 hover:opacity-80'}`}
                >
                  <Leaf size={16} /> Halal
                </button>
             </div>

             {/* Genre Chips - DYNAMIC based on Active Tab */}
             <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-1">
                <button 
                  onClick={() => handleGenreClick('All')} 
                  className={`flex-shrink-0 px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 border ${activeGenre === 'All' ? `${styles.accent} border-transparent shadow-lg` : `border-transparent opacity-60 hover:opacity-100 ${styles.textMain} hover:border-current hover:shadow-[0_0_10px_currentColor]`}`}
                  style={{ background: activeGenre !== 'All' ? 'transparent' : undefined }}
                >
                  All
                </button>
                
                {activeTab === 'Halal' ? (
                   // Show Halal Sub-Genres
                   HALAL_SUB_GENRES.map(g => (
                      <button 
                        key={g} 
                        onClick={() => handleGenreClick(g)} 
                        className={`flex-shrink-0 px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 border ${activeGenre === g ? `${styles.accent} border-transparent shadow-lg` : `border-transparent opacity-60 hover:opacity-100 ${styles.textMain} hover:border-current hover:shadow-[0_0_10px_currentColor]`}`}
                        style={{ background: activeGenre !== g ? 'transparent' : undefined }}
                      >
                        {g}
                      </button>
                   ))
                ) : (
                   // Show Standard Genres
                   GENRE_LIST.map(g => (
                      <button 
                        key={g} 
                        onClick={() => handleGenreClick(g)} 
                        className={`flex-shrink-0 px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 border ${activeGenre === g ? `${styles.accent} border-transparent shadow-lg` : `border-transparent opacity-60 hover:opacity-100 ${styles.textMain} hover:border-current hover:shadow-[0_0_10px_currentColor]`}`}
                        style={{ background: activeGenre !== g ? 'transparent' : undefined }}
                      >
                        {g}
                      </button>
                   ))
                )}
             </div>
           </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 w-full max-w-4xl mx-auto px-2">
        {route === '#/admin' ? (
          <AdminPanel theme={currentTheme} />
        ) : (
          <div className="flex flex-col h-full">
             {/* Sort & Count Bar */}
             <div className="flex items-center justify-between px-4 py-2">
                <span className={`text-[10px] font-bold uppercase tracking-widest opacity-60 ${styles.textMain}`}>{filteredSongs.length} tracks</span>
                
                <div className="relative">
                   <button 
                     onClick={() => setShowSortMenu(!showSortMenu)}
                     className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border ${styles.border} ${styles.textMain} hover:bg-white/10 transition-colors`}
                   >
                     <ListFilter size={12} /> Sort
                   </button>
                   
                   <AnimatePresence>
                     {showSortMenu && (
                       <motion.div 
                         initial={{ opacity: 0, y: 10, scale: 0.95 }}
                         animate={{ opacity: 1, y: 0, scale: 1 }}
                         exit={{ opacity: 0, y: 10, scale: 0.95 }}
                         className={`absolute right-0 top-full mt-2 w-48 p-2 rounded-xl border ${styles.border} ${styles.card} shadow-xl z-50 backdrop-blur-xl`}
                       >
                          <div className={`text-[10px] uppercase font-bold mb-2 px-2 opacity-50 ${styles.textSec}`}>Sort By</div>
                          {[
                            { id: 'newest', label: 'Newest First' },
                            { id: 'oldest', label: 'Oldest First' },
                            { id: 'title', label: 'Title (A-Z)' },
                            { id: 'artist', label: 'Artist (A-Z)' },
                            { id: 'playCount', label: 'Most Played' },
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => { setSortOption(opt.id as SortOption); setShowSortMenu(false); }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-between ${sortOption === opt.id ? styles.accent : `hover:bg-white/10 ${styles.textMain}`}`}
                            >
                              {opt.label}
                              {sortOption === opt.id && <ArrowUpDown size={12} />}
                            </button>
                          ))}
                       </motion.div>
                     )}
                   </AnimatePresence>
                </div>
             </div>

             {/* Swipeable Content Area */}
             <motion.div 
               className="flex-1 touch-pan-y"
               drag="x"
               dragConstraints={{ left: 0, right: 0 }}
               dragElastic={0.2}
               dragDirectionLock
               onDragEnd={handleDragEnd}
             >
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <SongList 
                    songs={filteredSongs} loading={loading} onPlay={(s) => { if(currentSong?.id !== s.id) { setCurrentSong(s); setIsPlaying(true); } else setIsPlaying(!isPlaying); }} 
                    currentSong={currentSong} isPlaying={isPlaying} isPlayerLoading={isPlayerLoading} theme={currentTheme}
                  />
                </div>
             </motion.div>
          </div>
        )}
      </main>

      <Footer theme={currentTheme} />
      
      {/* Spacer to prevent Footer from being hidden by the mini-player */}
      {currentSong && <div className="h-24 w-full" />}
      
      <Player 
        currentSong={currentSong} 
        isPlaying={isPlaying} 
        onPlayPause={() => setIsPlaying(!isPlaying)}
        onNext={handleNext} 
        onPrev={handlePrev} 
        onSongEnd={handleSongEnd} 
        theme={currentTheme}
        onLoadingChange={setIsPlayerLoading}
        allSongs={filteredSongs} // Pass the current list for Up Next
        isShuffle={isShuffle}
        repeatMode={repeatMode}
        onToggleShuffle={toggleShuffle}
        onToggleRepeat={toggleRepeat}
      />
    </div>
  );
};

export default App;