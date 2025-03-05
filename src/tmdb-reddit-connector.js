// src/tmdb-reddit-connector.js
console.log("🚀 Starting TMDB-Reddit Connector...");
console.log("🔍 Checking environment variables...");

require('dotenv').config();
const axios = require('axios');
const firebase = require('firebase-admin');

if (!process.env.FIREBASE_PROJECT_ID) {
  console.error("❌ FIREBASE_PROJECT_ID is missing!");
  process.exit(1);
}
if (!process.env.FIREBASE_CLIENT_EMAIL) {
  console.error("❌ FIREBASE_CLIENT_EMAIL is missing!");
  process.exit(1);
}
if (!process.env.FIREBASE_PRIVATE_KEY) {
  console.error("❌ FIREBASE_PRIVATE_KEY is missing!");
  process.exit(1);
}
if (!process.env.TMDB_API_KEY) {
  console.error("❌ TMDB_API_KEY is missing!");
  process.exit(1);
}
if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) {
  console.error("❌ Reddit API credentials are missing!");
  process.exit(1);
}

console.log("✅ All environment variables are loaded correctly.");

// Initialize Firebase Admin SDK if not already initialized
if (!firebase.apps.length) {
  firebase.initializeApp({
    credential: firebase.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
}

const db = firebase.firestore();
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const REDDIT_USER_AGENT = 'SpoilerBlocker/1.0';
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
const REDDIT_USERNAME = process.env.REDDIT_USERNAME;
const REDDIT_PASSWORD = process.env.REDDIT_PASSWORD;

// Cache for Reddit access token
let redditAccessToken = null;
let tokenExpiry = 0;

/**
 * Get Reddit access token with better error handling
 */
async function getRedditAccessToken() {
  // Check if token exists and is still valid (with 5-minute buffer)
  if (redditAccessToken && tokenExpiry > (Date.now() + 300000)) {
    return redditAccessToken;
  }
  
  try {
    console.log("🔑 Getting new Reddit access token...");
    const response = await axios({
      method: 'post',
      url: 'https://www.reddit.com/api/v1/access_token',
      auth: {
        username: REDDIT_CLIENT_ID,
        password: REDDIT_CLIENT_SECRET
      },
      data: `grant_type=password&username=${REDDIT_USERNAME}&password=${REDDIT_PASSWORD}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': REDDIT_USER_AGENT
      }
    });
    
    if (response.data && response.data.access_token) {
      redditAccessToken = response.data.access_token;
      tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      console.log("✅ Reddit access token obtained");
      return redditAccessToken;
    } else {
      throw new Error('Invalid response from Reddit API');
    }
  } catch (error) {
    console.error('❌ Failed to get Reddit access token:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
    }
    throw error;
  }
}

/**
 * Search Reddit for media discussions with improved search terms
 */
async function searchRedditForMedia(mediaTitle) {
  try {
    const token = await getRedditAccessToken();
    
    // Sanitize the title by removing special characters and extra spaces
    const sanitizedTitle = mediaTitle.replace(/[^\w\s]/gi, '').trim();
    
    // Create search query
    const searchQuery = `"${sanitizedTitle}"`;
    console.log(`🔍 Searching Reddit for: ${searchQuery}`);
    
    const response = await axios.get('https://oauth.reddit.com/search', {
      params: {
        q: searchQuery,
        sort: 'relevance',
        limit: 10,
        t: 'month'
      },
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': REDDIT_USER_AGENT
      }
    });
    
    if (response.data && response.data.data && response.data.data.children) {
      console.log(`Found ${response.data.data.children.length} Reddit posts for "${mediaTitle}"`);
      return response.data.data.children;
    } else {
      console.log(`No Reddit posts found for "${mediaTitle}"`);
      return [];
    }
  } catch (error) {
    console.error(`❌ Error searching Reddit for ${mediaTitle}:`, error.message);
    return [];
  }
}

/**
 * Fetch comments for a Reddit post
 */
async function fetchRedditComments(postId) {
  try {
    const token = await getRedditAccessToken();
    
    const response = await axios.get(`https://oauth.reddit.com/comments/${postId}`, {
      params: {
        limit: 100
      },
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': REDDIT_USER_AGENT
      }
    });
    
    // Reddit returns an array with post data and comments
    if (response.data && response.data.length > 1) {
      return response.data[1].data.children.map(child => child.data);
    }
    
    return [];
  } catch (error) {
    console.error(`❌ Error fetching comments for post ${postId}:`, error.message);
    return [];
  }
}

/**
 * Check if text likely contains spoilers
 */
function hasSpoilerContent(text, mediaTitle) {
  if (!text) return false;
  
  // Convert to lowercase for case-insensitive matching
  const lowerText = text.toLowerCase();
  const lowerTitle = mediaTitle.toLowerCase();
  
  // Basic check: Does it even mention the media?
  if (!lowerText.includes(lowerTitle)) {
    return false;
  }
  
  // Keywords that suggest spoiler content
  const spoilerKeywords = [
    'spoiler', 'reveal', 'twist', 'ending', 'dies', 'death', 'killed',
    'happens at the end', 'plot twist', 'surprised when', 'didn\'t expect',
    'reveals that', 'turned out to be', 'shocked when'
  ];
  
  // Check for direct spoiler indicators
  return spoilerKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Extract potential spoiler keywords from text
 */
function extractSpoilerKeywords(text, mediaTitle) {
  if (!text) return [];
  
  // Convert to lowercase for processing
  const lowerText = text.toLowerCase();
  const lowerTitle = mediaTitle.toLowerCase();
  
  // Remove the media title from text to avoid it being captured as a keyword
  const textWithoutTitle = lowerText.replace(new RegExp(lowerTitle, 'g'), '');
  
  // Split into sentences for better context
  const sentences = textWithoutTitle.split(/[.!?]+/);
  
  const potentialKeywords = [];
  const commonWords = new Set(['the', 'and', 'but', 'or', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'like']);
  
  // Character names and important terms are often capitalized in the original text
  const capitalizedWords = text.match(/\b[A-Z][a-z]{2,}\b/g) || [];
  potentialKeywords.push(...capitalizedWords.map(word => word.toLowerCase()));
  
  // Find words in context of spoiler keywords
  const spoilerIndicators = ['dies', 'killed', 'death', 'reveals', 'secret', 'twist', 'surprise'];
  
  sentences.forEach(sentence => {
    if (spoilerIndicators.some(indicator => sentence.includes(indicator))) {
      // Extract words
      const words = sentence.split(/\s+/);
      words.forEach(word => {
        // Clean the word
        const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
        
        // Skip short words and common words
        if (cleanWord.length > 3 && !commonWords.has(cleanWord)) {
          potentialKeywords.push(cleanWord);
        }
      });
    }
  });
  
  // Remove duplicates
  const uniqueKeywords = [...new Set(potentialKeywords)]
    .filter(keyword => keyword.length > 3 && !commonWords.has(keyword));
  
  return uniqueKeywords.slice(0, 10); // Limit to top 10 keywords
}

/**
 * Main function to update the database with recent media and scrape spoilers
 */
async function updateDatabase() {
  try {
    console.log('🚀 Starting database update process...');
    
    // Fetch latest media from TMDB
    const mediaItems = await fetchLatestMedia();
    console.log(`✅ Fetched ${mediaItems.length} media items from TMDB`);
    
    // Store unique media items in Firestore
    const mediaIds = await storeMediaInFirestore(mediaItems);
    console.log(`✅ Stored ${mediaIds.length} new media items in Firestore`);
    
    // Process each media for spoilers
    for (const mediaId of mediaIds) {
      await collectSpoilers(mediaId);
    }
    
    console.log('✅ Database update completed');
  } catch (error) {
    console.error('❌ Error updating database:', error);
  }
}

/**
 * Fetch latest movies and TV shows from TMDB
 */
async function fetchLatestMedia() {
  const allMedia = [];
  const currentYear = new Date().getFullYear();
  
  for (const year of [currentYear, currentYear - 1]) {
    for (const mediaType of ['movie', 'tv']) {
      try {
        const dateParam = mediaType === 'movie' ? 'primary_release_year' : 'first_air_date_year';
        
        const url = `https://api.themoviedb.org/3/discover/${mediaType}`;
        const response = await axios.get(url, {
          params: {
            api_key: TMDB_API_KEY,
            [dateParam]: year,
            sort_by: 'popularity.desc',
            page: 1,
            include_adult: false
          }
        });
        
        if (response.data && response.data.results) {
          const mediaItems = response.data.results.map(item => ({
            ...item,
            media_type: mediaType
          }));
          
          allMedia.push(...mediaItems);
        }
      } catch (error) {
        console.error(`❌ Error fetching ${mediaType} from TMDB:`, error.message);
      }
    }
  }
  return allMedia;
}

/**
 * Store media items in Firestore, avoiding duplicates
 */
async function storeMediaInFirestore(mediaItems) {
  const addedIds = [];
  
  // First, get all existing TMDB IDs to avoid duplicates
  const existingTmdbIds = new Set();
  try {
    const mediaSnapshot = await db.collection('media').get();
    mediaSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.tmdbId) {
        existingTmdbIds.add(data.tmdbId);
      }
    });
    console.log(`Found ${existingTmdbIds.size} existing media items in database`);
  } catch (error) {
    console.error('❌ Error fetching existing media:', error);
  }
  
  // Filter out media items that already exist
  const newMediaItems = mediaItems.filter(item => !existingTmdbIds.has(item.id));
  console.log(`Found ${newMediaItems.length} new media items to add (filtered out ${mediaItems.length - newMediaItems.length} duplicates)`);
  
  // Use batched writes for better performance
  const batchSize = 500; // Firestore limit
  let batch = db.batch();
  let operationCount = 0;
  
  // Add only new media items
  for (const item of newMediaItems) {
    const mediaRef = db.collection('media').doc();
    addedIds.push(mediaRef.id);
    
    batch.set(mediaRef, {
      tmdbId: item.id,
      title: item.title || item.name,
      mediaType: item.media_type,
      releaseDate: item.release_date ? new Date(item.release_date) : null,
      popularity: item.popularity || 0,
      posterPath: item.poster_path || null,
      overview: item.overview || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      keywords: [] // Initialize empty keywords array
    });
    
    operationCount++;
    
    // Commit batch when it reaches the limit
    if (operationCount >= batchSize) {
      await batch.commit();
      batch = db.batch();
      operationCount = 0;
    }
  }
  
  // Commit any remaining operations
  if (operationCount > 0) {
    await batch.commit();
  }
  
  return addedIds;
}

