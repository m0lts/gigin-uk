import { useEffect, useState } from 'react';
import { CameraIcon } from '@features/shared/ui/extras/Icons';

export const ProfilePictureStage = ({ data, onChange, band = false }) => {
    const [preview, setPreview] = useState('');

    useEffect(() => {
        let url;
        if (typeof data === 'string') {
          setPreview(data);
        } else if (data instanceof File) {
          url = URL.createObjectURL(data);
          setPreview(url);
        }
        return () => { if (url) URL.revokeObjectURL(url); };
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
            <div className='body'>
                <h2>{band === true ? 'Upload a Band Profile Picture' : 'Upload a Profile Picture'}</h2>
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