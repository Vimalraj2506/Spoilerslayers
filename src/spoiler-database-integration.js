// Firebase Integration for Spoiler Database in Chrome Extension
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
  arrayUnion,
  arrayRemove,
  serverTimestamp
} from 'firebase/firestore';

// Your Firebase configuration - replace with your own values
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/**
 * User authentication and profile management
 */
class UserManager {
  constructor() {
    this.currentUser = null;
    this.userPreferences = null;
    this.authStateListeners = [];
    
    // Set up auth state listener
    onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      if (user) {
        this.loadUserPreferences();
      } else {
        this.userPreferences = null;
      }
      
      // Notify listeners
      this.authStateListeners.forEach(listener => listener(user));
    });
  }
  
  // Add auth state change listener
  addAuthStateListener(listener) {
    this.authStateListeners.push(listener);
    // Call immediately with current state
    listener(this.currentUser);
    return () => {
      this.authStateListeners = this.authStateListeners.filter(l => l !== listener);
    };
  }
  
  // Sign in user
  async signIn(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: userCredential.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  // Create new user
  async signUp(email, password) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create initial user preferences
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email: email,
        createdAt: serverTimestamp(),
        preferences: {
          hideMediaIds: [],
          globalKeywords: []
        },
        mediaKeywords: {},
        activeFilters: []
      });
      
      return { success: true, user: userCredential.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  // Sign out user
  async signOut() {
    try {
      await signOut(auth);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  // Load user preferences
  async loadUserPreferences() {
    if (!this.currentUser) return null;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', this.currentUser.uid));
      if (userDoc.exists()) {
        this.userPreferences = userDoc.data();
        return this.userPreferences;
      } else {
        console.warn('User document does not exist for authenticated user');
        return null;
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
      return null;
    }
  }
  
  // Get current user ID
  getUserId() {
    return this.currentUser ? this.currentUser.uid : null;
  }
  
  // Check if user is logged in
  isLoggedIn() {
    return !!this.currentUser;
  }
}

/**
 * Media and spoilers database management
 */
class SpoilerDatabase {
  constructor(userManager) {
    this.userManager = userManager;
    this.cachedMedia = new Map();
  }
  
  // Search for media by title
  async searchMedia(query, maxResults = 10) {
    if (!query || query.length < 2) return [];
    
    try {
      const searchQuery = query.toLowerCase().trim().replace(/[^\w\s]/g, '');
      
      // Search in the title index
      const querySnapshot = await getDocs(
        collection(db, 'searchIndex', 'titles', searchQuery)
      );
      
      if (querySnapshot.empty) return [];
      
      // Get media details for each result
      const mediaPromises = querySnapshot.docs.map(async doc => {
        const { mediaId } = doc.data();
        
        // Check cache first
        if (this.cachedMedia.has(mediaId)) {
          return this.cachedMedia.get(mediaId);
        }
        
        // Fetch from Firestore
        const mediaDoc = await getDoc(doc(db, 'media', mediaId));
        if (mediaDoc.exists()) {
          const mediaData = {
            id: mediaDoc.id,
            ...mediaDoc.data()
          };
          
          // Cache the result
          this.cachedMedia.set(mediaId, mediaData);
          return mediaData;
        }
        return null;
      });
      
      const mediaResults = await Promise.all(mediaPromises);
      return mediaResults
        .filter(Boolean)
        .slice(0, maxResults);
      
    } catch (error) {
      console.error('Error searching media:', error);
      return [];
    }
  }
  
  // Get popular media
  async getPopularMedia(mediaType = 'all', maxResults = 10) {
    try {
      let mediaQuery;
      
      if (mediaType === 'all') {
        mediaQuery = query(
          collection(db, 'media'),
          where('popularity', '>', 10),
          limit(maxResults)
        );
      } else {
        mediaQuery = query(
          collection(db, 'media'),
          where('mediaType', '==', mediaType),
          where('popularity', '>', 10),
          limit(maxResults)
        );
      }
      
      const querySnapshot = await getDocs(mediaQuery);
      
      return querySnapshot.docs.map(doc => {
        const data = {
          id: doc.id,
          ...doc.data()
        };
        
        // Cache the result
        this.cachedMedia.set(doc.id, data);
        return data;
      });
      
    } catch (error) {
      console.error('Error getting popular media:', error);
      return [];
    }
  }
  
  // Get media details by ID
  async getMediaById(mediaId) {
    try {
      // Check cache first
      if (this.cachedMedia.has(mediaId)) {
        return this.cachedMedia.get(mediaId);
      }
      
      const mediaDoc = await getDoc(doc(db, 'media', mediaId));
      if (mediaDoc.exists()) {
        const mediaData = {
          id: mediaDoc.id,
          ...mediaDoc.data()
        };
        
        // Cache the result
        this.cachedMedia.set(mediaId, mediaData);
        return mediaData;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting media by ID:', error);
      return null;
    }
  }
  
  // Add keyword to user's personal media keywords
  async addUserKeyword(mediaId, keyword) {
    const userId = this.userManager.getUserId();
    if (!userId) return { success: false, error: 'User not logged in' };
    
    try {
      const userRef = doc(db, 'users', userId);
      
      await updateDoc(userRef, {
        [`mediaKeywords.${mediaId}`]: arrayUnion(keyword)
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error adding user keyword:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Add keyword to global user preferences
  async addGlobalKeyword(keyword) {
    const userId = this.userManager.getUserId();
    if (!userId) return { success: false, error: 'User not logged in' };
    
    try {
      const userRef = doc(db, 'users', userId);
      
      await updateDoc(userRef, {
        'preferences.globalKeywords': arrayUnion(keyword)
      });
      
      // Update active filters as well
      await updateDoc(userRef, {
        activeFilters: arrayUnion(keyword)
      });
      
      // Update local storage for content script
      await this.syncActiveFiltersToStorage();
      
      return { success: true };
    } catch (error) {
      console.error('Error adding global keyword:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Remove keyword from global user preferences
  async removeGlobalKeyword(keyword) {
    const userId = this.userManager.getUserId();
    if (!userId) return { success: false, error: 'User not logged in' };
    
    try {
      const userRef = doc(db, 'users', userId);
      
      await updateDoc(userRef, {
        'preferences.globalKeywords': arrayRemove(keyword)
      });
      
      // Remove from active filters as well
      await updateDoc(userRef, {
        activeFilters: arrayRemove(keyword)
      });
      
      // Update local storage for content script
      await this.syncActiveFiltersToStorage();
      
      return { success: true };
    } catch (error) {
      console.error('Error removing global keyword:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Toggle media filter status
  async toggleMediaFilter(mediaId, active) {
    const userId = this.userManager.getUserId();
    if (!userId) return { success: false, error: 'User not logged in' };
    
    try {
      // Get media keywords
      const media = await this.getMediaById(mediaId);
      if (!media) {
        return { success: false, error: 'Media not found' };
      }
      
      // Get user document
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        return { success: false, error: 'User preferences not found' };
      }
      
      const userData = userDoc.data();
      
      if (active) {
        // Add all keywords from this media to active filters
        const keywordsToAdd = media.keywords.map(k => k.text);
        
        // Also add user's custom keywords for this media
        const userMediaKeywords = userData.mediaKeywords && 
                                userData.mediaKeywords[mediaId] || [];
        
        const allKeywords = [...new Set([...keywordsToAdd, ...userMediaKeywords])];
        
        // Add to hideMediaIds
        await updateDoc(userRef, {
          'preferences.hideMediaIds': arrayUnion(mediaId),
          activeFilters: arrayUnion(...allKeywords)
        });
      } else {
        // Remove media-specific keywords from active filters
        // Keep global keywords active
        const mediaKeywords = media.keywords.map(k => k.text);
        const userMediaKeywords = userData.mediaKeywords && 
                                userData.mediaKeywords[mediaId] || [];
        const globalKeywords = userData.preferences.globalKeywords || [];
        
        // Combine media and user keywords
        const allMediaKeywords = [...new Set([...mediaKeywords, ...userMediaKeywords])];
        
        // Filter out global keywords so they stay active
        const keywordsToRemove = allMediaKeywords.filter(k => !globalKeywords.includes(k));
        
        // Remove from hideMediaIds
        await updateDoc(userRef, {
          'preferences.hideMediaIds': arrayRemove(mediaId)
        });
        
        // Remove each keyword separately (arrayRemove doesn't support arrays)
        for (const keyword of keywordsToRemove) {
          await updateDoc(userRef, {
            activeFilters: arrayRemove(keyword)
          });
        }
      }
      
      // Update local storage for content script
      await this.syncActiveFiltersToStorage();
      
      return { success: true };
    } catch (error) {
      console.error('Error toggling media filter:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Sync active filters to local storage for content script
  async syncActiveFiltersToStorage() {
    const userId = this.userManager.getUserId();
    if (!userId) return;
    
    try {
      // Get user document
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) return;
      
      const userData = userDoc.data();
      const activeFilters = userData.activeFilters || [];
      
      // Store in local storage for content script
      chrome.storage.local.set({ keywords: activeFilters }, function() {
        console.log('Active filters synced to local storage:', activeFilters);
      });
      
    } catch (error) {
      console.error('Error syncing active filters to storage:', error);
    }
  }
}

/**
 * Initialize and export spoiler database functionality
 */
const userManager = new UserManager();
const spoilerDatabase = new SpoilerDatabase(userManager);

// Initialize active filters from Firestore when user logs in
userManager.addAuthStateListener(async (user) => {
  if (user) {
    await spoilerDatabase.syncActiveFiltersToStorage();
  } else {
    // Clear keywords when user logs out
    chrome.storage.local.remove('keywords', () => {
      console.log('Keywords removed from local storage after logout');
    });
  }
});

export { userManager, spoilerDatabase };
