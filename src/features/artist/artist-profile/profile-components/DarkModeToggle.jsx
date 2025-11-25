/**
 * DarkModeToggle Component
 * Toggle between dark and light mode
 */

import { DarkModeIcon, LightModeIcon } from '../../../shared/ui/extras/Icons';

export const DarkModeToggle = ({ isDarkMode, setIsDarkMode }) => {
  const handleLightMode = () => {
    setIsDarkMode(false);
  };

  const handleDarkMode = () => {
    setIsDarkMode(true);
  };

  return (
    <>
      <button 
        className={`btn toggle-mode-btn ${!isDarkMode ? 'active' : ''}`}
        onClick={handleLightMode}
      >
        <LightModeIcon />
      </button>
      <button 
        className={`btn toggle-mode-btn ${isDarkMode ? 'active' : ''}`}
        onClick={handleDarkMode}
      >
        <DarkModeIcon />
      </button>
    </>
  );
};

