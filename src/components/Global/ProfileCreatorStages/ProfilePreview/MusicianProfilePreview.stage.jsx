import { useState, useEffect } from "react";
import { CircleIcon, InsertImageIcon, XIcon } from "../../Icons/Icons"
import { SingleImageInput } from "../../Images/ImageInputs"
import { CoverImage, ProfileImage } from "../../../Musicians/ProfileCreatorStages/MusicianImages/MusicianImages";

export const MusicianProfilePreview = ({ userProfile, profileImages, setProfileImages, setSaveButtonAvailable }) => {

    const [profileImage, setProfileImage] = useState(userProfile.profileImages.profileImage ? userProfile.profileImages.profileImage : null);
    const [coverImage, setCoverImage] = useState(userProfile.profileImages.coverImage ? userProfile.profileImages.coverImage : null);

    useEffect(() => {
        setProfileImages(
            {
                profileImage: profileImage,
                coverImage: coverImage
            }
        )
    }, [profileImage, coverImage])

    useEffect(() => {
        setSaveButtonAvailable(true);
    }, [])

    return (
        <div className='profile-preview profile-creator-stage'>
            <h1 className='title'>Profile Preview</h1>
            <p className="text">This is a rough overview of how your profile will look to hosts.</p>
            <div className="musician-preview flex-column">
                <div className="top relative">
                    <div className="cover-photo">
                        <CoverImage
                            coverImage={coverImage}
                            setCoverImage={setCoverImage}
                        />
                    </div>
                    <div className="profile-photo">
                        <ProfileImage
                            profileImage={profileImage}
                            setProfileImage={setProfileImage}
                        />
                    </div>
                </div>
                <div className="title-cont">
                    <h1>{userProfile.profileName}</h1>
                </div>
                <ul className="middle flex">
                    <li>{userProfile.musicianType.map((type, index) => (
                        <span key={index} className="list-of-items">{type}</span>
                    ))}</li>
                    <li><CircleIcon /></li>
                    <li>{userProfile.musicianExtraInfo.musicType}</li>
                    <li><CircleIcon /></li>
                    <li>{userProfile.musicianExtraInfo.genres.map((genre) => (
                        <span>{genre} </span>
                    ))}</li>
                </ul>
                <div className="bio">
                    <h3 className="subtitle">Bio</h3>
                    <p>{userProfile.musicianExtraInfo.bio}</p>
                </div>
                {userProfile.musicianInstruments && userProfile.musicianInstruments.length > 0 && (
                    <div className="instruments">
                        <h3 className="subtitle">Instruments</h3>
                        <ul className="list-of-instruments">
                            {userProfile.musicianInstruments.map((instrument, index) => (
                                <li key={index}>{instrument}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    )
}