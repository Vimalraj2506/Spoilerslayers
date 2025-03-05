import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove 
} from 'firebase/firestore';

// Your Firebase configuration
const firebaseConfig = {
  
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Function to handle UI based on auth state
function updateUI(user) {
  const authSection = document.getElementById('authSection');
  const keywordsSection = document.getElementById('keywordsSection');
  const statusText = document.getElementById('status');

  if (user) {
    // User is signed in
    authSection.style.display = 'none';
    keywordsSection.style.display = 'block';
    
    // Load user's keywords
    loadKeywords(user.uid);
  } else {
    // User is signed out
    authSection.style.display = 'block';
    keywordsSection.style.display = 'none';
    statusText.textContent = 'Not logged in';
  }
}

// Function to load keywords from Firestore
async function loadKeywords(userId) {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const keywords = userData.keywords || [];
      
      displayKeywords(keywords);
      
      // Also save to storage for content script to access
      chrome.storage.local.set({ keywords: keywords }, function() {
        console.log('Keywords saved to local storage');
      });
    } else {
      // Create the user document if it doesn't exist
      await setDoc(userDocRef, { keywords: [] });
      displayKeywords([]);
    }
  } catch (error) {
    console.error('Error loading keywords:', error);
  }
}

// Function to display keywords in the popup
function displayKeywords(keywords) {
  const keywordsList = document.getElementById('keywordsList');
  keywordsList.innerHTML = '';
  
  keywords.forEach(keyword => {
    const keywordItem = document.createElement('div');
    keywordItem.className = 'keyword-item';
    
    const keywordText = document.createElement('span');
    keywordText.textContent = keyword;
    
    const removeButton = document.createElement('span');
    removeButton.className = 'remove-keyword';
    removeButton.textContent = '×';
    removeButton.addEventListener('click', () => removeKeyword(keyword));
    
    keywordItem.appendChild(keywordText);
    keywordItem.appendChild(removeButton);
    keywordsList.appendChild(keywordItem);
  });
}

// Function to add a keyword
async function addKeyword(keyword) {
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    const userDocRef = doc(db, 'users', user.uid);
    await updateDoc(userDocRef, {
      keywords: arrayUnion(keyword)
    });
    
    // Reload keywords
    loadKeywords(user.uid);
  } catch (error) {
    console.error('Error adding keyword:', error);
  }
}

// Function to remove a keyword
async function removeKeyword(keyword) {
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    const userDocRef = doc(db, 'users', user.uid);
    await updateDoc(userDocRef, {
      keywords: arrayRemove(keyword)
    });
    
    // Reload keywords
    loadKeywords(user.uid);
  } catch (error) {
    console.error('Error removing keyword:', error);
  }
}

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
  // Auth elements
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const signUpButton = document.getElementById('signUp');
  const loginButton = document.getElementById('login');
  const logoutButton = document.getElementById('logout');
  const statusText = document.getElementById('status');
  
  // Keyword elements
  const keywordInput = document.getElementById('keywordInput');
  const addKeywordButton = document.getElementById('addKeyword');
  
  // Sign up
  signUpButton.addEventListener('click', function() {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    if (!email || !password) {
      statusText.textContent = 'Please enter both email and password';
      return;
    }
    
    createUserWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        // Signed up successfully
        statusText.textContent = 'Signed up and logged in!';
      })
      .catch((error) => {
        statusText.textContent = error.message;
      });
  });
  
  // Login
  loginButton.addEventListener('click', function() {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    if (!email || !password) {
      statusText.textContent = 'Please enter both email and password';
      return;
    }
    
    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        // Logged in successfully
        statusText.textContent = 'Logged in!';
      })
      .catch((error) => {
        statusText.textContent = error.message;
      });
  });
  
  // Logout
  logoutButton.addEventListener('click', function() {
    signOut(auth)
      .then(() => {
        // Sign-out successful
        chrome.storage.local.remove('keywords', function() {
          console.log('Keywords removed from local storage');
        });
      })
      .catch((error) => {
        console.error('Error signing out:', error);
      });
  });
  
  // Add keyword
  addKeywordButton.addEventListener('click', function() {
    const keyword = keywordInput.value.trim();
    
    if (!keyword) return;
    
    addKeyword(keyword);
    keywordInput.value = '';
  });
  
  // Allow pressing Enter to add keyword
  keywordInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      const keyword = keywordInput.value.trim();
      
      if (!keyword) return;
      
      addKeyword(keyword);
      keywordInput.value = '';
    }
  });
  
  // Listen for authentication state changes
  onAuthStateChanged(auth, (user) => {
    updateUI(user);
  });
});