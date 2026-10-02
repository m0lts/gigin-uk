// Gigin icon set — original drawings, 24×24, 1.75 stroke. Replaces Font Awesome.
// Sized with 1em like FontAwesomeIcon, coloured with currentColor, keeps className 'icon'.
import React from 'react';

const Svg = ({ children, strokeWidth = 1.75, className = 'icon', ...rest }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={className} {...rest}>
    {children}
  </svg>
);

export const HouseIconLight = (props) => (
  <Svg {...props}>
    <path d="M4 10.4 12 4l8 6.4V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"/>
    <path d="M10 20.5v-4a2 2 0 0 1 4 0v4"/>
  </Svg>
);

export const HouseIconSolid = (props) => (
  <Svg {...props}>
    <mask id="gi-HouseIconSolid" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><path fill="#fff" stroke="#fff" d="M4 10.4 12 4l8 6.4V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"/>
    <path fill="#000" d="M10.4 22v-5.4a1.6 1.6 0 0 1 3.2 0V22z"/>
    </mask><rect width="24" height="24" fill="currentColor" stroke="none" mask="url(#gi-HouseIconSolid)"/>
  </Svg>
);

export const CalendarIconLight = (props) => (
  <Svg {...props}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/>
    <path d="M8 3v4M16 3v4M3.5 10h17"/>
    <rect x="13.75" y="13.25" width="3" height="3" rx=".75" fill="currentColor" stroke="none"/>
  </Svg>
);

export const CalendarIconSolid = (props) => (
  <Svg {...props}>
    <mask id="gi-CalendarIconSolid" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect fill="#fff" stroke="#fff" x="3.5" y="5" width="17" height="15.5" rx="2.5"/>
    <path stroke="#000" strokeWidth="4.5" d="M8 4.5v3M16 4.5v3"/>
    <path stroke="#fff" d="M8 3v4M16 3v4"/>
    <path stroke="#000" strokeWidth="1.5" d="M3.5 10.25h17"/>
    <rect fill="#000" x="13.75" y="13.25" width="3" height="3" rx=".75"/>
    </mask><rect width="24" height="24" fill="currentColor" stroke="none" mask="url(#gi-CalendarIconSolid)"/>
  </Svg>
);

export const MessageIcon = (props) => (
  <Svg {...props}>
    <path d="M5.5 4.5h13A2.5 2.5 0 0 1 21 7v8a2.5 2.5 0 0 1-2.5 2.5H10.5l-4.5 3v-3h-.5A2.5 2.5 0 0 1 3 15V7a2.5 2.5 0 0 1 2.5-2.5z"/>
    <path d="M7.5 9.5h9M7.5 13h5"/>
  </Svg>
);

export const MessageIconSolid = (props) => (
  <Svg {...props}>
    <mask id="gi-MessageIconSolid" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><path fill="#fff" stroke="#fff" d="M5.5 4.5h13A2.5 2.5 0 0 1 21 7v8a2.5 2.5 0 0 1-2.5 2.5H10.5l-4.5 3v-3h-.5A2.5 2.5 0 0 1 3 15V7a2.5 2.5 0 0 1 2.5-2.5z"/>
    <path stroke="#000" d="M7.5 9.5h9M7.5 13h5"/>
    </mask><rect width="24" height="24" fill="currentColor" stroke="none" mask="url(#gi-MessageIconSolid)"/>
  </Svg>
);

export const AddressBookIcon = (props) => (
  <Svg {...props}>
    <rect x="5.5" y="3" width="15" height="18" rx="2.5"/>
    <path d="M3.5 8H7M3.5 12H7M3.5 16H7"/>
    <circle cx="13" cy="10" r="2.5"/>
    <path d="M9.25 17a3.75 3.75 0 0 1 7.5 0"/>
  </Svg>
);

export const AddressBookIconSolid = (props) => (
  <Svg {...props}>
    <mask id="gi-AddressBookIconSolid" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect fill="#fff" stroke="#fff" x="5.5" y="3" width="15" height="18" rx="2.5"/>
    <path stroke="#fff" d="M3.5 8H7M3.5 12H7M3.5 16H7"/>
    <circle fill="#000" cx="13" cy="10" r="2.6"/>
    <path fill="#000" d="M9.1 17.6a3.9 3.9 0 0 1 7.8 0z"/>
    </mask><rect width="24" height="24" fill="currentColor" stroke="none" mask="url(#gi-AddressBookIconSolid)"/>
  </Svg>
);

