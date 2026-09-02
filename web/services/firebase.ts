import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyCo9vGqQymr_elgMKIHybJEyi9mrgEFrQw",
  authDomain: "destellosdehada-c7623.firebaseapp.com",
  projectId: "destellosdehada-c7623",
  storageBucket: "destellosdehada-c7623.firebasestorage.app",
  messagingSenderId: "1053706641330",
  appId: "1:1053706641330:web:be5d75f0c481fb4b678eab",
  measurementId: "G-LW88R86E2Y"
};

// Initialize Firebase only once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);

// Initialize Analytics conditionally (only supported on Web out of the box in this SDK,
// or requires careful checking to avoid crashes on React Native mobile)
let analytics: any = null;
if (Platform.OS === 'web') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export { app, analytics };
