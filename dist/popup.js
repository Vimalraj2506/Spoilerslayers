// Import Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyfnkB3th-79lHaRTGOSqx_6f1w2Z2SVJ0",
  authDomain: "spoileblocker.firebaseapp.com",
  projectId: "spoileblocker",
  storageBucket: "spoileblocker.firebasestorage.app",
  messagingSenderId: "10142520835",
  appId: "1:10142520835:web:8f56c96db8aa89ba4e53fb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM elements
document.addEventListener('DOMContentLoaded', function() {
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const signUpButton = document.getElementById('signUp');
  const loginButton = document.getElementById('login');
  const statusText = document.getElementById('status');

  // Sign up
  signUpButton.addEventListener('click', function() {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    createUserWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        // Signed up
        const user = userCredential.user;
        statusText.textContent = "Signed up and logged in!";
      })
      .catch((error) => {
        statusText.textContent = error.message;
      });
  });

  // Login
  loginButton.addEventListener('click', function() {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        // Logged in
        const user = userCredential.user;
        statusText.textContent = "Logged in!";
      })
      .catch((error) => {
        statusText.textContent = error.message;
      });
  });

  // Check auth state
  onAuthStateChanged(auth, (user) => {
    if (user) {
      statusText.textContent = "Logged in as: " + user.email;
    } else {
      statusText.textContent = "Not logged in";
    }
  });
});