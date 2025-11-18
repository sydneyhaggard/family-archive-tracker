// Firebase Configuration
// Replace these values with your own Firebase project configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Gemini API Configuration
// Replace with your Gemini API key from Google AI Studio
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Constants for file size management
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB in bytes
const STORAGE_QUOTA_WARNING_THRESHOLD = 0.8; // Warn at 80% usage

// Export for use in other files
window.firebaseConfig = {
    auth,
    db,
    storage,
    MAX_FILE_SIZE,
    STORAGE_QUOTA_WARNING_THRESHOLD,
    GEMINI_API_KEY,
    GEMINI_API_URL
};
