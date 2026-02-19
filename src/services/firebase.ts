import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  setDoc,
  updateDoc,
  doc,
  increment,
  onSnapshot, 
  query, 
  orderBy,
  Firestore,
  serverTimestamp
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  User,
  Auth
} from 'firebase/auth';
import { Song, SiteSettings } from '../types';

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;

export const initFirebase = (config: any) => {
  if (!getApps().length) {
    try {
      app = initializeApp(config);
      db = getFirestore(app);
      auth = getAuth(app);
      return true;
    } catch (error) {
      console.error("Firebase init error:", error);
      return false;
    }
  }
  return true;
};

export const getDb = () => db;
export const getAuthInstance = () => auth;

// --- Auth ---

export const loginUser = (email: string, pass: string) => {
  if (!auth) throw new Error("Auth not initialized");
  return signInWithEmailAndPassword(auth, email, pass);
};

export const logoutUser = () => {
  if (!auth) throw new Error("Auth not initialized");
  return signOut(auth);
};

export const subscribeToAuth = (callback: (user: User | null) => void) => {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
};

// --- Tracks ---

export const subscribeToSongs = (callback: (songs: Song[]) => void) => {
  if (!db) return () => {};
  const q = query(collection(db, 'tracks'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const songs: Song[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Song));
    callback(songs);
  });
};

export const addSongToFirestore = async (songData: Omit<Song, 'id' | 'createdAt'>) => {
  if (!db) throw new Error("Database not initialized");
  await addDoc(collection(db, 'tracks'), {
    ...songData,
    playCount: 0,
    createdAt: serverTimestamp()
  });
};

export const incrementSongPlayCount = async (songId: string) => {
  if (!db) return;
  const songRef = doc(db, 'tracks', songId);
  try {
    await updateDoc(songRef, {
      playCount: increment(1)
    });
  } catch (error) {
    console.error("Error incrementing play count:", error);
  }
};

export const togglePinSong = async (songId: string, currentStatus: boolean) => {
  if (!db) return;
  const songRef = doc(db, 'tracks', songId);
  try {
    await updateDoc(songRef, {
      isPinned: !currentStatus
    });
  } catch (error) {
    console.error("Error toggling pin:", error);
    throw error;
  }
};

export const deleteSong = async (songId: string) => {
  if (!db) return;
  const songRef = doc(db, 'tracks', songId);
  try {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(songRef);
  } catch (error) {
    console.error("Error deleting song:", error);
    throw error;
  }
};

// --- Site Settings ---

export const subscribeToSettings = (callback: (settings: SiteSettings) => void) => {
  if (!db) return () => {};
  const docRef = doc(db, 'site_settings', 'global');
  
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      // Merge with defaults to ensure new fields exist
      callback({
        copyrightText: data.copyrightText || "© 2026 S-71 MusicLab. All Rights Reserved.",
        facebookUrl: data.facebookUrl || "",
        twitterUrl: data.twitterUrl || "",
        githubUrl: data.githubUrl || "",
        instagramUrl: data.instagramUrl || "",
        youtubeUrl: data.youtubeUrl || "",
        s71StudioUrl: data.s71StudioUrl || "",
        customLinks: data.customLinks || [],
        baseTheme: data.baseTheme || 'CYAN'
      } as SiteSettings);
    } else {
      // Default fallback
      callback({
        copyrightText: "© 2026 S-71 MusicLab. All Rights Reserved.",
        facebookUrl: "",
        twitterUrl: "",
        githubUrl: "",
        instagramUrl: "",
        youtubeUrl: "",
        s71StudioUrl: "",
        customLinks: [],
        baseTheme: 'CYAN'
      });
    }
  });
};

export const updateSiteSettings = async (settings: SiteSettings) => {
  if (!db) throw new Error("Database not initialized");
  await setDoc(doc(db, 'site_settings', 'global'), settings);
};
