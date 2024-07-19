import { useState } from "react";

export const ProfilePictureStage = ({ data, onChange }) => {
    const [preview, setPreview] = useState(data);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result);
                onChange('picture', reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="stage">
            <h2>Stage 2: Profile Picture</h2>
            <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
            />
            {preview && (
                <div className="image-preview">
                    <img src={preview} alt="Profile Preview" />
                </div>
            )}
        </div>
    );
};