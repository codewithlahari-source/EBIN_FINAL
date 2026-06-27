/**
 * public/auth.js — Google Sign-In via Firebase Auth (popup only),
 * then exchanges the Firebase ID token for a backend JWT.
 *
 * Firebase is used ONLY for the Google sign-in popup.
 * All data lives in MongoDB — Firebase is not used for storage.
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut as fbSignOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// Your existing Firebase project — used only for Google sign-in popup
const firebaseConfig = {
  apiKey: "AIzaSyBiVknn2eTkWAKRka35Z5sENiEAfm1W8JY",
  authDomain: "ebin-1.firebaseapp.com",
  projectId: "ebin-1",
  storageBucket: "ebin-1.firebasestorage.app",
  messagingSenderId: "278535367151",
  appId: "1:278535367151:web:db71d2d4a418627fad6e1a",
  measurementId: "G-7MXYVDL0LG"
};

const app = initializeApp(firebaseConfig);
const fbAuth = getAuth(app);
setPersistence(fbAuth, browserLocalPersistence).catch(() => {});

let _token = localStorage.getItem('bl_token');
let _user = JSON.parse(localStorage.getItem('bl_user') || 'null');

/** Get current JWT token */
export function getToken() { return _token; }

/** Get cached user object */
export function getUser() { return _user; }

/** Check if user is logged in */
export function isLoggedIn() { return !!_token; }

/** Save auth state */
function saveAuth(token, user) {
  _token = token;
  _user = user;
  localStorage.setItem('bl_token', token);
  localStorage.setItem('bl_user', JSON.stringify(user));
}

/** Clear auth state */
export function logout() {
  _token = null;
  _user = null;
  localStorage.removeItem('bl_token');
  localStorage.removeItem('bl_user');
  fbSignOut(fbAuth).catch(() => {});
  window.location.href = '/index.html';
}

/**
 * Authenticated fetch helper — attaches JWT Bearer token.
 */
export async function apiFetch(path, options = {}) {
  if (!_token) throw new Error('Not authenticated');
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${_token}`,
    ...(options.headers || {}),
  };
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data;
}

/**
 * Trigger Google Sign-In popup via Firebase, then exchange for backend JWT.
 * @param {Function} callback - (user, err) => void
 */
export async function googleSignIn(callback) {
  try {
    const result = await signInWithPopup(fbAuth, new GoogleAuthProvider());
    const idToken = await result.user.getIdToken();

    // Exchange Firebase ID token for our backend JWT
    const res = await fetch('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: idToken }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Backend login failed');
    }

    saveAuth(data.token, data.user);
    if (callback) callback(data.user, null);
  } catch (err) {
    console.error('Sign-in error:', err);
    if (callback) callback(null, err);
  }
}

/**
 * Check if Firebase still has a session and auto-login if we have no JWT.
 * @param {Function} callback - (user, err) => void
 */
export function checkExistingSession(callback) {
  onAuthStateChanged(fbAuth, async (fbUser) => {
    if (fbUser && !_token) {
      // Firebase has a session but we lost the JWT — re-exchange
      try {
        const idToken = await fbUser.getIdToken();
        const res = await fetch('/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: idToken }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          saveAuth(data.token, data.user);
          if (callback) callback(data.user, null);
          return;
        }
      } catch (e) {
        console.warn('Auto re-login failed:', e.message);
      }
    }
    if (callback) callback(_user, null);
  });
}