export const CoinsIcon = (props) => (
  <Svg {...props}>
    <path d="M14.47 9.53A5.5 5.5 0 1 0 9.53 14.47"/>
    <circle cx="15" cy="15" r="5.5"/>
    <circle cx="15" cy="15" r="2.25"/>
  </Svg>
);

export const CoinsIconSolid = (props) => (
  <Svg {...props}>
    <mask id="gi-CoinsIconSolid" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><circle fill="#fff" stroke="#fff" cx="9" cy="9" r="5.5"/>
    <circle fill="#000" cx="15" cy="15" r="7.4"/>
    <circle fill="#fff" stroke="#fff" cx="15" cy="15" r="5.5"/>
    <circle stroke="#000" strokeWidth="1.6" cx="15" cy="15" r="2.25"/>
    </mask><rect width="24" height="24" fill="currentColor" stroke="none" mask="url(#gi-CoinsIconSolid)"/>
  </Svg>
);

export const SettingsIcon = (props) => (
  <Svg {...props}>
    <path d="M18.47 10.27L20.8 10.68A8.9 8.9 0 0 1 20.8 13.32L18.47 13.73A6.7 6.7 0 0 1 17.8 15.35L17.8 15.35L19.15 17.29A8.9 8.9 0 0 1 17.29 19.15L15.35 17.8A6.7 6.7 0 0 1 13.73 18.47L13.73 18.47L13.32 20.8A8.9 8.9 0 0 1 10.68 20.8L10.27 18.47A6.7 6.7 0 0 1 8.65 17.8L8.65 17.8L6.71 19.15A8.9 8.9 0 0 1 4.85 17.29L6.2 15.35A6.7 6.7 0 0 1 5.53 13.73L5.53 13.73L3.2 13.32A8.9 8.9 0 0 1 3.2 10.68L5.53 10.27A6.7 6.7 0 0 1 6.2 8.65L6.2 8.65L4.85 6.71A8.9 8.9 0 0 1 6.71 4.85L8.65 6.2A6.7 6.7 0 0 1 10.27 5.53L10.27 5.53L10.68 3.2A8.9 8.9 0 0 1 13.32 3.2L13.73 5.53A6.7 6.7 0 0 1 15.35 6.2L15.35 6.2L17.29 4.85A8.9 8.9 0 0 1 19.15 6.71L17.8 8.65A6.7 6.7 0 0 1 18.47 10.27Z"/>
    <circle cx="12" cy="12" r="2.75"/>
  </Svg>
);

export const SettingsIconSolid = (props) => (
  <Svg {...props}>
    <mask id="gi-SettingsIconSolid" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><path fill="#fff" stroke="#fff" d="M18.47 10.27L20.8 10.68A8.9 8.9 0 0 1 20.8 13.32L18.47 13.73A6.7 6.7 0 0 1 17.8 15.35L17.8 15.35L19.15 17.29A8.9 8.9 0 0 1 17.29 19.15L15.35 17.8A6.7 6.7 0 0 1 13.73 18.47L13.73 18.47L13.32 20.8A8.9 8.9 0 0 1 10.68 20.8L10.27 18.47A6.7 6.7 0 0 1 8.65 17.8L8.65 17.8L6.71 19.15A8.9 8.9 0 0 1 4.85 17.29L6.2 15.35A6.7 6.7 0 0 1 5.53 13.73L5.53 13.73L3.2 13.32A8.9 8.9 0 0 1 3.2 10.68L5.53 10.27A6.7 6.7 0 0 1 6.2 8.65L6.2 8.65L4.85 6.71A8.9 8.9 0 0 1 6.71 4.85L8.65 6.2A6.7 6.7 0 0 1 10.27 5.53L10.27 5.53L10.68 3.2A8.9 8.9 0 0 1 13.32 3.2L13.73 5.53A6.7 6.7 0 0 1 15.35 6.2L15.35 6.2L17.29 4.85A8.9 8.9 0 0 1 19.15 6.71L17.8 8.65A6.7 6.7 0 0 1 18.47 10.27Z"/>
    <circle fill="#000" cx="12" cy="12" r="2.9"/>
    </mask><rect width="24" height="24" fill="currentColor" stroke="none" mask="url(#gi-SettingsIconSolid)"/>
  </Svg>
);

export const LogOutIcon = (props) => (
  <Svg {...props}>
    <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/>
    <path d="M10.5 12H20M16.5 8.5 20 12l-3.5 3.5"/>
  </Svg>
);

export const LogOutIconSolid = (props) => (
  <Svg {...props}>
    <path fill="currentColor" stroke="currentColor" d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4z"/>
    <path stroke="currentColor" d="M12.5 12H20M16.5 8.5 20 12l-3.5 3.5"/>
  </Svg>
);

