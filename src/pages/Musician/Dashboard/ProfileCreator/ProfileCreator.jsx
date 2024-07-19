import { useState, useEffect } from 'react';
import { LeftChevronIcon } from '/components/ui/Extras/Icons'
import { v4 as uuidv4 } from 'uuid';
import useMapboxAccessToken from "../../../../hooks/useAccessTokens";
import { ProgressBar } from './ProgressBar';
import '/styles/musician/profile-creator.styles.css'

// Importing stage components
import { NameStage } from './NameStage';
import { ProfilePictureStage } from './ProfilePictureStage';
import { LocationStage } from './LocationStage';
import { GenresStage } from './GenresStage';
import { MusicTypeStage } from './MusicTypeStage';
import { InstrumentsStage } from './InstrumentsStage';
import { EquipmentStage } from './EquipmentStage';
import { BioStage } from './BioStage';
import { VideosStage } from './VideosStage';
import { TracksStage } from './TracksStage';
import { SocialMediaStage } from './SocialMediaStage';
import { FinalStage } from './FinalStage';
import { MusicianTypeStage } from './MusicianTypeStage';

export const ProfileCreator = () => {

    const mapboxToken = useMapboxAccessToken();

    const [stage, setStage] = useState(0);
    const [formData, setFormData] = useState({
        musicianId: uuidv4(),
        name: '',
        picture: '',
        location: { city: '', coordinates: [], travelDistance: '' },
        musicianType: '',
        genres: [],
        musicType: '',
        instruments: [],
        equipmentRequired: [],
        bio: {
            text: '',
            experience: '',
        },
        videos: [],
        tracks: [],
        socialMedia: {
            facebook: '',
            twitter: '',
            instagram: '',
            youtube: '',
            spotify: '',
            soundcloud: '',
        }
    });

    const handleNext = () => {
        if (validateStage(stage)) {
            setStage(prevStage => prevStage + 1);
        }
    };

    const handlePrevious = () => {
        setStage(prevStage => prevStage - 1);
    };

    const validateStage = (currentStage) => {
        switch (currentStage) {
            case 1:
                return formData.name.trim() !== '';
            case 2:
                return formData.picture.trim() !== '';
            case 3:
                return formData.location.city.trim() !== '';
            case 4:
                return formData.musicianType.trim() !== '';
            case 5:
                return formData.genres.length > 0;
            case 6:
                return formData.musicType.trim() !== '';
            case 7:
                return formData.instruments.length > 0;
            case 8:
                return true;
            case 9:
                return formData.bio.text.trim() !== '' && formData.bio.experience.trim() !== '';
            case 10:
                return formData.videos.length > 0;
            case 11:
                return formData.tracks.length > 0;
            case 12:
                return true;
            default:
                return true;
        }
    };

    const handleChange = (name, value) => {
        setFormData({
            ...formData,
            [name]: value
        });
    };

    const stages = [
        <>
            <h1>Welcome to the profile creator.</h1>
            <h4>Before you apply to gigs on Gigin, you need to show the venue your talent!</h4>
            <p>This should only take around 5 minutes. We advise that you have videos and tracks available to upload.</p>
        </>,
        <NameStage data={formData.name} onChange={handleChange} />,
        <ProfilePictureStage data={formData.picture} onChange={handleChange} />,
        <LocationStage data={formData.location} onChange={handleChange} mapboxToken={mapboxToken} />,
        <MusicianTypeStage data={formData.musicianType} onChange={handleChange} />,
        <GenresStage data={formData.genres} onChange={handleChange} musicianType={formData.musicianType} />,
        <MusicTypeStage data={formData.musicType} onChange={handleChange} />,
        <InstrumentsStage data={formData.instruments} onChange={handleChange} musicianType={formData.musicianType} />,
        <EquipmentStage data={formData.equipmentRequired} onChange={handleChange} instruments={formData.instruments} />,
        <BioStage data={formData.bio} onChange={handleChange} />,
        <VideosStage data={formData.videos} onChange={handleChange} />,
        <TracksStage data={formData.tracks} onChange={handleChange} />,
        <SocialMediaStage data={formData.socialMedia} onChange={handleChange} />,
        <FinalStage data={formData} />
    ];

    return (
        <div className="profile-creator">
            {stages[stage]}
            <ProgressBar currentStage={stage} totalStages={stages.length - 1} />
            <div className="controls">
                {stage > 0 && (
                    <button className='btn secondary' onClick={handlePrevious}>
                        <LeftChevronIcon />
                    </button>
                )}
                {stage < stages.length - 1 ? (
                    <button className='btn primary' onClick={handleNext} disabled={!validateStage(stage)}>Continue</button>
                ) : (
                    stage > 0 && <button className='btn primary' onClick={() => console.log('Submit form data', formData)} disabled={!validateStage(stage)}>Submit</button>
                )}
            </div>
        </div>
    );
};