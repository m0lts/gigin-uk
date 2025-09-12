import { TextLogo } from '@features/shared/ui/logos/Logos';
import { NoTextLogo } from '../../shared/ui/logos/Logos';
import { useState } from 'react';

export const WelcomeModal = ({ user, setShowWelcomeModal, role, revisiting = false }) => {


    const musicianVideos = {
        'Finding Gigs':
          'https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/tutorials/musician/finding-gigs.mp4?alt=media&token=9d461a3e-e5b0-481c-bfd7-06f6899fcb74',
        'Dashboard':
          'https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/tutorials/musician/dashboard.mp4?alt=media&token=9d461a3e-e5b0-481c-bfd7-06f6899fcb74',
        'Finances':
          'https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/tutorials/musician/finances.mp4?alt=media&token=9d461a3e-e5b0-481c-bfd7-06f6899fcb74',
      };
    
      const venueVideos = {
        'Creating Gigs':
          'https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/tutorials/venue/creating-gigs.mp4?alt=media&token=9d461a3e-e5b0-481c-bfd7-06f6899fcb74',
        'Dashboard':
          'https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/tutorials/venue/dashboard.mp4?alt=media&token=9d461a3e-e5b0-481c-bfd7-06f6899fcb74',
        'Paying for Gigs':
          'https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/tutorials/venue/paying-for-gigs.mp4?alt=media&token=9d461a3e-e5b0-481c-bfd7-06f6899fcb74',
      };
    
      const tabs = role === 'musician' ? musicianVideos : venueVideos;
      const [activeTab, setActiveTab] = useState(Object.keys(tabs)[0]);
    return (
        <div className='modal welcome'  onClick={() => setShowWelcomeModal(false)}>
            <div className='modal-content welcome' onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <NoTextLogo />
                    {revisiting ? (
                        <>
                            <h3>Dashboard Tutorial</h3>
                            <p>Revisit how Gigin works.</p>
                        </>
                    ) : (
                        <>
                            <h3>Welcome to Gigin!</h3>
                            <p>Watch these videos to familiarise yourself with Gigin.</p>
                        </>
                    )}
                </div>
                <div className="modal-body">
      <div className="tabs" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap:'0.5rem', marginBottom: '1rem'}}>
        {Object.keys(tabs).map((tab) => (
          <button
            key={tab}
            className={`btn tertiary ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <video
        key={activeTab} // ensures video reloads when tab changes
        src={tabs[activeTab]}
        controls
        style={{ width: '100%', maxHeight: '60vh' }}
      />
    </div>                <button className='btn tertiary close' onClick={() => setShowWelcomeModal(false)}>Close</button>
            </div>
        </div>
    )
};