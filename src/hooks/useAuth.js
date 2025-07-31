import { useState, useEffect } from 'react';
import { auth, firestore } from '@lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

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
      const musicianProfile = userDocData.musicianProfile || [];
      const venueProfiles = userDocData.venueProfiles || [];
      const redirect = sessionStorage.getItem('redirect');
      if (redirect) {
        navigate(redirect);
        sessionStorage.removeItem('redirect');
      } else if (venueProfiles.length > 0 && !venueProfiles.some(v => v.completed)) {
        navigate('/venues/add-venue');
      } else if (venueProfiles.some(v => v.completed)) {
        navigate('/venues/dashboard');
      } else {
        navigate('/find-a-gig');
      }
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
      const redirect = sessionStorage.getItem('redirect');
      if (redirect) {
          navigate(redirect);
          sessionStorage.removeItem('redirect');
      } else {
        navigate('/');
      }
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
