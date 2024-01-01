import { useState, useEffect } from "react";
import { CircleIcon, InsertImageIcon, XIcon } from "../../Icons/Icons"
import { SingleImageInput } from "../../Images/ImageInputs"

export const MusicianProfilePreview = ({ userProfile, profileImages, setProfileImages }) => {

    const [image, setImage] = useState(profileImages && profileImages.length > 0 ? profileImages[0] : null);

    useEffect(() => {
        setProfileImages([image]);
    }, [image])

    // Image addition and removal
    const handleImageChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImage(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const removeImage = () => {
        setImage(null);
        const input = document.getElementById(`image-input`);
        if (input) {
            input.value = '';
        }
    };

    return (
        <div className='profile-preview profile-creator-stage'>
            <h1 className='title'>Profile Preview</h1>
            <p className="text">This is a rough overview of how your profile will look to hosts.</p>
            <div className="musician-preview flex-column">
                <div className="top relative">
                    <div className="profile-photo">
                    <div className="single-image-input-cont">
                        <label htmlFor='image-input' className="insert-image-label">
                            {image ? (
                                <>
                                    <img
                                        src={image}
                                        alt='Preview'
                                        className="preview-image"
                                        
                                    />
                                    <div className="remove-image" onClick={removeImage}>
                                        <XIcon />
                                        <span>Remove Image</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <InsertImageIcon />
                                    <span>Insert Image</span>
                                </>
                            )}
                        </label>
                        <input
                            type="file"
                            id='image-input'
                            accept="image/*"
                            className="image-input"
                            onChange={(event) => handleImageChange(event)}
                        />
                    </div>
                    </div>
                </div>
                <div className="title-cont">
                    <h1>{userProfile.profileName}</h1>
                </div>
                <ul className="middle flex">
                    <li>{userProfile.musicianType.map((type) => (
                        <span className="list-of-items">{type}</span>
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
                            {userProfile.musicianInstruments.map((instrument) => (
                                <li>{instrument}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    )
}