import { useState, useEffect, useRef } from 'react';
import { auth, firestore, googleProvider } from '@lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, signInWithPopup, getAdditionalUserInfo } from 'firebase/auth';
import { loginLandingPath, loginLandingState, logoutDestination } from '../config/loginDestination';
import { getArtistHome, getProfileSession } from '@services/client-side/keepProfile';
import { httpClient } from '@services/http/client';
import { doc, getDoc, setDoc, onSnapshot, Timestamp, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getEmailAddress } from '@services/api/users';
import { sendVerificationEmail as sendVerificationEmailApi } from '../services/api/users';
import { FEATURES } from '../config/features';
import { artistLoginRedirect } from '../config/artistDestination';

const POST_LOGIN_EVENT = 'gigin-post-login';
let postLoginPending = false;
let postLoginStarted = 0;

function beginPostLogin() {
  postLoginPending = true;
  postLoginStarted = Date.now();
  window.dispatchEvent(new Event(POST_LOGIN_EVENT));
}

function cancelPostLogin() {
  postLoginPending = false;
}

export const useAuth = () => {

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const userUnsubRef = useRef(null);
  const authUnsubRef = useRef(null);
  const artistProfileUnsubsRef = useRef(new Map());
  const currentArtistProfileIdsRef = useRef([]);
  const artistProfilesDataRef = useRef({});
  const [postLoginTick, setPostLoginTick] = useState(0);

  const cleanupArtistProfileSubscriptions = () => {
    artistProfileUnsubsRef.current.forEach((unsub) => unsub?.());
    artistProfileUnsubsRef.current.clear();
    currentArtistProfileIdsRef.current = [];
    artistProfilesDataRef.current = {};
    setUser((prev) => {
      if (!prev) return prev;
      const { artistProfiles, artistProfileIds, ...rest } = prev;
      return rest;
    });
  };

  const publishArtistProfiles = () => {
    setUser((prev) => {
      if (!prev) return prev;
      const profiles = Object.values(artistProfilesDataRef.current);
      if (profiles.length === 0) {
        // Remove artistProfiles and artistProfileIds if empty
        const { artistProfiles, artistProfileIds, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        artistProfiles: profiles,
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

        setUser((prev) => {
          // Only include artistProfileIds and artistProfiles if there are actual profiles
          const userUpdate = {
            ...(prev || {}),
            ...userData,
          };

          if (artistProfileIds.length > 0) {
            userUpdate.artistProfileIds = artistProfileIds;
            // artistProfiles will be set by publishArtistProfiles when subscriptions sync
            userUpdate.artistProfiles = prev?.artistProfiles || [];
          } else {
            // Remove artistProfileIds and artistProfiles if user has none
            delete userUpdate.artistProfileIds;
            delete userUpdate.artistProfiles;
          }

          return userUpdate;
        });

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

  useEffect(() => {
    const onPostLogin = () => setPostLoginTick((tick) => tick + 1);
    window.addEventListener(POST_LOGIN_EVENT, onPostLogin);
    return () => window.removeEventListener(POST_LOGIN_EVENT, onPostLogin);
  }, []);

  useEffect(() => {
    if (!postLoginPending || loading || !user) return undefined;
    const ids = Array.isArray(user.artistProfileIds) ? user.artistProfileIds : [];
    const loaded = Array.isArray(user.artistProfiles) ? user.artistProfiles : [];
    const elapsed = Date.now() - postLoginStarted;
    if (ids.length > 0 && loaded.length < ids.length && elapsed < 800) {
      const timer = setTimeout(() => setPostLoginTick((tick) => tick + 1), 800 - elapsed);
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled || !postLoginPending) return;
      const emailVerified = auth.currentUser?.emailVerified !== false;
      let hasArtistSession = false;
      const hasVenue = Array.isArray(user.venueProfiles) && user.venueProfiles.length > 0;
      if (emailVerified && FEATURES.keepProfile && loaded.length === 0 && !hasVenue) {
        const [session, home] = await Promise.all([
          getProfileSession().catch(() => null),
          getArtistHome().catch(() => null),
        ]);
        hasArtistSession = Boolean(session?.profile || home?.profile);
      }
      if (cancelled || !postLoginPending) return;
      postLoginPending = false;
      if (!emailVerified) return;
      let storedRedirect = '';
      try {
        storedRedirect = sessionStorage.getItem('redirect') || '';
        if (storedRedirect) sessionStorage.removeItem('redirect');
      } catch { /* ignore */ }
      const path = loginLandingPath(user, FEATURES, { emailVerified: true, hasArtistSession, storedRedirect });
      if (!path) return;
      const draft = path.startsWith('/venues/add-venue') ? loginLandingState(user) : null;
      navigate(path, draft ? { state: draft } : undefined);
    })();

    return () => { cancelled = true; };
  }, [user, loading, navigate, postLoginTick]);

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
      beginPostLogin();
    } catch (error) {
      cancelPostLogin();
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
      if (user.emailVerified === false) {
        return { needsEmailVerify: true };
      }
      beginPostLogin();
    } catch (error) {
      cancelPostLogin();
      const msg = error?.customData?.message || error?.message || "";
      if (msg.includes("auth/account-not-registered")) {
        toast.error('No Gigin account is linked to this Google account. Please sign up first.');
        return;
      }
      throw { error };
    }
  };

  const signup = async (credentials, marketingConsent) => {
    let credential;
    try {
      credential = await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
    } catch (error) {
      const msg = error?.customData?.message || error?.message || "";
      const unverified = error?.code === "auth/email-not-verified" || msg.includes("auth/email-not-verified");
      if (!unverified || !auth.currentUser) throw { error };
      credential = { user: auth.currentUser };
    }
    let emailSent = false;
    try {
      await credential.user.getIdToken();
      await sendVerificationEmailApi();
      emailSent = true;
    } catch (error) {
      const code = error?.payload?.code || error?.code || error?.message || "unknown";
      console.error("verification email", code);
    }
    try { sessionStorage.setItem("giginVerifyEmailFailed", emailSent ? "0" : "1"); } catch { /* ignore */ }
    try {
      const userRef = doc(firestore, 'users', credential.user.uid);
      await setDoc(userRef, {
        name: credentials.name || '',
        marketingConsent: !!marketingConsent,
        ...(credentials.signupAs ? { signupAs: credentials.signupAs } : {}),
      }, { merge: true });
      const redirect = sessionStorage.getItem('redirect');
      if (redirect) sessionStorage.removeItem('redirect');
      navigate(artistLoginRedirect(redirect, credential, FEATURES));
      sessionStorage.setItem('newUser', true);
      return { needsEmailVerify: true, emailSent, redirect };
    } catch (error) {
      throw { error };
    }
  };
  
const resetPassword = async (rawEmail) => {
  const email = (rawEmail || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw { message: 'Enter an email address like name@example.com.', status: 400 };
  }
  try {
    await httpClient.post('/auth/password-reset', { auth: false, body: { email } });
    return { sent: true };
  } catch (err) {
    if (err?.status === 429) throw { message: 'Too many attempts. Wait a few minutes, or reset your password.', status: 429 };
    throw { message: 'No connection. Check your signal and try again.', status: err?.status || 500 };
  }
};


  const logout = async (redirect = null) => {
    try {
      await signOut(auth);
      navigate(logoutDestination(redirect), { replace: true });
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
