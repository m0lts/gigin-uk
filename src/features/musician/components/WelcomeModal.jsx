import { TextLogo } from '@features/shared/ui/logos/Logos';
import { NoTextLogo } from '../../shared/ui/logos/Logos';
import { useState } from 'react';

export const WelcomeModal = ({ user, setShowWelcomeModal, role, revisiting = false }) => {


    const musicianVideos = {
        'Finding Gigs':
          'https://firebasestorage.googleapis.com/v0/b/giginltd-16772.firebasestorage.app/o/tutorials%2Fmusician%2Ffinding-gigs.mp4?alt=media&token=ecc3857d-1505-4080-996d-227a940c27bb',
        'Dashboard':
          'https://firebasestorage.googleapis.com/v0/b/giginltd-16772.firebasestorage.app/o/tutorials%2Fmusician%2Fdashboard.mp4?alt=media&token=25b94994-530f-498d-8520-6b7c3855278e',
        'Finances':
          'https://firebasestorage.googleapis.com/v0/b/giginltd-16772.firebasestorage.app/o/tutorials%2Fmusician%2Ffinances.mp4?alt=media&token=bf2b3bc7-6ac0-4fb9-920e-6c2ea78b4abe',
      };
    
      const venueVideos = {
        'Creating Gigs':
          'https://firebasestorage.googleapis.com/v0/b/giginltd-16772.firebasestorage.app/o/tutorials%2Fvenue%2Fcreating-gigs.mp4?alt=media&token=c664835f-48c8-4626-acd4-d834e6f10226',
        'Dashboard':
          'https://firebasestorage.googleapis.com/v0/b/giginltd-16772.firebasestorage.app/o/tutorials%2Fvenue%2Fdashboard.mp4?alt=media&token=d1240813-c98b-42e4-b2c7-de458c7a9455',
        'Paying for Gigs':
          'https://firebasestorage.googleapis.com/v0/b/giginltd-16772.firebasestorage.app/o/tutorials%2Fvenue%2Fpaying-for-gigs.mp4?alt=media&token=254a5c2b-8ece-442d-bff7-efb304c63861',
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