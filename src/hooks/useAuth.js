import { useState, useEffect } from 'react';
import { auth, firestore, googleProvider } from '@lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, signInWithPopup, fetchSignInMethodsForEmail, deleteUser, sendEmailVerification } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export const useAuth = () => {

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDocRef = doc(firestore, 'users', firebaseUser.uid);
          const unsubscribeUserDoc = onSnapshot(userDocRef, async (userDocSnapshot) => {
            const userData = { uid: firebaseUser.uid, ...userDocSnapshot.data(), email: firebaseUser.email };
            let userMusicianProfile = null;
            let userVenueProfiles = [];
            if (userData.musicianProfile && userData.musicianProfile.length > 0) {
              const musicianProfileRef = doc(firestore, 'musicianProfiles', userData.musicianProfile[0]);
              const musicianProfileDoc = await getDoc(musicianProfileRef);
              if (musicianProfileDoc.exists()) {
                userMusicianProfile = musicianProfileDoc.data();
                userData.musicianProfile = userMusicianProfile;
              }
            } else {
              delete userData.musicianProfile;
            }
            if (userData.venueProfiles && userData.venueProfiles.length > 0) {
              const venueProfilePromises = userData.venueProfiles.map(async (venueProfileId) => {
                const venueProfileRef = doc(firestore, 'venueProfiles', venueProfileId);
                const venueProfileDoc = await getDoc(venueProfileRef);
                if (venueProfileDoc.exists()) {
                  return { id: venueProfileId, ...venueProfileDoc.data() };
                }
                return null;
              });
              userVenueProfiles = await Promise.all(venueProfilePromises);
              userData.venueProfiles = userVenueProfiles.filter(profile => profile !== null);
            }
            setUser(userData);
            setLoading(false);
          });
          return () => {
            unsubscribeUserDoc();
            setLoading(false);
          };
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUser(null);
          setLoading(false);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      setLoading(false);
    };
  }, [navigate]);
  
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
      if (redirect) {
        console.log(redirect)
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
      const userCredential = await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
      await setDoc(doc(firestore, 'users', userCredential.user.uid), {
        name: credentials.name,
        email: credentials.email,
        marketingConsent: marketingConsent,
        createdAt: Date.now(),
        firstTimeInFinances: true,
      });
      await sendEmailVerification(userCredential.user, actionCodeSettings);
      setUser({ uid: userCredential.user.uid, ...credentials, firstTimeInFinances: true });
      const redirect = sessionStorage.getItem('redirect');
      sessionStorage.setItem('newUser', true)
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
      const { user } = cred;
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
        });
      }
      const userDoc = await getDoc(ref);
      const userDocData = userDoc.data() || {};
      setUser({ uid: user.uid, ...userDocData, email: user.email, firstTimeInFinances: true });
      const redirect = sessionStorage.getItem('redirect');
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
