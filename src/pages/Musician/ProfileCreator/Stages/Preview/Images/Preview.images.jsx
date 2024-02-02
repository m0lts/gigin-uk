// Icons and effects
    import { InsertImageIcon, XIcon } from "/components/Icons/Icons"

    
export const CoverImage = ({ coverImage, setCoverImage }) => {

    const handleImageChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setCoverImage(file);
        }
    };

    const removeImage = () => {
        setCoverImage(null);

        const input = document.getElementById(`cover`);
        if (input) {
            input.value = '';
        }
    };

    return (
        <div className="cover-image">
            <label htmlFor='cover'>
                {coverImage ? (
                    <>
                        <img
                            src={typeof coverImage === 'string' ? coverImage : URL.createObjectURL(coverImage)}
                            alt='Cover Photo Preview'
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
                        <span>Insert Cover Photo</span>
                    </>
                )}
            </label>
            <input
                type="file"
                id='cover'
                accept="image/*"
                className="image-input"
                onChange={(event) => handleImageChange(event)}
            />
        </div>
    )

}

export const ProfileImage = ({ profileImage, setProfileImage }) => {

    const handleImageChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setProfileImage(file);
          }
    };

    const removeImage = () => {
        setProfileImage(null);

        const input = document.getElementById(`profile`);
        if (input) {
            input.value = '';
        }
    };

    return (
        <div className="profile-image">
            <label htmlFor='profile'>
                {profileImage ? (
                    <>
                        <img
                            src={typeof profileImage === 'string' ? profileImage : URL.createObjectURL(profileImage)}
                            alt='Profile Photo Preview'
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
                        <span>Insert Profile Photo</span>
                    </>
                )}
            </label>
            <input
                type="file"
                id='profile'
                accept="image/*"
                className="image-input"
                onChange={(event) => handleImageChange(event)}
            />
        </div>
    )
}