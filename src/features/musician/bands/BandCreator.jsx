import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { NameStage } from '@features/musician/profile-creator/NameStage';
import { ProfilePictureStage } from '@features/musician/profile-creator/ProfilePictureStage';
import { ProgressBar } from '@features/musician/profile-creator/ProgressBar';
import { useAuth } from '@hooks/useAuth';
import { uploadFileToStorage } from '@services/storage';
import { createBandProfile } from '@services/bands';
import { updateUserDocument } from '@services/users';
import { updateMusicianProfile } from '@services/musicians';
import { generateBandPassword } from '@services/utils/validation';
import { arrayUnion } from 'firebase/firestore';
import { useNavigate, useSearchParams } from 'react-router-dom';

export const BandCreator = ({ musicianProfile }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const stepFromUrl = parseInt(searchParams.get('step') || '0');
    const [stage, setStage] = useState(stepFromUrl);
    const [formData, setFormData] = useState({
      bandId: uuidv4(),
      name: '',
      picture: '',
    });
    const [error, setError] = useState(null);

    useEffect(() => {
      setSearchParams({ step: stage.toString() });
    }, [stage, setSearchParams]);
  
    const handleChange = (key, value) => {
      setFormData(prev => ({ ...prev, [key]: value }));
    };
  
    const validateStage = () => {
      if (stage === 0 && formData.name.trim() === '') {
        setError('name');
        return false;
      }
      if (stage === 1 && !formData.picture) {
        setError('picture');
        return false;
      }
      setError(null);
      return true;
    };
  
    const handleNext = () => {
      if (validateStage()) {
        setStage(prev => prev + 1);
      }
    };
  
    const handlePrevious = () => {
      if (stage === 0) {
        navigate('/dashboard/bands', { replace: true });
      } else {
        setStage(prev => prev - 1);
      }
    };
    
    const handleSubmit = async () => {
      try {
        const pictureFile = formData.picture;
        const pictureUrl = await uploadFileToStorage(pictureFile, `bands/${formData.bandId}/profileImg/${pictureFile.name}`);
        const bandPassword = generateBandPassword();
        const updatedFormData = {
          ...formData,
          picture: pictureUrl,
          completed: false,
          bandProfile: false,
          email: user?.email,
          joinPassword: bandPassword,
          admin: {
            userId: user?.uid,
            musicianId: musicianProfile.id,
          },
          members: [musicianProfile.id]
        };
        await createBandProfile(formData.bandId, updatedFormData, user.uid, musicianProfile);
        await updateUserDocument(user.uid, {
            bands: arrayUnion(formData.bandId)
        })
        await updateMusicianProfile(musicianProfile.id, {
            bands: arrayUnion(formData.bandId)
        })
        navigate(`/dashboard/bands/${formData.bandId}`, {
          state: { band: updatedFormData },
        });
      } catch (e) {
        console.error('Error submitting band:', e);
      }
    };

    const stages = [
      <NameStage
        key="name"
        data={formData.name}
        onChange={handleChange}
        user={user}
        error={error}
        setError={setError}
        band={true}
      />,
      <ProfilePictureStage
        key="picture"
        data={formData.picture}
        onChange={handleChange}
        error={error}
        setError={setError}
        band={true}
      />,
    ];
  
    return (
      <div className="profile-creator band">
        {stages[stage]}
        <div className="bottom">
          <div className="controls">
            <button className="btn secondary" onClick={handlePrevious}>Back</button>
            {stage < stages.length - 1 ? (
              <button className="btn primary" onClick={handleNext}>Continue</button>
            ) : (
              <button className="btn primary" onClick={handleSubmit}>Create</button>
            )}
          </div>
        </div>
      </div>
    );
  };