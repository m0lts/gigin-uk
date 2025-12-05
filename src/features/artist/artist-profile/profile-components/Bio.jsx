/**
 * Bio Component
 * Displays the artist's bio text with optional "Show Tracks" button
 * Supports editing mode with textarea and social link inputs
 */

import { useState, useEffect } from 'react';
import { DNAIcon, InstagramIcon, WebsiteIcon, EditIcon } from "../../../shared/ui/extras/Icons";

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

export const Bio = ({ 
  bio, 
  websiteUrl, 
  instagramUrl,
  onBioEdit = null,
  onWebsiteUrlEdit = null,
  onInstagramUrlEdit = null,
  isEditable = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState(bio || '');
  const [editWebsiteUrl, setEditWebsiteUrl] = useState(websiteUrl || '');
  const [editInstagramUrl, setEditInstagramUrl] = useState(instagramUrl || '');

  // Sync local state when props change (but not when editing)
  useEffect(() => {
    if (!isEditing) {
      setEditBio(bio || '');
      setEditWebsiteUrl(websiteUrl || '');
      setEditInstagramUrl(instagramUrl || '');
    }
  }, [bio, websiteUrl, instagramUrl, isEditing]);

  const handleSave = async () => {
    try {
      if (onBioEdit) {
        await onBioEdit(editBio);
      }
      if (onWebsiteUrlEdit) {
        await onWebsiteUrlEdit(editWebsiteUrl);
      }
      if (onInstagramUrlEdit) {
        await onInstagramUrlEdit(editInstagramUrl);
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save bio changes:', error);
      // Error handling is done in the parent component
    }
  };

  const handleCancel = () => {
    setEditBio(bio || '');
    setEditWebsiteUrl(websiteUrl || '');
    setEditInstagramUrl(instagramUrl || '');
    setIsEditing(false);
  };

  const hasChanges = 
    editBio !== (bio || '') ||
    editWebsiteUrl !== (websiteUrl || '') ||
    editInstagramUrl !== (instagramUrl || '');

  return (
    <div className="artist-profile-bio">
      <div className="section-header">
        <div className="title">
          <DNAIcon />
          <h3>Bio</h3>
        </div>
        <div className="external-links" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {!isEditing && websiteUrl && (
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
          {!isEditing && instagramUrl && (
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
          {isEditable && (
            isEditing ? (
              <button
                type="button"
                className="btn artist-profile component-save-btn"
                onClick={handleSave}
              >
                Save
              </button>
            ) : (
              <button
                type="button"
                className="btn component-edit-btn"
                onClick={() => setIsEditing(true)}
              >
                <EditIcon />
                Edit
              </button>
            )
          )}
        </div>
      </div>
      <div className="bio-content">
        {isEditing ? (
          <>
            <div className="creation-bio-textarea-container">
              <textarea
                className="creation-bio-textarea"
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="Enter your profile bio here..."
                maxLength={150}
              />
              <h6 className={`creation-bio-textarea-length ${editBio.length >= 125 ? "red" : ""}`}>
                {editBio.length}/150 MAX
              </h6>
            </div>
            <div className="link-entries-container" style={{ marginTop: '1rem' }}>
              <div className="link-entry-container website">
                <WebsiteIcon />
                <input 
                  type="text" 
                  placeholder="Your Website URL"
                  value={editWebsiteUrl}
                  onChange={(e) => setEditWebsiteUrl(e.target.value)}
                />
              </div>
              <div className="link-entry-container instagram">
                <InstagramIcon />
                <input 
                  type="text" 
                  placeholder="Instagram URL" 
                  value={editInstagramUrl}
                  onChange={(e) => setEditInstagramUrl(e.target.value)}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn tertiary"
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <p>{bio}</p>
        )}
      </div>
    </div>
  );
};

