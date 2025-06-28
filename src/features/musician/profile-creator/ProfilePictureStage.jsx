import { useEffect, useState } from 'react';
import { CameraIcon } from '@features/shared/ui/extras/Icons';

export const ProfilePictureStage = ({ data, onChange, band = false }) => {
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
        <div className='stage photo'>
            <h3 className='section-title'>{band === true ? 'Create Band' : 'Details'}</h3>
            <div className='body'>
                <h1>{band === true ? 'Upload a Band Profile Picture' : 'Upload a Profile Picture'}</h1>
                <div className='image-container'>
                    <input
                        className='input photo'
                        type='file'
                        accept='image/*'
                        onChange={handleFileChange}
                    />
                    <div className='image-preview' style={{ backgroundImage: `url(${preview})` }}>
                        {!preview && (
                            <CameraIcon />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};