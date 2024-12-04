import React, { useState, useEffect } from 'react';
import '../../assets/styles/common/promote-modal.styles.css';
import { FacebookIcon, InstagramIcon, SoundcloudIcon, SpotifyIcon, TwitterIcon, YoutubeIcon } from '../ui/Extras/Icons';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../../firebase';

export const PromoteModal = ({ socialLinks, setShowSocialsModal, musicianId, venueId }) => {

    const [socials, setSocials] = useState(socialLinks);

    useEffect(() => {
        const fetchMusicianProfile = async () => {
            try {
                const profileRef = doc(firestore, 'musicianProfiles', musicianId);
                const profileSnapshot = await getDoc(profileRef);
                if (profileSnapshot.exists()) {
                    const musicianProfile = profileSnapshot.data();
                    setSocials(musicianProfile.socialMedia || {});
                } else {
                    console.warn('Musician profile not found');
                    setSocials(null);
                }
            } catch (error) {
                console.error('Error fetching musician profile:', error);
            }
        };

        const fetchVenueProfile = async () => {
            try {
                const profileRef = doc(firestore, 'venueProfiles', venueId);
                const profileSnapshot = await getDoc(profileRef);
                if (profileSnapshot.exists()) {
                    const venueProfile = profileSnapshot.data();
                    setSocials(venueProfile.socialMedia || {});
                } else {
                    console.warn('Venue profile not found');
                    setSocials(null);
                }
            } catch (error) {
                console.error('Error fetching venue profile:', error);
            }
        };

        if (!socialLinks) {
            if (musicianId) {
                fetchMusicianProfile();
            } else if (venueId) {
                fetchVenueProfile();
            }
        }
    }, [socialLinks, musicianId]);

    return (
        <div className="modal">
            <div className="modal-content promote">
                <h2>Share the gig details on your Social Media!</h2>
                {socials && Object.keys(socials).length > 0 ? (
                    <ul className='socials-links'>
                        {socials?.facebook && <li><a className='btn secondary' href={socials.facebook} target="_blank" rel="noreferrer"><FacebookIcon /> Facebook</a></li>}
                        {socials?.twitter && <li><a className='btn secondary' href={socials.twitter} target="_blank" rel="noreferrer"><TwitterIcon /> Twitter</a></li>}
                        {socials?.instagram && <li><a className='btn secondary' href={socials.instagram} target="_blank" rel="noreferrer"><InstagramIcon /> Instagram</a></li>}
                        {socials?.spotify && <li><a className='btn secondary' href={socials.spotify} target='_blank' rel='noreferrer'><SpotifyIcon /> Spotify</a></li>}
                        {socials?.youtube && <li><a className='btn secondary' href={socials.youtube} target='_blank' rel='noreferrer'><YoutubeIcon /> Youtube</a></li>}
                        {socials?.soundcloud && <li><a className='btn secondary' href={socials.soundcloud} target='_blank' rel='noreferrer'><SoundcloudIcon /> Soundcloud</a></li>}
                    </ul>
                ) : (
                    <p>No social media links found</p>
                )}
                <button className="btn tertiary close" onClick={() => setShowSocialsModal(false)}>
                    Close
                </button>
            </div>
        </div>
    );
};

