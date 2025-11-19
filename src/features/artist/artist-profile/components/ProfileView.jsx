import { useMemo, useEffect } from 'react';
import { Bio } from './Bio';
import { VideosTracks } from './VideosTracks';
import { DarkModeToggle } from './DarkModeToggle';
import { ProfileCreationBox, CREATION_STEP_ORDER } from './ProfileCreationBox';

/**
 * ProfileView Component
 * Main view for the Profile state showing all sub-components
 * 
 * @param {Object} profileData - The artist profile data (can be example or real)
 * @param {Function} onBeginCreation - Callback when user clicks to start creating profile
 * @param {boolean} isExample - Whether this is showing example data
 */

// Example artist profiles - randomly selected when user views example profile
const EXAMPLE_PROFILES = [
  {
    name: 'Childish Gambino',
    bio: 'Donald McKinley Glover Jr., formerly known by his musical stage name Childish Gambino, is an American musician, rapper, singer, actor, comedian, and filmmaker.',
    videos: [
      { thumbnail: 'https://www.horizonsmusic.co.uk/cdn/shop/products/1_2bd57201-d43c-4c11-a4c3-bf3797e8fc9e.jpg?v=1647448351', title: '3005' },
      { thumbnail: 'https://upload.wikimedia.org/wikipedia/en/1/10/Childish_Gambino_-_Awaken%2C_My_Love%21.png', title: 'Redbone' }
    ],
    tracks: [
      { title: '3005', artist: 'Childish Gambino', thumbnail: 'https://www.horizonsmusic.co.uk/cdn/shop/products/1_2bd57201-d43c-4c11-a4c3-bf3797e8fc9e.jpg?v=1647448351' },
      { title: 'Redbone', artist: 'Childish Gambino', thumbnail: 'https://upload.wikimedia.org/wikipedia/en/1/10/Childish_Gambino_-_Awaken%2C_My_Love%21.png' }
    ],
    backgroundImage: 'https://altcitizen.com/wp-content/uploads/2020/03/donald.jpg'
  },
  {
    name: 'Olivia Dean',
    bio: 'Olivia Lauryn Dean is an English singer and songwriter. In 2021, Dean was named the breakthrough artist of the year by Amazon Music',
    videos: [
      { thumbnail: 'https://upload.wikimedia.org/wikipedia/en/b/bf/Olivia_Dean_-_The_Art_of_Loving.png', title: 'The Art of Loving' },
      { thumbnail: 'https://f4.bcbits.com/img/a1894279631_16.jpg', title: 'Dive' }
    ],
    tracks: [
      { title: 'The Art of Loving', artist: 'Olivia Dean', thumbnail: 'https://upload.wikimedia.org/wikipedia/en/b/bf/Olivia_Dean_-_The_Art_of_Loving.png' },
      { title: 'Dive', artist: 'Olivia Dean', thumbnail: 'https://f4.bcbits.com/img/a1894279631_16.jpg' }
    ],
    backgroundImage: 'https://atwoodmagazine.com/wp-content/uploads/2025/10/Olivia-Dean-The-Art-of-Loving-by-Lola-Mansell-5a.jpeg'
  },
  {
    name: '10cc',
    bio: "10cc is an English pop rock band formed in 1972 in Manchester, England. The band is best known for their hit songs 'I'm Not in Love' and 'The Things We Do for Love.'",
    videos: [
      { thumbnail: 'https://m.media-amazon.com/images/I/91YU2uIDqEL._UF894,1000_QL80_.jpg', title: 'I\'m Not in Love' },
      { thumbnail: 'https://i.scdn.co/image/ab67616d0000b273f93159d78849714fcf118bb3', title: 'The Things We Do for Love' }
    ],
    tracks: [
      { title: 'I\'m Not in Love', artist: '10cc', thumbnail: 'https://m.media-amazon.com/images/I/91YU2uIDqEL._UF894,1000_QL80_.jpg' },
      { title: 'The Things We Do for Love', artist: '10cc', thumbnail: 'https://i.scdn.co/image/ab67616d0000b273f93159d78849714fcf118bb3' }
    ],
    backgroundImage: 'https://recordstore.co.uk/cdn/shop/files/SharedImage-146581.jpg?v=1748043470'
  },
  {
    name: 'Paolo Nutini',
    bio: 'Paul John Nutini is a Scottish singer-songwriter. He rose to fame in 2006 with the release of his debut album, "These Streets."',
    videos: [
      { thumbnail: 'https://upload.wikimedia.org/wikipedia/en/9/9f/These_Streets.jpg', title: 'These Streets' },
      { thumbnail: 'https://upload.wikimedia.org/wikipedia/en/e/e6/NutiniSSU.jpg', title: 'Sunny Side Up' }
    ],
    tracks: [
      { title: 'These Streets', artist: 'Paolo Nutini', thumbnail: 'https://upload.wikimedia.org/wikipedia/en/9/9f/These_Streets.jpg' },
      { title: 'Sunny Side Up', artist: 'Paolo Nutini', thumbnail: 'https://upload.wikimedia.org/wikipedia/en/e/e6/NutiniSSU.jpg' }
    ],
    backgroundImage: 'https://www.kcuk.org.uk/wp-content/uploads/2023/02/paolo-nutini-04.jpg'
  },
  {
    name: 'Gorillaz',
    bio: 'Gorillaz is a British virtual band created in 1998 by Damon Albarn and Jamie Hewlett. The band is known for their unique blend of electronic music and animated music videos.',
    videos: [
      { thumbnail: 'https://i1.sndcdn.com/artworks-000348116745-pt1e0h-t500x500.jpg', title: 'Clint Eastwood' },
      { thumbnail: 'https://images.genius.com/57bd806e697500ff0608d24b4bd4f0c1.1000x1000x1.png', title: 'Feel Good Inc.' }
    ],
    tracks: [
      { title: 'Clint Eastwood', artist: 'Gorillaz', thumbnail: 'https://i1.sndcdn.com/artworks-000348116745-pt1e0h-t500x500.jpg' },
      { title: 'Feel Good Inc.', artist: 'Gorillaz', thumbnail: 'https://images.genius.com/57bd806e697500ff0608d24b4bd4f0c1.1000x1000x1.png' }
    ],
    backgroundImage: 'https://gorillaz.com/wp-content/themes/gorillaz/assets/IMG/the-mountain-large.webp?v=1'
  }
];