export const DownChevronIcon = (props) => (
  <Svg {...props}>
    <path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>
  </Svg>
);

export const DownChevronIconSolid = (props) => (
  <Svg {...props}>
    <path fill="currentColor" stroke="currentColor" d="m6.5 9.5 5.5 5.5 5.5-5.5z"/>
  </Svg>
);

export const DotIcon = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="4"/>
  </Svg>
);

export const DotIconSolid = (props) => (
  <Svg {...props}>
    <circle fill="currentColor" stroke="currentColor" cx="12" cy="12" r="4"/>
  </Svg>
);

export const SidebarPanelIcon = (props) => (
  <Svg {...props}>
    <rect x="3" y="4.5" width="18" height="15" rx="2.5"/>
    <path d="M9.5 4.5v15"/>
    <path fill="currentColor" stroke="none" d="M5.75 6.5h1.75v11H5.75a.75.75 0 0 1-.75-.75v-9.5a.75.75 0 0 1 .75-.75z"/>
  </Svg>
);

export const SidebarPanelIconSolid = (props) => (
  <Svg {...props}>
    <mask id="gi-SidebarPanelIconSolid" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect fill="#fff" stroke="#fff" x="3" y="4.5" width="18" height="15" rx="2.5"/>
    <path fill="#000" d="M10.75 6.5h7.5a.75.75 0 0 1 .75.75v9.5a.75.75 0 0 1-.75.75h-7.5z"/>
    </mask><rect width="24" height="24" fill="currentColor" stroke="none" mask="url(#gi-SidebarPanelIconSolid)"/>
  </Svg>
);

export const BellIcon = (props) => (
  <Svg {...props}>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/>
    <path d="M12 3v2M10 20.5h4"/>
  </Svg>
);

export const BellIconSolid = (props) => (
  <Svg {...props}>
    <path fill="currentColor" stroke="currentColor" d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/>
    <path stroke="currentColor" d="M12 3v2M10 20.5h4"/>
  </Svg>
);

export const QrCodeIcon = (props) => (
  <Svg {...props}>
    <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5"/>
    <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5"/>
    <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5"/>
    <g fill="currentColor" stroke="none"><rect x="5.75" y="5.75" width="2" height="2" rx=".5"/>
    <rect x="16.25" y="5.75" width="2" height="2" rx=".5"/>
    <rect x="5.75" y="16.25" width="2" height="2" rx=".5"/>
    <rect x="14" y="14" width="2.75" height="2.75" rx=".6"/>
    <rect x="17.75" y="17.75" width="2.75" height="2.75" rx=".6"/>
    </g><path d="M20 14.75h0M14.75 20h0"/>
  </Svg>
);

export const QrCodeIconSolid = (props) => (
  <Svg {...props}>
    <mask id="gi-QrCodeIconSolid" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect fill="#fff" stroke="#fff" x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5"/>
    <rect fill="#fff" stroke="#fff" x="14" y="3.5" width="6.5" height="6.5" rx="1.5"/>
    <rect fill="#fff" stroke="#fff" x="3.5" y="14" width="6.5" height="6.5" rx="1.5"/>
    <g fill="#000"><rect x="5.25" y="5.25" width="3" height="3" rx=".6"/>
    <rect x="15.75" y="5.25" width="3" height="3" rx=".6"/>
    <rect x="5.25" y="15.75" width="3" height="3" rx=".6"/>
    </g><g fill="#fff"><rect x="6.25" y="6.25" width="1" height="1"/>
    <rect x="16.75" y="6.25" width="1" height="1"/>
    <rect x="6.25" y="16.75" width="1" height="1"/>
    <rect x="13.5" y="13.5" width="3.5" height="3.5" rx=".75"/>
    <rect x="17.25" y="17.25" width="3.5" height="3.5" rx=".75"/>
    </g><path stroke="#fff" strokeWidth="2.25" d="M20 14.75h0M14.75 20h0"/>
    </mask><rect width="24" height="24" fill="currentColor" stroke="none" mask="url(#gi-QrCodeIconSolid)"/>
  </Svg>
);

export const LinkIcon = (props) => (
  <Svg {...props}>
    <path d="M10 7.75H7.75a4.25 4.25 0 0 0 0 8.5H10M14 7.75h2.25a4.25 4.25 0 0 1 0 8.5H14M8.75 12h6.5"/>
  </Svg>
);

