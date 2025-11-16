/**
 * ProfileCreationBox Component
 * Shows information about creating a profile with a CTA button
 */

import { GuitarsIcon, RightArrowIcon } from "../../../shared/ui/extras/Icons";

export const ProfileCreationBox = ({ onStartJourney }) => {
  return (
    <div className="artist-profile-creation-box">
      <div className="creation-box-header">
        <GuitarsIcon />
        <h3>Your Artist Profile</h3>
      </div>
      <div className="creation-box-content">
        <p>This is what your profile could look like. Create your own artist profile and start connecting with venues, booking gigs, and building your music career today!</p>
      </div>
      <button className="btn artist-profile" onClick={onStartJourney}>
        Create Artist Profile <RightArrowIcon />
      </button>
    </div>
  );
};

