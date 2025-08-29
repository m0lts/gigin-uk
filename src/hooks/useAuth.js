import { useState, useEffect, useRef } from 'react';
import { auth, firestore, googleProvider } from '@lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, signInWithPopup, fetchSignInMethodsForEmail, deleteUser, sendEmailVerification } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { createMusicianProfile } from '../services/musicians';

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
      // clean existing listeners when auth user changes
      if (userUnsubRef.current) { userUnsubRef.current(); userUnsubRef.current = null; }
      if (musicianUnsubRef.current) { musicianUnsubRef.current(); musicianUnsubRef.current = null; }
      currentMusicianIdRef.current = null;

      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const userDocRef = doc(firestore, 'users', firebaseUser.uid);

      // subscribe to users/{uid}
      userUnsubRef.current = onSnapshot(userDocRef, async (userSnap) => {
        if (!userSnap.exists()) {
          setUser({ uid: firebaseUser.uid, email: firebaseUser.email }); // bare minimum
          setLoading(false);
          return;
        }

        const rawUser = userSnap.data() || {};
        const userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          ...rawUser,
        };

        // —— venue profiles (one-off fetch; subscribe if you need live updates) ——
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

        // —— musician profile: subscribe live ——
        const musicianId =
          Array.isArray(rawUser.musicianProfile) && rawUser.musicianProfile.length
            ? rawUser.musicianProfile[0]
            : null;

        // (re)wire musician subscription if id changed
        if (musicianId !== currentMusicianIdRef.current) {
          // clean old sub
          if (musicianUnsubRef.current) {
            musicianUnsubRef.current();
            musicianUnsubRef.current = null;
          }
          currentMusicianIdRef.current = musicianId;

          if (musicianId) {
            const musicianRef = doc(firestore, 'musicianProfiles', musicianId);
            musicianUnsubRef.current = onSnapshot(musicianRef, (musSnap) => {
              const musicianData = musSnap.exists() ? { id: musicianId, ...musSnap.data() } : null;

              // merge latest musician into current user state
              setUser((prev) => ({
                ...(prev || userData), // fall back to current userData on first tick
                musicianProfile: musicianData || undefined,
              }));
              setLoading(false);
            }, (err) => {
              console.error('Musician snapshot error:', err);
            });
          } else {
            // no musician profile -> clear and update user
            setUser({ ...userData, musicianProfile: undefined });
            setLoading(false);
          }
        } else {
          // musician id unchanged; just update non-musician fields
          setUser((prev) => ({
            // keep any existing musicianProfile from the musician listener
            ...(prev || {}),
            ...userData,
            musicianProfile: prev?.musicianProfile, 
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
      const userDocData = userDoc.data() || {};
      setUser({ uid: userCredential.user.uid, ...userDocData });
      const venueProfiles = userDocData.venueProfiles || [];
      const redirect = sessionStorage.getItem('redirect');
      if (redirect === 'create-musician-profile') {
        sessionStorage.removeItem('redirect');
        return { redirect };
      }
      if (redirect) {
        navigate(redirect);
        sessionStorage.removeItem('redirect');
      } else if (venueProfiles.length > 0 && venueProfiles.some(v => v.completed)) {
        navigate('/venues/dashboard/gigs');
      } else if (venueProfiles.length > 0 && !venueProfiles.some(v => v.completed)) {
        navigate('/venues/add-venue');
      } else {
        navigate('/find-a-gig');
      }
      } catch (error) {
        setUser(null);
        throw { error };
      }
  };

  const actionCodeSettings = {
    url: `${window.location.origin}`,
    handleCodeInApp: false,
  };

  const signup = async (credentials, marketingConsent) => {
    try {
      const redirect = sessionStorage.getItem('redirect');
      const userCredential = await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
      if (redirect === 'create-musician-profile') {
        const musicianId = uuidv4();
        await createMusicianProfile(musicianId, {musicianId: musicianId, name: credentials.name, createdAt: Timestamp.now(), email: credentials.email}, userCredential.user.uid);
        await setDoc(doc(firestore, 'users', userCredential.user.uid), {
          name: credentials.name,
          email: credentials.email,
          marketingConsent: marketingConsent,
          createdAt: Date.now(),
          firstTimeInFinances: true,
          musicianProfile: [
            musicianId
          ],
        });
      } else {
        await setDoc(doc(firestore, 'users', userCredential.user.uid), {
          name: credentials.name,
          email: credentials.email,
          marketingConsent: marketingConsent,
          createdAt: Date.now(),
          firstTimeInFinances: true,
        });
      }
      await sendEmailVerification(userCredential.user, actionCodeSettings);
      setUser({ uid: userCredential.user.uid, ...credentials, firstTimeInFinances: true });
      sessionStorage.setItem('newUser', true)
      if (redirect === 'create-musician-profile') {
        sessionStorage.removeItem('redirect');
        return { redirect };
      }
      if (redirect) {
          navigate(redirect);
          sessionStorage.removeItem('redirect');
      } else {
        navigate('/');
      }
      return { needsEmailVerify: true };
    } catch (error) {
      console.log(error)
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
      navigate('/')
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  const loginWithGoogle = async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const { user } = cred;
      const ref = doc(firestore, 'users', user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        try {
          await deleteUser(user);
        } catch (_) {
          await signOut(auth);
        }
        toast.error('No Gigin account is linked to this Google account. Please sign up first.')
        throw {
          error: {
            code: 'auth/account-not-registered',
            message:
              'No Gigin account is linked to this Google account. Please sign up and accept the Terms first.',
          },
        };
      }
      const userDoc = await getDoc(ref);
      const userDocData = userDoc.data() || {};
      setUser({ uid: user.uid, ...userDocData, email: user.email });
      const venueProfiles = userDocData.venueProfiles || [];
      const redirect = sessionStorage.getItem('redirect');
      if (redirect === 'create-musician-profile') {
        sessionStorage.removeItem('redirect');
        return { redirect };
      }
      if (redirect) {
        navigate(redirect);
        sessionStorage.removeItem('redirect');
      } else if (venueProfiles.length > 0 && venueProfiles.some(v => v.completed)) {
        navigate('/venues/dashboard/gigs');
      } else if (venueProfiles.length > 0 && !venueProfiles.some(v => v.completed)) {
        navigate('/venues/add-venue');
      } else {
        navigate('/find-a-gig');
      }
    } catch (error) {
      if (error?.code === 'auth/account-exists-with-different-credential') {
        const email = error.customData?.email;
        const methods = email ? await fetchSignInMethodsForEmail(auth, email) : [];
        throw {
          error: {
            code: error.code,
            message: `Account already exists with: ${methods.join(', ')}`,
          },
        };
      } else if (error?.code === 'auth/popup-closed-by-user') {
        throw {
          error: {
            code: error.code,
            message: 'Request timed out',
          },
        };
      }
      throw { error };
    }
  };
  
  const signupWithGoogle = async (marketingConsent) => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const redirect = sessionStorage.getItem('redirect');
      const { user } = cred;
      let musicianId;
      if (redirect === 'create-musician-profile') {
        musicianId = uuidv4();
        createMusicianProfile(musicianId, {musicianId: musicianId, name: user.displayName, createdAt: Timestamp.now(), email: user.email}, user.uid);
      }
      const ref = doc(firestore, 'users', user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          name: user.displayName || '',
          email: user.email || '',
          marketingConsent,
          createdAt: Date.now(),
          emailVerified: true,
          firstTimeInFinances: true,
          musicianProfile: [
            musicianId
          ]
        });
      }
      const userDoc = await getDoc(ref);
      const userDocData = userDoc.data() || {};
      setUser({ uid: user.uid, ...userDocData, email: user.email, firstTimeInFinances: true });
      if (redirect === 'create-musician-profile') {
        sessionStorage.removeItem('redirect');
        return { redirect };
      }
      if (redirect) {
        navigate(redirect);
        sessionStorage.removeItem('redirect');
      } else {
        navigate('/');
      }
    } catch (error) {
      if (error?.code === 'auth/popup-closed-by-user') {
        throw {
          error: {
            code: error.code,
            message: `Request timed out`,
          }
        };
      }
      throw { error };
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
    loginWithGoogle,
    signupWithGoogle
  };
};


  // useEffect(() => {
  //   const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
  //     if (firebaseUser) {
  //       try {
  //         const userDocRef = doc(firestore, 'users', firebaseUser.uid);
  //         const unsubscribeUserDoc = onSnapshot(userDocRef, async (userDocSnapshot) => {
  //           const userData = { uid: firebaseUser.uid, ...userDocSnapshot.data(), email: firebaseUser.email };
  //           let userMusicianProfile = null;
  //           let userVenueProfiles = [];
  //           if (userData.musicianProfile && userData.musicianProfile.length > 0) {
  //             const musicianProfileRef = doc(firestore, 'musicianProfiles', userData.musicianProfile[0]);
  //             const musicianProfileDoc = await getDoc(musicianProfileRef);
  //             if (musicianProfileDoc.exists()) {
  //               userMusicianProfile = musicianProfileDoc.data();
  //               userData.musicianProfile = userMusicianProfile;
  //             }
  //           } else {
  //             delete userData.musicianProfile;
  //           }
  //           if (userData.venueProfiles && userData.venueProfiles.length > 0) {
  //             const venueProfilePromises = userData.venueProfiles.map(async (venueProfileId) => {
  //               const venueProfileRef = doc(firestore, 'venueProfiles', venueProfileId);
  //               const venueProfileDoc = await getDoc(venueProfileRef);
  //               if (venueProfileDoc.exists()) {
  //                 return { id: venueProfileId, ...venueProfileDoc.data() };
  //               }
  //               return null;
  //             });
  //             userVenueProfiles = await Promise.all(venueProfilePromises);
  //             userData.venueProfiles = userVenueProfiles.filter(profile => profile !== null);
  //           }
  //           setUser(userData);
  //           setLoading(false);
  //         });
  //         return () => {
  //           unsubscribeUserDoc();
  //           setLoading(false);
  //         };
  //       } catch (error) {
  //         console.error('Error fetching user data:', error);
  //         setUser(null);
  //         setLoading(false);
  //       }
  //     } else {
  //       setUser(null);
  //       setLoading(false);
  //     }
  //   });

  //   return () => {
  //     unsubscribeAuth();
  //     setLoading(false);
  //   };
  // }, [navigate]);