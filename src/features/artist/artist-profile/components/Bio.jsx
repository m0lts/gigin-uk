/**
 * Bio Component
 * Displays the artist's bio text with optional "Show Tracks" button
 */

import { DNAIcon, InstagramIcon, WebsiteIcon } from "../../../shared/ui/extras/Icons";

// Helper function to normalize URLs and prepend https:// if needed
const normalizeUrl = (url) => {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  // If it already starts with http:// or https://, return as is
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  // Otherwise prepend https://
  return `https://${trimmed}`;
};

const handleLinkClick = (e, url) => {
  e.preventDefault();
  const normalizedUrl = normalizeUrl(url);
  if (normalizedUrl) {
    window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
  }
};

export const Bio = ({ bio, websiteUrl, instagramUrl }) => {
  return (
    <div className="artist-profile-bio">
      <div className="section-header">
        <div className="title">
          <DNAIcon />
          <h3>Bio</h3>
        </div>
        <div className="external-links">
          {websiteUrl && (
            <a 
              href={websiteUrl} 
              onClick={(e) => handleLinkClick(e, websiteUrl)}
              className="external-link website"
              aria-label="Open Website"
            >
              <WebsiteIcon />
              Website
            </a>
          )}
          {instagramUrl && (
            <a 
              href={instagramUrl} 
              onClick={(e) => handleLinkClick(e, instagramUrl)}
              className="external-link instagram"
              aria-label="Open Instagram profile"
            >
              <InstagramIcon />
              Instagram
            </a>
          )}
        </div>
      </div>
      <div className="bio-content">
        <p>{bio}</p>
      </div>
    </div>
  );
};

