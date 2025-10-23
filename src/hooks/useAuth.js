import { useState, useEffect, useRef } from 'react';
import { auth, firestore, googleProvider } from '@lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, signInWithPopup, fetchSignInMethodsForEmail, deleteUser, sendEmailVerification } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, Timestamp, arrayUnion, query, collection, getDocs, where, limit, serverTimestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { createMusicianProfile } from '../services/client-side/musicians';
import { getEmailAddress, updateUserArrayField } from '../services/function-calls/users';
import { httpsCallable } from "firebase/functions";
import { functions } from '@lib/firebase';
const sendVerificationEmail = httpsCallable(functions, "sendVerificationEmail");

export const useAuth = () => {

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const musicianUnsubRef = useRef(null);
  const currentMusicianIdRef = useRef(null);
  const userUnsubRef = useRef(null);
  const authUnsubRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    authUnsubRef.current = onAuthStateChanged(auth, async (firebaseUser) => {
      if (userUnsubRef.current) { userUnsubRef.current(); userUnsubRef.current = null; }
      if (musicianUnsubRef.current) { musicianUnsubRef.current(); musicianUnsubRef.current = null; }
      currentMusicianIdRef.current = null;
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      const userDocRef = doc(firestore, 'users', firebaseUser.uid);
      userUnsubRef.current = onSnapshot(userDocRef, async (userSnap) => {
        if (!userSnap.exists()) {
          setUser({ uid: firebaseUser.uid, email: firebaseUser.email });
          setLoading(false);
          return;
        }
        const rawUser = userSnap.data() || {};
        const userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          ...rawUser,
        };
        if (Array.isArray(rawUser.venueProfiles) && rawUser.venueProfiles.length) {
          const venueProfiles = await Promise.all(
            rawUser.venueProfiles.map(async (venueId) => {
              const ref = doc(firestore, 'venueProfiles', venueId);
              const snap = await getDoc(ref);
              return snap.exists() ? { id: venueId, ...snap.data() } : null;
            })
          );
          userData.venueProfiles = venueProfiles.filter(Boolean);
        }
        const musicianId =
          Array.isArray(rawUser.musicianProfile) && rawUser.musicianProfile.length
            ? rawUser.musicianProfile[0]
            : null;
        if (musicianId !== currentMusicianIdRef.current) {
          if (musicianUnsubRef.current) {
            musicianUnsubRef.current();
            musicianUnsubRef.current = null;
          }
          currentMusicianIdRef.current = musicianId;
          if (musicianId) {
            const musicianRef = doc(firestore, 'musicianProfiles', musicianId);
            musicianUnsubRef.current = onSnapshot(musicianRef, (musSnap) => {
              const musicianData = musSnap.exists() ? { id: musicianId, ...musSnap.data() } : null;
              setUser((prev) => {
                const base = prev ?? userData;
                const next = { ...base };
                if (musicianData) {
                  next.musicianProfile = musicianData;
                } else {
                  delete next.musicianProfile;
                }
                return next;
              });
              setLoading(false);
            }, (err) => {
              console.error('Musician snapshot error:', err);
            });
          } else {
            setUser((prev) => {
              const merged = { ...(prev || {}), ...userData };
              const { musicianProfile, ...rest } = merged;
              return rest;
            });
            setLoading(false);
          }
        } else {
          setUser((prev) => ({
            ...(prev || {}),
            ...userData,
          }));
          setLoading(false);
        }
      }, (err) => {
        console.error('User snapshot error:', err);
        setLoading(false);
      });
    });

    return () => {
      if (authUnsubRef.current) authUnsubRef.current();
      if (userUnsubRef.current) userUnsubRef.current();
      if (musicianUnsubRef.current) musicianUnsubRef.current();
    };
  }, []);
  

  const login = async (credentials) => {
    try {
      await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      const redirect = sessionStorage.getItem('redirect');
      if (redirect === 'create-musician-profile') {
        sessionStorage.removeItem('redirect');
        return;
      }
      if (redirect) {
        navigate(redirect);
        sessionStorage.removeItem('redirect');
      } else {
        navigate('/');
      }
      } catch (error) {
        const msg = error?.customData?.message || error?.message || "";
        if (msg.includes("auth/email-not-verified")) {
          toast.error("Please verify your email to continue.");
          return;
        }
        throw { error };
      }
  };

  const actionCodeSettings = {
    url: `${window.location.origin}`,
    handleCodeInApp: false,
  };

  const signup = async (credentials, marketingConsent) => {
    try {
      const user = await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
      await sendVerificationEmail({actionUrl: `${window.location.origin}`});
      const userRef = doc(firestore, 'users', user.user.uid);
      await setDoc(userRef, {
        name: credentials.name || '',
        marketingConsent: !!marketingConsent,
      }, { merge: true });
      const redirect = sessionStorage.getItem('redirect');
      sessionStorage.setItem('newUser', true)
      if (redirect === 'create-musician-profile') {
        sessionStorage.removeItem('redirect');
        return { redirect };
      } else if (redirect) {
        navigate(redirect);
        sessionStorage.removeItem('redirect');
      } else {
        navigate('/');
      }
      return { needsEmailVerify: true };
    } catch (error) {
      const msg = error?.customData?.message || error?.message || "";
      if (msg.includes("auth/email-not-verified")) {
        toast.error("Please verify your email to continue.");
        return;
      }
      throw { error };
    }
  };
  