export const LinkIconSolid = (props) => (
  <Svg strokeWidth={2.5} {...props}>
    <path d="M10 7.75H7.75a4.25 4.25 0 0 0 0 8.5H10M14 7.75h2.25a4.25 4.25 0 0 1 0 8.5H14M8.75 12h6.5"/>
  </Svg>
);

export const CopyIcon = (props) => (
  <Svg {...props}>
    <path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>
    <rect x="8.5" y="8.5" width="12" height="12" rx="2"/>
  </Svg>
);

export const CopyIconSolid = (props) => (
  <Svg {...props}>
    <path stroke="currentColor" d="M15.5 6.5v-1a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h1"/>
    <rect fill="currentColor" stroke="currentColor" x="8.5" y="8.5" width="12" height="12" rx="2"/>
  </Svg>
);

export const MobileMenuIcon = (props) => (
  <Svg {...props}>
    <path d="M4 7h16M4 12h16M4 17h10"/>
  </Svg>
);

export const MobileMenuIconSolid = (props) => (
  <Svg strokeWidth={2.5} {...props}>
    <path d="M4 7h16M4 12h16M4 17h10"/>
  </Svg>
);

export const CloseIcon = (props) => (
  <Svg {...props}>
    <path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>
  </Svg>
);

export const CloseIconSolid = (props) => (
  <Svg strokeWidth={2.5} {...props}>
    <path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>
  </Svg>
);

export const CheckIcon = (props) => (
  <Svg {...props}>
    <path d="m5 12.5 4.5 4.5L19 7.5"/>
  </Svg>
);

export const CheckIconSolid = (props) => (
  <Svg strokeWidth={2.5} {...props}>
    <path d="m5 12.5 4.5 4.5L19 7.5"/>
  </Svg>
);

export const UndoIcon = (props) => (
  <Svg {...props}>
    <path d="M8.5 5 4.5 9l4 4"/>
    <path d="M4.5 9h10a5 5 0 0 1 0 10H11"/>
  </Svg>
);

export const UndoIconSolid = (props) => (
  <Svg strokeWidth={2.5} {...props}>
    <path d="M8.5 5 4.5 9l4 4"/>
    <path d="M4.5 9h10a5 5 0 0 1 0 10H11"/>
  </Svg>
);

export const DownloadIcon = (props) => (
  <Svg {...props}>
    <path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5"/>
    <path d="M4 15.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5"/>
  </Svg>
);

export const DownloadIconSolid = (props) => (
  <Svg strokeWidth={2.5} {...props}>
    <path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5"/>
    <path d="M4 15.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5"/>
  </Svg>
);

export const UploadIcon = (props) => (
  <Svg {...props}>
    <path d="M12 14.5v-11M7.5 8 12 3.5 16.5 8"/>
    <path d="M4 15.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5"/>
  </Svg>
);

export const UploadIconSolid = (props) => (
  <Svg strokeWidth={2.5} {...props}>
    <path d="M12 14.5v-11M7.5 8 12 3.5 16.5 8"/>
    <path d="M4 15.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5"/>
  </Svg>
);

export const MicIcon = (props) => (
  <Svg {...props}>
    <rect x="9" y="3" width="6" height="11" rx="3"/>
    <path d="M6 11a6 6 0 0 0 12 0M12 17v3.5M9 20.5h6"/>
  </Svg>
);

export const MicIconSolid = (props) => (
  <Svg {...props}>
    <rect fill="currentColor" stroke="currentColor" x="9" y="3" width="6" height="11" rx="3"/>
    <path stroke="currentColor" d="M6 11a6 6 0 0 0 12 0M12 17v3.5M9 20.5h6"/>
  </Svg>
);

export const MapPinIcon = (props) => (
  <Svg {...props}>
    <path d="M12 20.75s6.75-6.1 6.75-10.75a6.75 6.75 0 0 0-13.5 0c0 4.65 6.75 10.75 6.75 10.75z"/>
    <circle cx="12" cy="10" r="2.5"/>
  </Svg>
);

export const MapPinIconSolid = (props) => (
  <Svg {...props}>
    <mask id="gi-MapPinIconSolid" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><path fill="#fff" stroke="#fff" d="M12 20.75s6.75-6.1 6.75-10.75a6.75 6.75 0 0 0-13.5 0c0 4.65 6.75 10.75 6.75 10.75z"/>
    <circle fill="#000" cx="12" cy="10" r="2.6"/>
    </mask><rect width="24" height="24" fill="currentColor" stroke="none" mask="url(#gi-MapPinIconSolid)"/>
  </Svg>
);

