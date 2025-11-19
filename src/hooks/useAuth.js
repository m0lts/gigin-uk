import { useState, useEffect, useRef } from 'react';
import { auth, firestore, googleProvider } from '@lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, signInWithPopup, getAdditionalUserInfo } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, Timestamp, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getEmailAddress } from '@services/api/users';
import { sendVerificationEmail as sendVerificationEmailApi } from '../services/api/users';

export const useAuth = () => {

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const userUnsubRef = useRef(null);
  const authUnsubRef = useRef(null);
  const artistProfileUnsubsRef = useRef(new Map());
  const currentArtistProfileIdsRef = useRef([]);
  const artistProfilesDataRef = useRef({});

  const cleanupArtistProfileSubscriptions = () => {
    artistProfileUnsubsRef.current.forEach((unsub) => unsub?.());
    artistProfileUnsubsRef.current.clear();
    currentArtistProfileIdsRef.current = [];
    artistProfilesDataRef.current = {};
    setUser((prev) => {
      if (!prev) return prev;
      return { ...prev, artistProfiles: [] };
    });
  };

  const publishArtistProfiles = () => {
    setUser((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        artistProfiles: Object.values(artistProfilesDataRef.current),
      };
    });
  };

  const syncArtistProfileSubscriptions = (profileIds = []) => {
    const normalizedIds = Array.from(
      new Set(
        (profileIds || [])
          .map((entry) => (typeof entry === 'string' ? entry : entry?.id))
          .filter(Boolean)
      )
    );

    const prevIds = currentArtistProfileIdsRef.current || [];

    // Unsubscribe removed profiles
    prevIds.forEach((profileId) => {
      if (!normalizedIds.includes(profileId)) {
        const unsub = artistProfileUnsubsRef.current.get(profileId);
        unsub?.();
        artistProfileUnsubsRef.current.delete(profileId);
        delete artistProfilesDataRef.current[profileId];
      }
    });

    // Subscribe to new profiles
    normalizedIds.forEach((profileId) => {
      if (artistProfileUnsubsRef.current.has(profileId)) return;
      const profileRef = doc(firestore, 'artistProfiles', profileId);
      const unsub = onSnapshot(
        profileRef,
        (profileSnap) => {
          if (profileSnap.exists()) {
            artistProfilesDataRef.current[profileId] = { id: profileId, ...profileSnap.data() };
          } else {
            delete artistProfilesDataRef.current[profileId];
          }
          publishArtistProfiles();
        },
        (err) => console.error(`Artist profile snapshot error (${profileId}):`, err)
      );
      artistProfileUnsubsRef.current.set(profileId, unsub);
    });

    currentArtistProfileIdsRef.current = normalizedIds;
    publishArtistProfiles();
  };

  useEffect(() => {
    setLoading(true);
    authUnsubRef.current = onAuthStateChanged(auth, async (firebaseUser) => {
      if (userUnsubRef.current) { userUnsubRef.current(); userUnsubRef.current = null; }
      cleanupArtistProfileSubscriptions();
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
        const { artistProfiles: rawArtistProfiles, ...restUserFields } = rawUser;
        const userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          ...restUserFields,
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
        const artistProfileIds = Array.isArray(rawArtistProfiles)
          ? rawArtistProfiles
              .map((entry) => (typeof entry === 'string' ? entry : entry?.id))
              .filter(Boolean)
          : [];

        setUser((prev) => ({
          ...(prev || {}),
          ...userData,
          artistProfileIds,
          artistProfiles: prev?.artistProfiles || [],
        }));

        syncArtistProfileSubscriptions(artistProfileIds);
        setLoading(false);
      }, (err) => {
        console.error('User snapshot error:', err);
        setLoading(false);
      });
    });

    return () => {
      if (authUnsubRef.current) authUnsubRef.current();
      if (userUnsubRef.current) userUnsubRef.current();
      cleanupArtistProfileSubscriptions();
    };
  }, []);
  

  const login = async (credentials) => {
    try {
      const user = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      if (!user.user.emailVerified) {
        return { needsEmailVerify: true };
      }
      try {
        await updateDoc(
          doc(firestore, "users", user.user.uid),
          { lastLoginAt: Timestamp.now(), }
        );
      } catch (error) {
        console.log("Error creating user document:", error);
      }
      const redirect = sessionStorage.getItem('redirect');
      if (redirect === 'create-musician-profile') {
        sessionStorage.removeItem('redirect');
        window.location.reload()
        return;
      } else if (redirect === 'do-not-redirect') {
        sessionStorage.removeItem('redirect');
      } else if (redirect) {
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

  const continueWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const { isNewUser } = getAdditionalUserInfo(result);
      if (isNewUser) {
        try {
          await setDoc(
            doc(firestore, "users", user.uid),
            { name: user.displayName || "" },
            { merge: true }
          );
        } catch (error) {
          console.error("Error creating user document:", error);
        }
      } else {
        try {
          await updateDoc(
            doc(firestore, "users", user.uid),
            { lastLoginAt: Timestamp.now(), }
          );
        } catch (error) {
          console.error("Error updating user document:", error);
        }
      }
      const redirect = sessionStorage.getItem('redirect');
      console.log('redirect', redirect);
      if (redirect === 'create-musician-profile') {
        sessionStorage.removeItem('redirect');
        window.location.reload()
        return;
      } else if (redirect === 'do-not-redirect') {
        sessionStorage.removeItem('redirect');
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

  const actionCodeSettings = {
    url: `${window.location.origin}`,
    handleCodeInApp: false,
  };

  const signup = async (credentials, marketingConsent) => {
    try {
      const user = await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
      await sendVerificationEmailApi({ actionUrl: `${window.location.origin}` });
      const userRef = doc(firestore, 'users', user.user.uid);
      await setDoc(userRef, {
        name: credentials.name || '',
        marketingConsent: !!marketingConsent,
      }, { merge: true });
      const redirect = sessionStorage.getItem('redirect');
      if (redirect) {
        sessionStorage.removeItem('redirect');
        navigate(redirect);
      } else {
        navigate('/');
      }
      sessionStorage.setItem('newUser', true);
      return { needsEmailVerify: true, redirect };
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
    const userDoc = await getEmailAddress({ email });
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

  return {
    user,
    setUser,
    loading,
    login,
    signup,
    logout,
    resetPassword,
    continueWithGoogle,
  };
};