export const ProfileView = ({
  profileData,
  onBeginCreation,
  isExample = false,
  isDarkMode,
  setIsDarkMode,
  onExampleProfileSelected,
  isCreationLoading = false,
  isCreatingProfile = false,
  creationStep = CREATION_STEP_ORDER[0],
  onCreationStepChange,
  onCompleteCreation,
  onHeroImageUpdate,
  initialHeroImage,
  heroBrightness = 100,
  onHeroBrightnessChange,
  initialArtistName = "",
  onArtistNameChange,
}) => {
  // Randomly select an example profile once when component mounts (only for example profiles)
  const exampleData = useMemo(() => {
    if (!isExample) return null;
    const randomIndex = Math.floor(Math.random() * EXAMPLE_PROFILES.length);
    return EXAMPLE_PROFILES[randomIndex];
  }, [isExample]);

  // Notify parent component of selected profile in useEffect (not during render)
  useEffect(() => {
    if (isExample && exampleData && onExampleProfileSelected) {
      onExampleProfileSelected(exampleData);
    }
  }, [isExample, exampleData, onExampleProfileSelected]);

  const data = isExample ? exampleData : profileData;

  const profileContentClassNames = [
    'profile-state-content',
    isDarkMode ? 'dark-mode' : '',
    isCreatingProfile ? 'creating-transition' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const sectionsStackClassNames = [
    'profile-sections-stack',
    isCreatingProfile ? 'fade-out' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={profileContentClassNames}>
      <div className={sectionsStackClassNames}>
        <div className="bio-card-container">
          <Bio 
            bio={data?.bio || 'No bio available'} 
          />
        </div>

        <div className="videos-tracks-card-container">
          <VideosTracks 
            videos={data?.videos || []}
            tracks={data?.tracks || []}
          />
        </div>

        <div className="dark-mode-toggle-container">
          <DarkModeToggle isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
        </div>

      </div>

      {/* Profile creation box */}
      {(isExample || isCreatingProfile) && (
        <div className="creation-box-container">
          <ProfileCreationBox
            onStartJourney={onBeginCreation}
            isLoading={isCreationLoading}
            isCreating={isCreatingProfile}
            creationStep={creationStep}
            onCreationStepChange={onCreationStepChange}
            onCompleteCreation={onCompleteCreation}
            onHeroImageUpdate={onHeroImageUpdate}
            initialHeroImage={initialHeroImage}
            heroBrightness={heroBrightness}
            onHeroBrightnessChange={onHeroBrightnessChange}
            initialArtistName={initialArtistName}
            onArtistNameChange={onArtistNameChange}
          />
        </div>
      )}

    </div>
  );
};

