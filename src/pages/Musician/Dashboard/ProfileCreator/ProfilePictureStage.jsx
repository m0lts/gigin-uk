import { useEffect, useState } from "react";
import { CloseIcon } from "../../../../components/ui/Extras/Icons";

export const ProfilePictureStage = ({ data, onChange }) => {
    const [preview, setPreview] = useState('');

    useEffect(() => {
        if (typeof data === 'string') {
            setPreview(data);
        } else if (data instanceof File) {
            setPreview(URL.createObjectURL(data));
        }
    }, [data]);

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setPreview(URL.createObjectURL(file));
            onChange('picture', file);
        }
    };

    const removeImage = () => {
        setPreview('');
        onChange('picture', '');
    };

    return (
        <div className="stage">
            <h2>Stage 2: Profile Picture</h2>
            <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
            />
            {preview && (
                <div className="image-preview">
                    <img src={preview} alt="Profile Preview" />
                    <button className="remove-button" onClick={removeImage}>
                        <CloseIcon />
                    </button>
                </div>
            )}
        </div>
    );
};