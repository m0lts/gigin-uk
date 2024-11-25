// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";


// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "giginltd-16772.firebaseapp.com",
  projectId: "giginltd-16772",
  storageBucket: "giginltd-16772.firebasestorage.app",
  messagingSenderId: "203668777549",
  appId: "1:203668777549:web:6b3fb1280efc848dfe4a04",
  measurementId: "G-JQMB434NYK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app)
const functions = getFunctions(app, "europe-west3");
// if (window.location.hostname === "localhost") {
//   connectFunctionsEmulator(functions, "127.0.0.1", 5001);
// }

export { firestore, auth, storage, functions };
