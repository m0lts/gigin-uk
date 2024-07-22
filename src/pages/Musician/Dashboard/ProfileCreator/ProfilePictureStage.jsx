import { useEffect, useState } from "react";
import { CameraIcon, CloseIcon } from "../../../../components/ui/Extras/Icons";

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

    return (
        <div className="stage photo">
            <h3 className="section-title">Details</h3>
            <div className="body">
                <h1>Upload a Profile Picture</h1>
                <div className="image-container">
                    <input
                        className="input photo"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                    />
                    <div className="image-preview" style={{ backgroundImage: `url(${preview})` }}>
                        {!preview && (
                            <CameraIcon />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};