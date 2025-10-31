import { useEffect, useMemo, useState } from 'react';
import { NoTextLogo } from '@features/shared/ui/logos/Logos';
import { fetchTutorialVideos, getTutorialTitles } from '../../../services/storage';

/**
 * WelcomeModal
 *
 * A modal component that displays a video tutorial based on the user's role.
 * The component is used to introduce users to the app and can be revisited later on.
 *
 * @param {Object} props - Component props
 * @param {Function} props.setShowWelcomeModal - Function to set showWelcomeModal state
 * @param {String} props.role - User role
 * @param {Boolean} props.revisiting - Whether the modal should be shown in revising mode
 */
export const WelcomeModal = ({
  setShowWelcomeModal,
  role,
  revisiting = false,
  financesOnly = false
}) => {
  const [videos, setVideos] = useState(null);
  const [activeTutorial, setActiveTutorial] = useState(null);
  const titles = useMemo(() => getTutorialTitles(role), [role]);

  useEffect(() => {
    let isMounted = true;
    setVideos(null);
    setActiveTutorial(null);
    fetchTutorialVideos(role)
      .then((map) => {
        if (!isMounted) return;
        setVideos(map);

        // ✅ If financesOnly, set the "Finances" tutorial directly
        if (financesOnly && map['Finances']) {
          setActiveTutorial('Finances');
        } else {
          const first = Object.keys(map)[0];
          setActiveTutorial(first || null);
        }
      })
      .catch((err) => {
        console.error('Failed to load tutorial videos:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [role, financesOnly]);

  return (
    <div className='modal welcome' onClick={() => setShowWelcomeModal(false)}>
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
          {/* ✅ Hide tab buttons if financesOnly */}
          {!financesOnly && (
            <div
              className="tabs"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: '0.5rem',
                marginBottom: '1rem'
              }}
            >
              {titles.map((title) => (
                <button
                  key={title}
                  className={`btn tertiary ${activeTutorial === title ? 'active' : ''}`}
                  onClick={() => setActiveTutorial(title)}
                  disabled={!videos}
                >
                  {title}
                </button>
              ))}
            </div>
          )}

          {!videos || !activeTutorial ? (
            <div style={{ padding: '1rem' }}>Loading video…</div>
          ) : (
            <video
              key={activeTutorial}
              src={videos[activeTutorial]}
              controls
              style={{ width: '100%', maxHeight: '60vh' }}
            />
          )}
        </div>

        <button className='btn tertiary close' onClick={() => setShowWelcomeModal(false)}>Close</button>
      </div>
    </div>
  );
};