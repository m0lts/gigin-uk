// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "gigin-63896.firebaseapp.com",
  projectId: "gigin-63896",
  storageBucket: "gigin-63896.appspot.com",
  messagingSenderId: "263535417038",
  appId: "1:263535417038:web:f63b143e70f300e909e29f",
  measurementId: "G-FNDGX6S7HJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app)

export { firestore, auth, storage };