const resetPassword = async (rawEmail) => {
  try {
    const email = (rawEmail || "").trim().toLowerCase();
    const userDoc = await getEmailAddress(email);
    if (!userDoc) {
      return { sent: false, reason: 'no-account' };
    }
    if (userDoc.googleAccount === true) {
      return { sent: false, reason: 'google-only' };
    }
    await sendPasswordResetEmail(auth, email, actionCodeSettings);
    return { sent: true, reason: 'password-account' };
  } catch (err) {
    const code = err?.code;
    if (code === 'auth/invalid-email') {
      throw { message: 'Please enter a valid email address.', status: 400, code };
    }
    if (code === 'auth/too-many-requests') {
      throw { message: 'Too many attempts. Please try again later.', status: 429, code };
    }
    if (code === 'auth/user-disabled') {
      throw { message: 'This account is disabled.', status: 403, code };
    }
    throw { message: err?.message || 'Failed to send reset email.', status: 500, code };
  }
};


  const logout = async (redirect = null) => {
    try {
      await signOut(auth);
        if (redirect) {
          navigate(redirect, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      const redirect = sessionStorage.getItem('redirect');
      if (redirect === 'create-musician-profile') {
        sessionStorage.removeItem('redirect');
        return;
      }
      if (redirect) {
        navigate(redirect);
        sessionStorage.removeItem('redirect');
      } else {
        navigate('/');
      }
    } catch (error) {
      const msg = error?.customData?.message || error?.message || "";
      if (msg.includes("auth/account-not-registered")) {
        toast.error('No Gigin account is linked to this Google account. Please sign up first.');
        return;
      }
      throw { error };
    }
  };
  
  const signupWithGoogle = async (marketingConsent) => {
    try {
      await signInWithPopup(auth, googleProvider);
      const redirect = sessionStorage.getItem('redirect');
      if (redirect === 'create-musician-profile') {
        sessionStorage.removeItem('redirect');
        return { redirect };
      } else if (redirect) {
        navigate(redirect);
        sessionStorage.removeItem('redirect');
      } else {
        navigate('/');
      }
    } catch (error) {
      const msg = error?.customData?.message || error?.message || "";
      if (msg.includes("auth/account-not-registered")) {
        toast.error('No Gigin account is linked to this Google account. Please sign up first.');
        return;
      }
      throw { error };
    }
  };

  return {
    user,
    setUser,
    loading,
    login,
    signup,
    logout,
    resetPassword,
    loginWithGoogle,
    signupWithGoogle
  };
};
