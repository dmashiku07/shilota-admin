// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here, other Firebase libraries
// are not available in the service worker.
importScripts("https://www.gstatic.com/firebasejs/5.5.0/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/5.5.0/firebase-messaging.js");

// Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.
const firebaseConfig = {
  apiKey: "REPLACE_FIREBASE_API_KEY",
  authDomain: "REPLACE_FIREBASE_AUTH_DOMAIN",
  databaseURL: "REPLACE_FIREBASE_DATABASE_URL",
  projectId: "REPLACE_FIREBASE_PROJECT_ID",
  storageBucket: "REPLACE_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_FIREBASE_MESSAGING_SENDER_ID",
  appId: "REPLACE_FIREBASE_APP_ID"
};

if (firebaseConfig.apiKey.indexOf("REPLACE_") !== 0) {
  firebase.initializeApp(firebaseConfig);

  // Retrieve an instance of Firebase Messaging so that it can handle background
  // messages.
  firebase.messaging();
}
