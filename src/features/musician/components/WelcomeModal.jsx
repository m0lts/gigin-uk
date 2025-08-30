import { TextLogo } from '@features/shared/ui/logos/Logos';
import { NoTextLogo } from '../../shared/ui/logos/Logos';

export const WelcomeModal = ({ user, setShowWelcomeModal, role, revisiting = false }) => {


    const musicianVideoUrl =
        'https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/tutorials%2F544c446f-6596-44d8-8747-b52ac54bb82e.mp4?alt=media&token=9d461a3e-e5b0-481c-bfd7-06f6899fcb74';

    const venueVideoUrl =
        'https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/tutorials%2F544c446f-6596-44d8-8747-b52ac54bb82e.mp4?alt=media&token=9d461a3e-e5b0-481c-bfd7-06f6899fcb74';

    return (
        <div className='modal welcome'  onClick={() => setShowWelcomeModal(false)}>
            <div className='modal-content welcome' onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <NoTextLogo />
                    {revisiting ? (
                        <>
                            <h3>Dashboard Tutorial</h3>
                            <p>Revisit how the Gigin dashboard works.</p>
                        </>
                    ) : (
                        <>
                            <h3>Welcome to Gigin!</h3>
                            <p>Watch this video to familiarise yourself with the dashboard.</p>
                        </>
                    )}
                </div>
                {role === 'musician' ? (
                    <div className='modal-body'>
                        <video
                            src={musicianVideoUrl}
                            controls
                            style={{
                                width: '100%',
                                maxHeight: '60vh',
                            }}
                        />
                    </div>
                ) : (
                    <div className='modal-body'>
                        <video
                            src={venueVideoUrl}
                            controls
                            style={{
                                width: '100%',
                                maxHeight: '60vh',
                            }}
                        />
                    </div>
                )}
                <button className='btn tertiary close' onClick={() => setShowWelcomeModal(false)}>Close</button>
            </div>
        </div>
    )
};