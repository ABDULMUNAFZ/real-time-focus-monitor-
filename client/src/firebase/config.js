// Import the functions you need from the SDKs
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyChmEW5z4Chf2DPojdfYvVj9_szmTXiwaM",
  authDomain: "meet-54f04.firebaseapp.com",
  projectId: "meet-54f04",
  storageBucket: "meet-54f04.firebasestorage.app",
  messagingSenderId: "905750743695",
  appId: "1:905750743695:web:3a6b991b4529e3f19a3efa",
  measurementId: "G-T0DCEJ8240"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const firestore = getFirestore(app);

export { auth, firestore, analytics };
