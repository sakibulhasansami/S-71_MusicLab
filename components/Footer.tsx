import React, { useEffect, useState } from 'react';
import { Facebook, Twitter, Github, Instagram, Youtube, Settings, Globe, Link as LinkIcon } from 'lucide-react';
import { subscribeToSettings } from '../services/firebase';
import { SiteSettings, Theme } from '../types';
import { getThemeStyles } from '../utils';

interface FooterProps {
  theme: Theme;
}

const Footer: React.FC<FooterProps> = ({ theme }) => {
  const styles = getThemeStyles(theme);

  // Default Initial State
  const [settings, setSettings] = useState<SiteSettings>({
    copyrightText: "© 2026 S-71 MusicLab. All Rights Reserved.",
    facebookUrl: "",
    twitterUrl: "",
    instagramUrl: "",
    githubUrl: "",
    youtubeUrl: "",
    s71StudioUrl: "",
    customLinks: [],
    baseTheme: 'CYAN'
  });

  useEffect(() => {
    const unsubscribe = subscribeToSettings((data) => {
      if (data) {
        // ফায়ারবেস থেকে আসা ডেটাকে স্টেটে সেট করা হচ্ছে
        setSettings(prev => ({ ...prev, ...data }));
      }
    });
    return () => unsubscribe();
  }, []);

  const navigateToAdmin = (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.hash = '#/admin';
  };

  // Helper: URL ক্লিন করার ফাংশন
  const processUrl = (url: any): string | null => {
    if (!url || typeof url !== 'string') return null;
    const cleanUrl = url.trim();
    if (cleanUrl.length === 0) return null;

    if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) return cleanUrl;
    return `https://${cleanUrl}`;
  };

    // ডাইনামিকালি সব ধরনের কী (Key) চেক করার জন্য এই লজিক
  const socialLinks = [
    { icon: Facebook, url: settings.facebookUrl || (settings as any).FacebookUrl, id: 'fb' },
    { icon: Twitter, url: settings.twitterUrl || (settings as any).TwitterUrl, id: 'tw' },
    { icon: Instagram, url: settings.instagramUrl || (settings as any).InstagramUrl, id: 'ig' },
    { icon: Github, url: settings.githubUrl || (settings as any).GithubUrl, id: 'gh' },
    { icon: Youtube, url: settings.youtubeUrl || (settings as any).YoutubeUrl, id: 'yt' },
  ];

  return (
    <footer className={`relative z-10 w-full px-4 pb-4 pt-12 mt-auto text-center ${styles.textMain}`}>
      <div className={`bg-white/5 backdrop-blur-[50px] border border-white/10 max-w-5xl mx-auto rounded-[2.5rem] p-8 shadow-2xl transition-all duration-500`}>

        {/* Social Media Section */}
        <div className="flex flex-wrap items-center justify-center gap-6 mb-8">
          {socialLinks.map((item) => {
            const validUrl = processUrl(item.url);

            // যদি URL থাকে তবেই আইকন দেখাবে
            if (!validUrl) return null;

            return (
               <a 
                  key={item.id} 
                  href={validUrl} 
                  target="_blank"
                  rel="noopener noreferrer" 
                  className={`p-3 rounded-full transition-all duration-300 ${styles.iconBg} hover:scale-110 hover:bg-white/10 opacity-100 cursor-pointer shadow-lg`}
                >
                  <item.icon size={20} />
                </a>
            );
          })}

          {/* Custom Links (Admin থেকে অ্যাড করলে এখানে আসবে) */}
          {settings.customLinks && settings.customLinks.map((link) => {
             const validCustomUrl = processUrl(link.url);
             if (!validCustomUrl) return null;

             return (
               <a 
                 key={link.id}
                 href={validCustomUrl} 
                 target="_blank" 
                 rel="noopener noreferrer" 
                 title={link.label}
                 className={`p-3 rounded-full transition-all duration-300 hover:scale-110 hover:bg-white/10 ${styles.iconBg} group relative shadow-lg cursor-pointer`}
               >
                  <Globe size={20} className="opacity-80 hover:opacity-100" />
                  <span className="absolute -top-10 left-1/2 -translate-x-1/2 text-[10px] bg-black/90 text-white px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl">
                    {link.label}
                  </span>
               </a>
             );
          })}
        </div>

        {/* Separator Line */}
        <div className={`h-px w-full max-w-md mx-auto mb-6 bg-gradient-to-r from-transparent via-white/10 to-transparent`} />

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs md:text-sm">

          {/* Copyright Text */}
          <div className={`opacity-60 order-2 md:order-1 ${styles.textSec}`}>
            {settings.copyrightText}
          </div>

          {/* S-71 Studio Branding */}
          <div className="flex items-center gap-2 order-1 md:order-2">
            <span className="opacity-50 uppercase tracking-widest text-[10px]">Powered by</span>
            {processUrl(settings.s71StudioUrl) ? (
              <a 
                href={processUrl(settings.s71StudioUrl)!} 
                target="_blank" 
                rel="noopener noreferrer" 
                className={`font-bold tracking-wider text-glow drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] transition-opacity hover:opacity-80 ${theme === 'PEARL_LIQUID' ? 'text-black' : 'text-white'}`}
              >
                S-71 Studio
              </a>
            ) : (
              <span className={`font-bold tracking-wider text-glow drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] ${theme === 'PEARL_LIQUID' ? 'text-black' : 'text-white'}`}>
                S-71 Studio
              </span>
            )}
          </div>

        </div>

        {/* Admin Link */}
        <div className={`absolute bottom-4 right-6 transition-all duration-300 ${styles.textSec} opacity-50 hover:opacity-100`}>
           <button 
             onClick={navigateToAdmin} 
             className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest cursor-pointer"
             title="Admin Access"
           >
             <Settings size={10} /> Admin
           </button>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