/**
 * Collect spoilers for a specific media item
 */
async function collectSpoilers(mediaId) {
  try {
    // Get media details from Firestore
    const mediaDoc = await db.collection('media').doc(mediaId).get();
    if (!mediaDoc.exists) {
      console.error(`Media with ID ${mediaId} not found`);
      return;
    }
    
    const mediaData = mediaDoc.data();
    console.log(`🔍 Collecting spoilers for: ${mediaData.title}`);
    
    // Search Reddit for posts about this media
    const redditPosts = await searchRedditForMedia(mediaData.title);
    
    let spoilerCount = 0;
    const allSpoilerKeywords = new Set();
    
    // Process each post for potential spoilers
    for (const post of redditPosts) {
      const postData = post.data;
      
      // Check if post title or content contains spoilers
      const isSpoiler = postData.spoiler || // Reddit's spoiler tag
                        hasSpoilerContent(postData.title, mediaData.title) || 
                        hasSpoilerContent(postData.selftext, mediaData.title);
      
      if (isSpoiler) {
        // Extract keywords from the title and text
        const titleKeywords = extractSpoilerKeywords(postData.title, mediaData.title);
        const textKeywords = extractSpoilerKeywords(postData.selftext, mediaData.title);
        const combinedKeywords = [...new Set([...titleKeywords, ...textKeywords])];
        
        // Add keywords to the overall set
        combinedKeywords.forEach(keyword => allSpoilerKeywords.add(keyword));
        
        // Store spoiler in Firestore
        await db.collection('spoilers').add({
          mediaId: mediaId,
          mediaTitle: mediaData.title,
          source: 'reddit',
          type: 'post',
          postId: postData.id,
          title: postData.title,
          text: postData.selftext || '',
          url: `https://reddit.com${postData.permalink}`,
          confidence: 0.8, // Arbitrary confidence score
          keywords: combinedKeywords,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        spoilerCount++;
      }
      
      // Fetch and process comments for this post
      const comments = await fetchRedditComments(postData.id);
      
      for (const comment of comments) {
        if (hasSpoilerContent(comment.body, mediaData.title)) {
          // Extract keywords from the comment
          const commentKeywords = extractSpoilerKeywords(comment.body, mediaData.title);
          
          // Add keywords to the overall set
          commentKeywords.forEach(keyword => allSpoilerKeywords.add(keyword));
          
          // Store comment as spoiler
          await db.collection('spoilers').add({
            mediaId: mediaId,
            mediaTitle: mediaData.title,
            source: 'reddit',
            type: 'comment',
            postId: postData.id,
            commentId: comment.id,
            postTitle: postData.title,
            text: comment.body,
            url: `https://reddit.com${postData.permalink}${comment.id}`,
            confidence: 0.7, // Arbitrary confidence score
            keywords: commentKeywords,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          
          spoilerCount++;
        }
      }
    }
    
    console.log(`✅ Added ${spoilerCount} spoilers for ${mediaData.title}`);
    
    // Update media document with collected keywords
    if (spoilerCount > 0 && allSpoilerKeywords.size > 0) {
      const keywordsArray = Array.from(allSpoilerKeywords).map(keyword => ({
        text: keyword,
        source: 'reddit',
        addedAt: firebase.firestore.FieldValue.serverTimestamp()
      }));
      
      await db.collection('media').doc(mediaId).update({
        keywords: firebase.firestore.FieldValue.arrayUnion(...keywordsArray)
      });
      
      console.log(`✅ Updated media document with ${allSpoilerKeywords.size} keywords`);
    }
  } catch (error) {
    console.error(`❌ Error collecting spoilers for media ${mediaId}:`, error.message);
  }
}

// Run directly if called as script
if (require.main === module) {
  updateDatabase()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = {
  updateDatabase
};