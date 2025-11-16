/**
 * Bio Component
 * Displays the artist's bio text with optional "Show Tracks" button
 */

import { DNAIcon } from "../../../shared/ui/extras/Icons";

export const Bio = ({ bio }) => {
  return (
    <div className="artist-profile-bio">
      <div className="bio-header">
        <DNAIcon />
        <h3>Bio</h3>
        {/* Hourglass icon could go here */}
      </div>
      <div className="bio-content">
        <p>{bio}</p>
      </div>
    </div>
  );
};

