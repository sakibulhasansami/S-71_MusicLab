export type MediaType = 'Music' | 'Song' | 'Halal';

export interface Song {
  id: string;
  title: string;
  artist: string;
  originalUrl: string;
  directUrl: string;
  createdAt: number;
  type: MediaType;
  genre: string;
  subGenre?: string; // New field for Halal ecosystem
  duration?: string;
  playCount?: number; // Track popularity
  lyrics?: string; // New: Song Lyrics
  imageUrl?: string; // New: Custom Artwork URL
  isPinned?: boolean; // New: Admin Pin feature
}

export type SortOption = 'newest' | 'oldest' | 'title' | 'artist' | 'playCount';

export type RepeatMode = 'OFF' | 'ALL' | 'ONE';

export interface CustomLink {
  id: string;
  label: string;
  url: string;
}

export interface SiteSettings {
  copyrightText: string;
  facebookUrl: string;
  twitterUrl: string;
  githubUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  s71StudioUrl?: string; // New: Customizable link for branding
  customLinks?: CustomLink[]; // New: Dynamic social links
  baseTheme: 'CYAN' | 'ORANGE' | 'PURPLE' | 'EMERALD'; // Kept for legacy compatibility if needed
}

export type ViewState = 'HOME' | 'ADMIN';

// The 5 True Liquid Glass Themes
export type Theme = 'DARK_LIQUID' | 'SAKURA_LIQUID' | 'NEON_LIQUID' | 'PEARL_LIQUID' | 'PEACE_LIQUID';

export interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  progress: number;
  volume: number;
  duration: number;
  isExpanded: boolean;
}
