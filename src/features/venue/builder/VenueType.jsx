import { useNavigate } from 'react-router-dom';
import { PeopleRoofIconLight, HouseIconSolid, HouseIconLight, PeopleRoofIconSolid } from '@features/shared/ui/extras/Icons';
import { motion, AnimatePresence } from 'framer-motion';

export const VenueType = ({ formData, handleInputChange, setStepError, stepError }) => {

    const navigate = useNavigate();

    const handleNext = () => {
        if (formData.type === '') {
            setStepError('Please choose a venue type before continuing.');
            return;
        }
        setStepError(null);
        navigate('/venues/add-venue/venue-details');
    };

    return (
        <div className='stage type'>
            <div className="stage-content">
                <div className="stage-definition">
                    <h1 className='stage-title'>What Type of Venue Are You?</h1>
                    <p className='stage-copy'>Different venue types have different settings. We need to know your venue type so that we can match you with the best musicians.</p>
                </div>
                <div className='venue-type'>
                    <button className={`card large ${formData.type === 'Public Establishment' && 'selected'} ${formData.type === '' && stepError ? 'error' : ''}`} onClick={() => handleInputChange('type', 'Public Establishment')}>
                    <AnimatePresence mode="wait">
                        <motion.span
                            key={formData.type}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.2 }}
                        >
                            {formData.type === 'Public Establishment' ? <PeopleRoofIconSolid /> : <PeopleRoofIconLight />}
                        </motion.span>
                        </AnimatePresence>
                        <span className='title'>Public Establishment</span>
                        e.g. Pub, Music venue, Restaurant, Church
                    </button>
                    <button className={`card large ${formData.type === 'Personal Space' && 'selected'} ${formData.type === '' && stepError ? 'error' : ''}`} onClick={() => handleInputChange('type', 'Personal Space')}>
                    <AnimatePresence mode="wait">
                        <motion.span
                            key={formData.type}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.2 }}
                        >
                            {formData.type === 'Personal Space' ? <HouseIconSolid /> : <HouseIconLight />}
                        </motion.span>
                        </AnimatePresence>
                        <span className='title'>Personal Space</span>
                        e.g. House, Wedding, Private party
                    </button>
                </div>
            </div>
            <div className='stage-controls single'>
                <button className='btn primary' onClick={handleNext}>
                    Continue
                </button>
            </div>
        </div>
    );
};