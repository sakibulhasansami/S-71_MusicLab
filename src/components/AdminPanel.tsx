import React, { useState, useEffect } from 'react';
import { convertDriveLink, getThemeStyles } from '../utils';
import { addSongToFirestore, updateSiteSettings, subscribeToSettings, loginUser, logoutUser, subscribeToAuth, subscribeToSongs, togglePinSong, deleteSong } from '../services/firebase';
import { UploadCloud, CheckCircle, AlertCircle, Link as LinkIcon, Lock, Music, Mic2, Tag, Settings, Save, Globe, Palette, LogOut, Share2, ArrowLeft, Plus, X, Image as ImageIcon, FileText, Leaf, Trash2, Pin, Search } from 'lucide-react';
import { MediaType, SiteSettings, Theme, CustomLink, Song } from '../types';

// Removed "Halal" from standard genres
const GENRE_OPTIONS = ["Pop", "Rock", "Instrumental", "Lo-fi", "Electronic", "Folk", "Acoustic"];
const HALAL_SUB_GENRES = ["Nasheed", "Islamic Pop", "Quran Recitation", "Spoken Word", "Lofi Nasheed"];
const THEME_OPTIONS = ['CYAN', 'ORANGE', 'PURPLE', 'EMERALD'];

interface AdminPanelProps {
  theme: Theme;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ theme }) => {
  const styles = getThemeStyles(theme);
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState<'UPLOAD' | 'SETTINGS' | 'MANAGE'>('UPLOAD');
  
  // Data State
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('Song');
  const [genre, setGenre] = useState(GENRE_OPTIONS[0]);
  const [subGenre, setSubGenre] = useState(''); 
  
  // Manage State
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [manageSearch, setManageSearch] = useState('');

  // Settings State
  const [settings, setSettings] = useState<SiteSettings>({
    copyrightText: '',
    facebookUrl: '',
    twitterUrl: '',
    instagramUrl: '',
    githubUrl: '',
    youtubeUrl: '',
    s71StudioUrl: '',
    customLinks: [],
    baseTheme: 'CYAN'
  });
  
  // Custom Link Local State for adding new one
  const [newLinkName, setNewLinkName] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  // Persistent Auth Listener
  useEffect(() => {
    const unsubscribeAuth = subscribeToAuth((u) => {
      setUser(u);
      if (u) {
        // Clear sensitive fields on login
        setEmail('');
        setPassword('');
        setStatus('idle');
      }
    });
    const unsubscribeSettings = subscribeToSettings((data) => { if(data) setSettings(data); });
    const unsubscribeSongs = subscribeToSongs((songs) => setAllSongs(songs));
    
    return () => { unsubscribeAuth(); unsubscribeSettings(); unsubscribeSongs(); };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setStatusMsg('');

    try {
      await loginUser(email, password);
      setStatus('idle');
    } catch (error: any) {
      console.error("Login Error:", error);
      setStatus('error');
      const errorMsg = "Login Failed: Invalid Email or Password.";
      setStatusMsg(errorMsg);
      alert(errorMsg);
    }
  };

  const handleLogout = async () => {
    try { await logoutUser(); } catch (error) { console.error("Logout Error:", error); }
  };

  const handleBackToLibrary = () => { window.location.hash = '#/'; };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    const directUrl = convertDriveLink(audioUrl);
    if (!directUrl) { setStatus('error'); setStatusMsg('Invalid URL.'); return; }
    try {
      // Logic: If Type is Halal, Genre is automatically 'Halal', and we use subGenre for specifics
      const finalGenre = mediaType === 'Halal' ? 'Halal' : genre;
      const finalSubGenre = mediaType === 'Halal' ? subGenre : undefined;

      await addSongToFirestore({ 
        title, 
        artist, 
        originalUrl: audioUrl, 
        directUrl, 
        imageUrl,
        lyrics,
        type: mediaType, 
        genre: finalGenre,
        subGenre: finalSubGenre 
      });
      setStatus('success'); setStatusMsg('Track added!'); 
      // Reset Form
      setTitle(''); setArtist(''); setAudioUrl(''); setImageUrl(''); setLyrics('');
      setTimeout(() => { setStatus('idle'); setStatusMsg(''); }, 3000);
    } catch (error: any) { setStatus('error'); setStatusMsg(error.message); }
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try { await updateSiteSettings(settings); setStatus('success'); setStatusMsg('Settings Saved!'); setTimeout(() => { setStatus('idle'); setStatusMsg(''); }, 3000); } 
    catch (error: any) { setStatus('error'); setStatusMsg(error.message); }
  };
  
  const handleTogglePin = async (song: Song) => {
      try {
          await togglePinSong(song.id, song.isPinned || false);
      } catch (e) {
          alert("Failed to toggle pin");
      }
  };

  const handleDelete = async (songId: string) => {
      if(confirm("Are you sure you want to delete this track?")) {
          try {
              await deleteSong(songId);
          } catch (e) {
              alert("Failed to delete");
          }
      }
  };

  // Add Custom Link
  const addCustomLink = () => {
    if (!newLinkName || !newLinkUrl) return;
    const newLink: CustomLink = {
      id: Date.now().toString(),
      label: newLinkName,
      url: newLinkUrl
    };
    setSettings(prev => ({
      ...prev,
      customLinks: [...(prev.customLinks || []), newLink]
    }));
    setNewLinkName('');
    setNewLinkUrl('');
  };

  // Remove Custom Link
  const removeCustomLink = (id: string) => {
    setSettings(prev => ({
      ...prev,
      customLinks: (prev.customLinks || []).filter(l => l.id !== id)
    }));
  };
  
  const filteredManageSongs = allSongs.filter(s => 
      s.title.toLowerCase().includes(manageSearch.toLowerCase()) || 
      s.artist.toLowerCase().includes(manageSearch.toLowerCase())
  );

  if (!user) {
    return (
      <div className={`min-h-[60vh] flex flex-col items-center justify-center p-4 relative`}>
        <button onClick={handleBackToLibrary} className={`absolute top-4 left-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${styles.textSec} hover:text-white transition-colors`}>
           <ArrowLeft size={16} /> Back to Library
        </button>
        <form onSubmit={handleLogin} className={`p-8 w-full max-w-md text-center rounded-3xl ${styles.card}`}>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${styles.iconBg}`}><Lock size={32} /></div>
          <h2 className={`text-2xl font-bold mb-2 ${styles.textMain}`}>Secure Admin</h2>
          <p className={`text-xs mb-6 ${styles.textSec}`}>Restricted Access Only</p>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={`w-full p-3 rounded-xl mb-3 text-center ${styles.border} bg-transparent ${styles.textMain} border focus:outline-none placeholder:opacity-50`} required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className={`w-full p-3 rounded-xl mb-6 text-center ${styles.border} bg-transparent ${styles.textMain} border focus:outline-none placeholder:opacity-50`} required />
          <button type="submit" disabled={status === 'loading'} className={`w-full py-3 rounded-xl font-bold ${styles.accent}`}>{status === 'loading' ? 'Verifying...' : 'Login'}</button>
          {status === 'error' && <p className="text-red-400 text-sm mt-4 font-bold">{statusMsg}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className={`max-w-2xl mx-auto p-4 pb-24`}>
      <div className="mb-8 flex items-center justify-between">
        <div><h2 className={`text-3xl font-bold ${styles.textMain}`}>Admin Panel</h2></div>
        <div className="flex gap-2">
            <button onClick={handleLogout} className={`text-sm border px-4 py-2 rounded-full ${styles.border} ${styles.textMain} hover:bg-white/10`}>Logout</button>
            <button onClick={() => { window.location.hash = '#/' }} className={`text-sm border px-4 py-2 rounded-full ${styles.border} ${styles.textMain} hover:bg-white/10`}>Exit</button>
        </div>
      </div>

      <div className={`flex mb-8 p-1 rounded-2xl border ${styles.border} ${styles.iconBg}`}>
        {['UPLOAD', 'SETTINGS', 'MANAGE'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === tab ? styles.accent : 'opacity-60'}`}>{tab}</button>
        ))}
      </div>

      {activeTab === 'UPLOAD' ? (
        <form onSubmit={handleUploadSubmit} className={`space-y-6 p-6 rounded-3xl ${styles.card}`}>
          {/* ... Upload Form Inputs ... */}
          <div className="grid grid-cols-2 gap-4">
             <div>
               <label className={`block text-xs uppercase mb-2 ${styles.textSec}`}>Type</label>
               <div className="flex gap-2">
                 {/* Added Halal to Types */}
                 {['Music', 'Song', 'Halal'].map(t => (
                   <button key={t} type="button" onClick={() => setMediaType(t as any)} className={`flex-1 py-2 rounded-lg text-[10px] md:text-sm border font-bold uppercase ${mediaType === t ? styles.accent : styles.border + ' ' + styles.textSec}`}>{t}</button>
                 ))}
               </div>
             </div>
             <div>
               <label className={`block text-xs uppercase mb-2 ${styles.textSec}`}>
                  {mediaType === 'Halal' ? 'Category' : 'Genre'}
               </label>
               
               {mediaType === 'Halal' ? (
                  // If Type is Halal, show Sub-Genre list as main selector
                  <select value={subGenre} onChange={(e) => setSubGenre(e.target.value)} className={`w-full p-2 rounded-lg bg-transparent border ${styles.border} ${styles.textMain}`}>
                     <option value="" className="bg-black text-white">Select Category...</option>
                     {HALAL_SUB_GENRES.map(g => <option key={g} value={g} className="bg-black text-white">{g}</option>)}
                  </select>
               ) : (
                  // Else show standard genres (Halal removed)
                  <select value={genre} onChange={(e) => setGenre(e.target.value)} className={`w-full p-2 rounded-lg bg-transparent border ${styles.border} ${styles.textMain}`}>
                      {GENRE_OPTIONS.map(g => <option key={g} value={g} className="bg-black text-white">{g}</option>)}
                  </select>
               )}
             </div>
          </div>

          <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className={`w-full p-3 rounded-xl bg-transparent border ${styles.border} ${styles.textMain}`} required />
          <input type="text" placeholder="Artist" value={artist} onChange={(e) => setArtist(e.target.value)} className={`w-full p-3 rounded-xl bg-transparent border ${styles.border} ${styles.textMain}`} required />
          <input type="url" placeholder="Audio URL (Archive.org / Drive)" value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)} className={`w-full p-3 rounded-xl bg-transparent border ${styles.border} ${styles.textMain}`} required />
          
          {/* New Fields */}
          <div className="space-y-4 pt-4 border-t border-white/10">
            <div>
               <label className={`block text-xs uppercase mb-2 ${styles.textSec} flex items-center gap-1`}><ImageIcon size={12}/> Artwork URL (Direct Link)</label>
               <input type="url" placeholder="https://i.ibb.co/..." value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={`w-full p-3 rounded-xl bg-transparent border ${styles.border} ${styles.textMain} text-sm`} />
            </div>
            <div>
               <label className={`block text-xs uppercase mb-2 ${styles.textSec} flex items-center gap-1`}><FileText size={12}/> Lyrics</label>
               <textarea rows={4} placeholder="Paste lyrics here..." value={lyrics} onChange={(e) => setLyrics(e.target.value)} className={`w-full p-3 rounded-xl bg-transparent border ${styles.border} ${styles.textMain} text-sm`} />
            </div>
          </div>

          <button type="submit" disabled={status === 'loading'} className={`w-full py-4 rounded-xl font-bold ${styles.accent}`}>{status === 'loading' ? '...' : 'Upload Track'}</button>
        </form>
      ) : activeTab === 'SETTINGS' ? (
        <form onSubmit={handleSettingsSubmit} className={`space-y-6 p-6 rounded-3xl ${styles.card}`}>
           
           {/* General Settings same as before */}
           <div className="space-y-3">
              <h3 className={`text-sm uppercase font-bold flex items-center gap-2 ${styles.textMain}`}><Settings size={14}/> General</h3>
              <input type="text" placeholder="Copyright Text" value={settings.copyrightText} onChange={(e) => setSettings({...settings, copyrightText: e.target.value})} className={`w-full p-3 rounded-xl bg-transparent border ${styles.border} ${styles.textMain}`} />
           </div>

           <div className="space-y-3 pt-4 border-t border-white/10">
              <h3 className={`text-sm uppercase font-bold flex items-center gap-2 ${styles.textMain}`}><Globe size={14}/> S-71 Branding</h3>
              <p className={`text-xs ${styles.textSec}`}>Set the URL for the "Powered by S-71 Studio" footer link.</p>
              <input type="url" placeholder="S-71 Studio Website URL" value={settings.s71StudioUrl || ''} onChange={(e) => setSettings({...settings, s71StudioUrl: e.target.value})} className={`w-full p-3 rounded-xl bg-transparent border ${styles.border} ${styles.textMain}`} />
           </div>

           <div className="space-y-3 pt-4 border-t border-white/10">
              <h3 className={`text-sm uppercase font-bold flex items-center gap-2 ${styles.textMain}`}><Share2 size={14}/> Social Media Links</h3>
              <p className={`text-xs ${styles.textSec}`}>Leave empty to hide. Add custom links below.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Social inputs */}
                  <div>
                      <label className={`block text-[10px] uppercase font-bold mb-1 ml-1 ${styles.textSec}`}>Facebook</label>
                      <input type="url" placeholder="https://facebook.com/..." value={settings.facebookUrl} onChange={(e) => setSettings({...settings, facebookUrl: e.target.value})} className={`w-full p-3 rounded-xl bg-transparent border ${styles.border} ${styles.textMain} text-sm`} />
                  </div>
                  <div>
                      <label className={`block text-[10px] uppercase font-bold mb-1 ml-1 ${styles.textSec}`}>Twitter / X</label>
                      <input type="url" placeholder="https://x.com/..." value={settings.twitterUrl} onChange={(e) => setSettings({...settings, twitterUrl: e.target.value})} className={`w-full p-3 rounded-xl bg-transparent border ${styles.border} ${styles.textMain} text-sm`} />
                  </div>
                  <div>
                      <label className={`block text-[10px] uppercase font-bold mb-1 ml-1 ${styles.textSec}`}>Instagram</label>
                      <input type="url" placeholder="https://instagram.com/..." value={settings.instagramUrl} onChange={(e) => setSettings({...settings, instagramUrl: e.target.value})} className={`w-full p-3 rounded-xl bg-transparent border ${styles.border} ${styles.textMain} text-sm`} />
                  </div>
                  <div>
                      <label className={`block text-[10px] uppercase font-bold mb-1 ml-1 ${styles.textSec}`}>GitHub</label>
                      <input type="url" placeholder="https://github.com/..." value={settings.githubUrl} onChange={(e) => setSettings({...settings, githubUrl: e.target.value})} className={`w-full p-3 rounded-xl bg-transparent border ${styles.border} ${styles.textMain} text-sm`} />
                  </div>
                  <div className="md:col-span-2">
                      <label className={`block text-[10px] uppercase font-bold mb-1 ml-1 ${styles.textSec}`}>YouTube</label>
                      <input type="url" placeholder="https://youtube.com/..." value={settings.youtubeUrl} onChange={(e) => setSettings({...settings, youtubeUrl: e.target.value})} className={`w-full p-3 rounded-xl bg-transparent border ${styles.border} ${styles.textMain} text-sm`} />
                  </div>
              </div>

              {/* Custom Links Manager */}
              <div className="mt-6">
                <h4 className={`text-xs uppercase font-bold mb-3 ${styles.textSec}`}>Custom Links</h4>
                
                {settings.customLinks && settings.customLinks.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {settings.customLinks.map(link => (
                      <div key={link.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10">
                        <Globe size={14} className={styles.textSec} />
                        <span className={`text-xs flex-1 ${styles.textMain} font-bold`}>{link.label}</span>
                        <span className={`text-xs flex-1 truncate opacity-50 ${styles.textSec}`}>{link.url}</span>
                        <button type="button" onClick={() => removeCustomLink(link.id)} className="p-1 hover:bg-red-500/20 hover:text-red-400 rounded transition-colors"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                   <input type="text" placeholder="Name (e.g. Website)" value={newLinkName} onChange={(e) => setNewLinkName(e.target.value)} className={`flex-1 p-2 rounded-lg bg-transparent border ${styles.border} ${styles.textMain} text-sm`} />
                   <input type="url" placeholder="URL (https://...)" value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} className={`flex-[2] p-2 rounded-lg bg-transparent border ${styles.border} ${styles.textMain} text-sm`} />
                   <button type="button" onClick={addCustomLink} className={`p-2 rounded-lg ${styles.accent} flex items-center justify-center`}><Plus size={18} /></button>
                </div>
              </div>

           </div>

           <button type="submit" disabled={status === 'loading'} className={`w-full py-4 rounded-xl font-bold ${styles.accent}`}>{status === 'loading' ? 'Saving...' : 'Save Settings'}</button>
        </form>
      ) : (
          <div className={`space-y-6 p-6 rounded-3xl ${styles.card}`}>
              <div className="flex items-center gap-2 mb-4">
                  <Search className={styles.textSec} size={18} />
                  <input 
                      type="text" 
                      placeholder="Search tracks to manage..." 
                      value={manageSearch}
                      onChange={(e) => setManageSearch(e.target.value)}
                      className={`w-full p-3 rounded-xl bg-transparent border ${styles.border} ${styles.textMain}`}
                  />
              </div>
              
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                  {filteredManageSongs.map(song => (
                      <div key={song.id} className={`flex items-center justify-between p-3 rounded-xl border ${styles.border} bg-white/5`}>
                          <div className="flex-1 min-w-0 mr-4">
