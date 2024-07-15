import { useState, useEffect } from 'react';
import { auth, firestore } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, where, getDocs, query } from 'firebase/firestore';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(firestore, 'users', firebaseUser.uid));
        setUser({ uid: firebaseUser.uid, ...userDoc.data(), email: firebaseUser.email });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const checkCredentials = async (credentials) => {
    try {
      const userDoc = await getDoc(doc(firestore, 'users', credentials.email));
      if (userDoc.exists()) {
        throw { message: '* Email or phone number already in use.', status: 400 };
      }
      return null;
    } catch (error) {
      throw { error }
    }
  };

  const login = async (credentials) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      const userDoc = await getDoc(doc(firestore, 'users', userCredential.user.uid));
      setUser({ uid: userCredential.user.uid, ...userDoc.data() });
    } catch (error) {
      setUser(null);
      throw { error };
    }
  };

  const signup = async (credentials, marketingConsent) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
      await setDoc(doc(firestore, 'users', userCredential.user.uid), {
        name: credentials.name,
        marketingConsent: marketingConsent,
      });
      setUser({ uid: userCredential.user.uid, ...credentials });
    } catch (error) {
      setUser(null);
      throw { error }
    }
  };

  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw { message: error.message, status: error.status || 500 };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  return {
    user,
    loading,
    checkCredentials,
    login,
    signup,
    logout,
    resetPassword,
  };
};
