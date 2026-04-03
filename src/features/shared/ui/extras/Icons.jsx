import { faApple, faFacebook, faFacebookSquare, faGoogle, faInstagram, faInstagramSquare, faSoundcloud, faSpotify, faStripe, faTwitter, faTwitterSquare, faXTwitter, faYoutube, faYoutubeSquare } from '@fortawesome/free-brands-svg-icons'
import { faAddressBook, faArrowLeft, faBoxArchive, faCircle, faInbox, faLocationDot, faPlayCircle, faUserCircle, faFileImport, faSquareMinus, faChevronUp, faChevronDown, faChevronLeft, faChevronRight, faX, faCheck, faXmark } from '@fortawesome/free-solid-svg-icons'
import { faAddressCard, faArrowLeftFromArc, faBeerFoam, faCameraViewfinder, faCastle, faCoin, faCutlery, faDrum, faEnvelope, faGlassesRound, faGraduationCap, faLightbulb, faLocationPin, faMicrophoneStand, faMuseum, faPencil, faPiano, faPlaceOfWorship,  faPlayPause, faQuestionCircle, faReel, faSpeakers, faTelescope, faTurntable, faXmarkCircle, faStarShooting, faTrashCan, faLink, faTicket as faTicketLight } from '@fortawesome/pro-regular-svg-icons'
import { faComments, faFaceFrown, faFaceMeh, faFaceSmile, faFaceSmileHearts, faMessage, faPencilSquare, faTableTree, faClock, faCircleArrowLeft, faChartPieSimple, faCreditCard, faFileInvoice, faPartyHorn, faListMusic, faCircleExclamation, faBan, faCirclePlus, faMapLocation, faDesktop, faAmpGuitar, faPlug,  } from '@fortawesome/pro-regular-svg-icons'
import { faCopy, faShieldCheck, faCirclePlus as faCirclePlusSolid, faAsterisk, faKey, faUserMinus, faDoorOpen, faPhotoFilmMusic, faSquareInfo, faHashtag, faPiggyBank, faCircleExclamation as faCircleExclamationSolid, faWarning, faMoneyBillTransfer, faBadgeCheck, faMoneyBillsSimple, faBellRing, faEmptySet, faCircleVideo, faRingsWedding, faTicket, faVolume, faExpand, faArrowUp, faArrowUpRightFromSquare, faArrowRightFromBracket, faImage, faExcavator, faThumbsUp, faThumbsDown, faUserLock, faBars, faMobileRetro, faSpeaker, faGuitarElectric, faDna, faFilmAlt, faCompactDisc, faGuitars, faSun, faMoon, faArrowRightLong, faArrowLeftLong, faArrowUpLong, faArrowDownLong, faGlobePointer, faTachographDigital, faPenToSquare, faPlay, faPause, faSparkles, faVideo, faFaceParty, faSliders, faTrumpet, faSaxophone } from '@fortawesome/pro-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBookmark as faSaveIcon } from '@fortawesome/pro-regular-svg-icons'
import { faBookmark as faSavedIcon } from '@fortawesome/free-solid-svg-icons'
import { faStar as faFullStar } from '@fortawesome/free-solid-svg-icons'
import { faStar as faEmptyStar } from '@fortawesome/pro-regular-svg-icons'
import { faPeopleGroup as faPeopleGroupLight } from '@fortawesome/pro-light-svg-icons';
import { faPeopleGroup as faPeopleGroupSolid } from '@fortawesome/free-solid-svg-icons';
import { faPeopleRoof as faPeopleRoofLight } from '@fortawesome/pro-regular-svg-icons';
import { faPeopleRoof as faPeopleRoofSolid } from '@fortawesome/free-solid-svg-icons';
import { faHouseWindow as faHouseWindowLight } from '@fortawesome/pro-regular-svg-icons';
import { faHouseWindow as faHouseWindowSolid, faAddressCard as faAddressCardSolid, faMicrophoneLines, faFileMp4, faCamcorder, faFileMp3, faFilm, faCheckCircle, faArrowUpFromBracket, faUserPlus, faGear, faAlbumCollectionCircleUser, faFileUser  } from '@fortawesome/pro-solid-svg-icons';
import { faCalendar as faCalendarLight } from '@fortawesome/pro-regular-svg-icons';
import { faCalendar as faCalendarSolid, faCalendarCirclePlus } from '@fortawesome/pro-solid-svg-icons';
import { faRectanglesMixed as faGridHorizontalLight } from '@fortawesome/pro-regular-svg-icons';
import { faRectanglesMixed as faGridHorizontalSolid } from '@fortawesome/pro-solid-svg-icons';
import { faMessageMusic, faMagnifyingGlass, faSort } from '@fortawesome/pro-solid-svg-icons'
import { faLandmark as faLandmarkLight } from '@fortawesome/pro-regular-svg-icons';
import { faLandmark as faLandmarkSolid } from '@fortawesome/pro-solid-svg-icons';
import { faBeerFoam as faBeerFoamSolid } from '@fortawesome/pro-solid-svg-icons';
import { faEnvelope as faEnvelopeSolid } from '@fortawesome/pro-solid-svg-icons';
import { faMuseum as faMuseumSolid } from '@fortawesome/pro-solid-svg-icons';
import { faMicrophoneStand as faMicrophoneStandSolid } from '@fortawesome/pro-solid-svg-icons';
import { faCutlery as faCutlerySolid } from '@fortawesome/pro-solid-svg-icons';
import { faPlaceOfWorship as faPlaceOfWorshipSolid } from '@fortawesome/pro-solid-svg-icons';
import { faTurntable as faTurntableSolid } from '@fortawesome/pro-solid-svg-icons';
import { faMusic as faMusicLight } from '@fortawesome/pro-light-svg-icons'
import { faMusic as faMusicSolid } from '@fortawesome/free-solid-svg-icons'
import { faCoins as faCoinsLight } from '@fortawesome/pro-light-svg-icons'
import { faCoins as faCoinsSolid } from '@fortawesome/free-solid-svg-icons'
import { faFilter as faFullFilter } from '@fortawesome/free-solid-svg-icons'
import { faFilter as faEmptyFilter } from '@fortawesome/pro-regular-svg-icons'
import { faTrashList as faTrashMultiple, faTrash, faClone, faEllipsis } from '@fortawesome/pro-solid-svg-icons'
import { faMailbox as faMailbox } from '@fortawesome/pro-regular-svg-icons';
import { faMailbox as faMailboxSolid } from '@fortawesome/pro-solid-svg-icons';
import { faMailboxFlagUp as faMailboxFlagUp } from '@fortawesome/pro-regular-svg-icons';
import { faMailboxFlagUp as faMailboxFlagUpSolid } from '@fortawesome/pro-solid-svg-icons';


// General icons
export const UserIcon = () => {
    return (
        <FontAwesomeIcon icon={faUserCircle} className='icon' />
    )
}
export const SearchIcon = () => {
    return (
        <FontAwesomeIcon icon={faMagnifyingGlass} className='icon' />
    )

}
export const LogOutIcon = () => {
    return (
        <FontAwesomeIcon icon={faArrowRightFromBracket} className='icon' />
    )
}
export const VenueBuilderIcon = () => {
    return (
        <FontAwesomeIcon icon={faPencil} className='icon' />
    )
}
export const SettingsIcon = () => {
    return (
        <FontAwesomeIcon icon={faGear} className='icon' />
    )
}
export const DotIcon = () => {
    return (
        <FontAwesomeIcon icon={faCircle} className='icon' />
    )
}
export const GuitarsIcon = () => {
    return (
        <FontAwesomeIcon icon={faGuitars} className='icon' />
    )
}
export const BassIcon = () => {
    return (
        <FontAwesomeIcon icon={faGuitarElectric} className='icon' />
    )
}
export const MicrophoneLinesIcon = () => {
    return (
        <FontAwesomeIcon icon={faMicrophoneLines} className='icon' />
    )
}
export const PeopleRoofIconLight = () => {
    return (
        <FontAwesomeIcon icon={faPeopleRoofLight} className='icon' />
    )
}
export const PeopleRoofIconSolid = () => {
    return (
        <FontAwesomeIcon icon={faPeopleRoofSolid} className='icon' />
    )
}
export const PeopleGroupIcon = () => {
    return (
        <FontAwesomeIcon icon={faPeopleGroupLight} className='icon' />
    )
}
export const PeopleGroupIconSolid = () => {
    return (
        <FontAwesomeIcon icon={faPeopleGroupSolid} className='icon' />
    )
}

export const AddressBookIcon = () => {
    return (
        <FontAwesomeIcon icon={faAddressBook} className='icon' />
    )
}
export const CoinIcon = () => {
    return (
        <FontAwesomeIcon icon={faCoin} className='icon' />
    )
}
export const TutoringIcon = () => {
    return (
        <FontAwesomeIcon icon={faGraduationCap} className='icon' />
    )
}
export const ShieldIcon = () => {
    return (
        <FontAwesomeIcon icon={faShieldCheck} className='icon' />
    )
}
export const SuccessIcon = () => {
    return (
        <FontAwesomeIcon icon={faCheckCircle} className='icon' style={{ color: 'var(--gn-green)' }} />
    )
}
export const ErrorIcon = () => {
    return (
        <FontAwesomeIcon icon={faXmarkCircle} className='icon' style={{ color: 'red' }} />
    )
}
export const CloseIcon = () => {
    return (
        <FontAwesomeIcon icon={faXmark} className='icon' style={{ fontSize: '1.25rem' }} />
    )
}
export const SeeIcon = () => {
    return (
        <FontAwesomeIcon icon={faGlassesRound} className='icon' />
    )
}
export const QuestionCircleIcon = () => {
    return (
        <FontAwesomeIcon icon={faQuestionCircle} className='icon' />
    )
}
export const LeftChevronIcon = () => {
    return (
        <FontAwesomeIcon icon={faChevronLeft} className='icon' style={{ fontSize: '0.85rem' }} />
    )
}
export const RightChevronIcon = () => {
    return (
        <FontAwesomeIcon icon={faChevronRight} className='icon' style={{ fontSize: '0.85rem' }} />
    )
}
export const DownChevronIcon = () => {
    return (
        <FontAwesomeIcon icon={faChevronDown} className='icon' style={{ fontSize: '0.85rem' }} />
    )
}
export const UpChevronIcon = () => {
    return (
        <FontAwesomeIcon icon={faChevronUp} className='icon' style={{ fontSize: '0.85rem' }} />
    )
}
export const ExitIcon = () => {
    return (
        <FontAwesomeIcon icon={faArrowLeftFromArc} className='icon' />
    )
}
export const HouseIconLight = () => {
    return (
        <FontAwesomeIcon icon={faHouseWindowLight} className='icon' />
    )
}
export const HouseIconSolid = () => {
    return (
        <FontAwesomeIcon icon={faHouseWindowSolid} className='icon' />
    )
}
export const BeerIcon = () => {
    return (
        <FontAwesomeIcon icon={faBeerFoam} className='icon' />
    )
}
export const BeerIconSolid = () => {
    return (
        <FontAwesomeIcon icon={faBeerFoamSolid} className='icon' />
    )
}
export const MapIcon = () => {
    return (
        <FontAwesomeIcon icon={faMapLocation} className='icon' />
    )
}
export const MicrophoneIcon = () => {
    return (
        <FontAwesomeIcon icon={faMicrophoneStand} className='icon' />
    )
}
export const MicrophoneIconSolid = () => {
    return (
        <FontAwesomeIcon icon={faMicrophoneStandSolid} className='icon' />
    )
}
export const RestaurantIcon = () => {
    return (
        <FontAwesomeIcon icon={faCutlery} className='icon' />
    )
}
export const RestaurantIconSolid = () => {
    return (
        <FontAwesomeIcon icon={faCutlerySolid} className='icon' />
    )
}
export const PlaceOfWorshipIcon = () => {
    return (
        <FontAwesomeIcon icon={faPlaceOfWorship} className='icon' />
    )
}
export const PlaceOfWorshipIconSolid = () => {
    return (
        <FontAwesomeIcon icon={faPlaceOfWorshipSolid} className='icon' />
    )
}
export const VillageHallIcon = () => {
    return (
        <FontAwesomeIcon icon={faMuseum} className='icon' />
    )
}
export const VillageHallIconSolid = () => {
    return (
        <FontAwesomeIcon icon={faMuseumSolid} className='icon' />
    )
}
export const ClubIcon = () => {
    return (
        <FontAwesomeIcon icon={faTurntable} className='icon' />
    )
}
export const ClubIconSolid = () => {
    return (
        <FontAwesomeIcon icon={faTurntableSolid} className='icon' />
    )
}
export const OtherIcon = () => {
    return (
        <FontAwesomeIcon icon={faCastle} className='icon' />
    )
}
export const SpeakersIcon = () => {
    return (
        <FontAwesomeIcon icon={faSpeakers} className='icon' />
    )
}
export const SpeakerIcon = () => {
    return (
        <FontAwesomeIcon icon={faSpeaker} className='icon' />
    )
}
export const PianoIcon = () => {
    return (
        <FontAwesomeIcon icon={faPiano} className='icon' />
    )
}
export const AmpIcon = () => {
    return (
        <FontAwesomeIcon icon={faAmpGuitar} className='icon' />
    )
}
export const DrumsIcon = () => {
    return (
        <FontAwesomeIcon icon={faDrum} className='icon' />
    )
}
export const CameraIcon = () => {
    return (
        <FontAwesomeIcon icon={faCameraViewfinder} className='icon' />
    )
}
export const LocationPinIcon = () => {
    return (
        <FontAwesomeIcon icon={faLocationDot} className='icon' />
    )
}
export const DashboardIconLight = () => {
    return (
        <FontAwesomeIcon icon={faGridHorizontalLight} className='icon' />
    )
}
export const DashboardIconSolid = () => {
    return (
        <FontAwesomeIcon icon={faGridHorizontalSolid} className='icon' />
    )
}
export const CalendarIconLight = () => {
    return (
        <FontAwesomeIcon icon={faCalendarLight} className='icon' />
    )
}
export const CalendarIconSolid = () => {
    return (
        <FontAwesomeIcon icon={faCalendarSolid} className='icon' />
    )
}
export const CalendarPlusIcon = () => {
    return (
        <FontAwesomeIcon icon={faCalendarCirclePlus} className='icon' />
    )
}
export const TickIcon = () => {
    return (
        <FontAwesomeIcon icon={faCheck} className='icon' />
    )
}
export const ClockIcon = () => {
    return (
        <FontAwesomeIcon icon={faClock} className='icon' />
    )
}
export const PreviousIcon = () => {
    return (
        <FontAwesomeIcon icon={faCircleArrowLeft} className='icon' />
    )
}
export const DoorIcon = () => {
    return (
        <FontAwesomeIcon icon={faDoorOpen} className='icon' />
    )
}
export const PlusIcon = () => {
    return (
        <FontAwesomeIcon icon={faCirclePlus} className='icon' />
    )
}
export const PlusIconSolid = () => {
    return (
        <FontAwesomeIcon icon={faCirclePlusSolid} className='icon' />
    )
}
export const TelescopeIcon = () => {
    return (
        <FontAwesomeIcon icon={faTelescope} className='icon' />
    )
}
export const CoinsIcon = () => {
    return (
        <FontAwesomeIcon icon={faCoinsLight} className='icon' />
    )
}
export const CoinsIconSolid = () => {
    return (
        <FontAwesomeIcon icon={faCoinsSolid} className='icon' />
    )
}
export const CardIcon = () => {
    return (
        <FontAwesomeIcon icon={faCreditCard} className='icon' />
    )
}
export const InvoiceIcon = () => {
    return (
        <FontAwesomeIcon icon={faFileInvoice} className='icon' />
    )
}
export const LightBulbIcon = () => {
    return (
        <FontAwesomeIcon icon={faLightbulb} className='icon' />
    )
}
export const MailboxEmptyIcon = () => {
    return (
        <FontAwesomeIcon icon={faMailbox} className='icon' />
    )
}
export const MailboxFullIcon = () => {
    return (
        <FontAwesomeIcon icon={faMailboxFlagUp} className='icon' />
    )
}
export const MailboxEmptyIconSolid = () => {
    return (
        <FontAwesomeIcon icon={faMailboxSolid} className='icon' />
    )
}
export const MailboxFullIconSolid = () => {
    return (
        <FontAwesomeIcon icon={faMailboxFlagUpSolid} className='icon' />
    )
}
export const ProfileIcon = () => {
    return (
        <FontAwesomeIcon icon={faAddressCard} className='icon' />
    )
}
export const ProfileIconSolid = () => {
    return (
        <FontAwesomeIcon icon={faAddressCardSolid} className='icon' />
    )
}
export const InviteIcon = () => {
    return (
        <FontAwesomeIcon icon={faEnvelope} className='icon' />
    )
}
export const InviteIconSolid = () => {
    return (
        <FontAwesomeIcon icon={faEnvelopeSolid} className='icon' />
    )
}
export const CopyIcon = () => {
    return (
        <FontAwesomeIcon icon={faCopy} className='icon' />
    )
}
export const EditIcon = () => {
    return (
        <FontAwesomeIcon icon={faPenToSquare} className='icon' />
    )
}
export const OptionsIcon = () => {
    return (
        <FontAwesomeIcon icon={faEllipsis} className='icon' />
    )
}
export const SortIcon = () => {
    return (
        <FontAwesomeIcon icon={faSort} className='icon' />
    )
}
export const NewTabIcon = () => {
    return (
        <FontAwesomeIcon icon={faArrowUpRightFromSquare} className='icon' />
    )
}
export const ShareIcon = () => {
    return (
        <FontAwesomeIcon icon={faArrowUpFromBracket} className='icon' />
    )
}
export const SaveIcon = () => {
    return (
        <FontAwesomeIcon icon={faSaveIcon} className='icon' />
    )
}
export const SavedIcon = () => {
    return (
        <FontAwesomeIcon icon={faSavedIcon} className='icon' />
    )
}
export const BackgroundMusicIcon = () => {
    return (
        <FontAwesomeIcon icon={faVolume} className='icon' />
    )
}
export const TicketIcon = () => {
    return (
        <FontAwesomeIcon icon={faTicket} className='icon' />
    )
}
export const TicketIconLight = () => {
    return (
        <FontAwesomeIcon icon={faTicketLight} className='icon' />
    )
}
export const NoPaymentIcon = () => {
    return (
        <FontAwesomeIcon icon={faBan} className='icon' />
    )
}
export const WeddingIcon = () => {
    return (
        <FontAwesomeIcon icon={faRingsWedding} className='icon' />
    )
}
export const FaceHeartsIcon = () => {
    return (
        <FontAwesomeIcon icon={faFaceSmileHearts} className='icon' />
    )
}
export const FaceSmileIcon = () => {
    return (
        <FontAwesomeIcon icon={faFaceSmile} className='icon' />
    )
}
export const FaceMehIcon = () => {
    return (
        <FontAwesomeIcon icon={faFaceMeh} className='icon' />
    )
}
export const FaceFrownIcon = () => {
    return (
        <FontAwesomeIcon icon={faFaceFrown} className='icon' />
    )
}
export const FacebookIcon = () => {
    return (
        <FontAwesomeIcon icon={faFacebook} className='icon' />
    )
}
export const TwitterIcon = () => {
    return (
        <FontAwesomeIcon icon={faXTwitter} className='icon' />
    )
}
export const InstagramIcon = () => {
    return (
        <FontAwesomeIcon icon={faInstagram} className='icon' />
    )
}
export const YoutubeIcon = () => {
    return (
        <FontAwesomeIcon icon={faYoutube} className='icon' />
    )
}
export const SpotifyIcon = () => {
    return (
        <FontAwesomeIcon icon={faSpotify} className='icon' />
    )
}
export const SoundcloudIcon = () => {
    return (
        <FontAwesomeIcon icon={faSoundcloud} className='icon' />
    )
}
export const VideoIcon = () => {
    return (
        <FontAwesomeIcon icon={faFilm} className='icon' />
    )
}
export const TrackIcon = () => {
    return (
        <FontAwesomeIcon icon={faFileMp3} className='icon' />
    )
}
export const PlayIcon = () => {
    return (
        <FontAwesomeIcon icon={faPlay} className='icon' />
    )
}
export const PauseIcon = () => {
    return (
        <FontAwesomeIcon icon={faPause} className='icon' />
    )
}
export const StarIcon = () => {
    return (
        <FontAwesomeIcon icon={faFullStar} className='icon' />
    )
}
export const StarEmptyIcon = () => {
    return (
        <FontAwesomeIcon icon={faEmptyStar} className='icon' />
    )
}
export const ShootingStarIcon = () => {
    return (
        <FontAwesomeIcon icon={faStarShooting} className='icon' />
    )
}
export const RejectedIcon = () => {
    return (
        <FontAwesomeIcon icon={faBan} className='icon' />
    )
}
export const SendMessageIcon = () => {
    return (
        <FontAwesomeIcon icon={faArrowUp} className='icon' />
    )
}
export const AddMember = () => {
    return (
        <FontAwesomeIcon icon={faUserPlus} className='icon' />
    )
}
export const RemoveMemberIcon = () => {
    return (
        <FontAwesomeIcon icon={faUserMinus} className='icon' />
    )
}
export const ArchiveIcon = () => {
    return (
        <FontAwesomeIcon icon={faBoxArchive} className='icon' />
    )
}
export const InboxIcon = () => {
    return (
        <FontAwesomeIcon icon={faInbox} className='icon' />
    )
}
export const FileIcon = () => {
    return (
        <FontAwesomeIcon icon={faFileImport} className='icon' style={{ marginBottom: 10 }} />
    )
}
export const DeleteIcon = () => {
    return (
        <FontAwesomeIcon icon={faSquareMinus} className='icon' />
    )
}
export const GigIcon = () => {
    return (
        <FontAwesomeIcon icon={faMessageMusic} className='icon' />
    )
}
export const VenueIconLight = () => {
    return (
        <FontAwesomeIcon icon={faLandmarkLight} className='icon' />
    )
}
export const VenueIconSolid = () => {
    return (
        <FontAwesomeIcon icon={faLandmarkSolid} className='icon' />
    )
}
export const MusicianIconLight = () => {
    return (
        <FontAwesomeIcon icon={faMusicLight} className='icon' />
    )
}
export const MusicianIconSolid = () => {
    return (
        <FontAwesomeIcon icon={faMusicSolid} className='icon' />
    )
}
export const FeedbackIcon = () => {
    return (
        <FontAwesomeIcon icon={faComments} className='icon' />
    )
}

export const MessageIcon = () => {
    return (
        <FontAwesomeIcon icon={faMessage} className='icon' />
    )
}
export const FilterIconFull = () => {
    return (
        <FontAwesomeIcon icon={faFullFilter} className='icon' />
    )
}

export const FilterIconEmpty = () => {
    return (
        <FontAwesomeIcon icon={faEmptyFilter} className='icon' />
    )
}
export const DeleteGigIcon = () => {
    return (
        <FontAwesomeIcon icon={faTrash} className='icon' />
    )
}
export const DeleteGigsIcon = () => {
    return (
        <FontAwesomeIcon icon={faTrashMultiple} className='icon' />
    )
}
export const DuplicateGigIcon = () => {
    return (
        <FontAwesomeIcon icon={faClone} className='icon' />
    )
}
export const TemplateIcon = () => {
    return (
        <FontAwesomeIcon icon={faTableTree} className='icon' />
    )
}
export const PieChartIcon = () => {
    return (
        <FontAwesomeIcon icon={faChartPieSimple} className='icon' />
    )
}
export const NextGigIcon = () => {
    return (
        <FontAwesomeIcon icon={faPartyHorn} className='icon' />
    )
}
export const AllGigsIcon = () => {
    return (
        <FontAwesomeIcon icon={faListMusic} className='icon' />
    )
}
export const ExclamationIcon = () => {
    return (
        <FontAwesomeIcon icon={faCircleExclamation} className='icon' />
    )
}
export const ExclamationIconSolid = () => {
    return (
        <FontAwesomeIcon icon={faCircleExclamationSolid} className='icon' />
    )
}
export const CancelIcon = () => {
    return (
        <FontAwesomeIcon icon={faBan} className='icon' />
    )
}
export const PasswordIcon = () => {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, backgroundColor: 'var(--gn-grey-300)', width: 'fit-content', padding: '0.5rem', borderRadius: '0.5rem'}}>
            <FontAwesomeIcon icon={faAsterisk} className='icon' style={{ fontSize: '0.5rem' }}/>
            <FontAwesomeIcon icon={faAsterisk} className='icon' style={{ fontSize: '0.5rem' }}/>
            <FontAwesomeIcon icon={faAsterisk} className='icon' style={{ fontSize: '0.5rem' }}/>
            <FontAwesomeIcon icon={faAsterisk} className='icon' style={{ fontSize: '0.5rem' }}/>
            <FontAwesomeIcon icon={faAsterisk} className='icon' style={{ fontSize: '0.5rem' }}/>
            <FontAwesomeIcon icon={faAsterisk} className='icon' style={{ fontSize: '0.5rem' }}/>
            <FontAwesomeIcon icon={faAsterisk} className='icon' style={{ fontSize: '0.5rem' }}/>
            <FontAwesomeIcon icon={faAsterisk} className='icon' style={{ fontSize: '0.5rem' }}/>

        </div>
    )
}
export const KeyIcon = () => {
    return (
        <FontAwesomeIcon icon={faKey} className='icon' />
    )
}
export const MediaIcon = () => {
    return (
        <FontAwesomeIcon icon={faPhotoFilmMusic} className='icon' />
    )
}
export const MoreInformationIcon = () => {
    return (
        <FontAwesomeIcon icon={faSquareInfo} className='icon' />
    )
}
export const SocialMediaIcon = () => {
    return (
        <FontAwesomeIcon icon={faHashtag} className='icon' />
    )
}
export const Mp4Icon = () => {
    return (
        <FontAwesomeIcon icon={faFileMp4} className='icon' />
    )
}
export const Mp3Icon = () => {
    return (
        <FontAwesomeIcon icon={faFileMp3} className='icon' />
    )
}
export const BankAccountIcon = () => {
    return (
        <FontAwesomeIcon icon={faPiggyBank} className='icon' />
    )
}
export const WarningIcon = () => {
    return (
        <FontAwesomeIcon icon={faWarning} className='icon' />
    )
}
export const PaymentSystemIcon = () => {
    return (
        <FontAwesomeIcon icon={faMoneyBillTransfer} className='icon' />
    )
}
export const StripeIcon = () => {
    return (
        <FontAwesomeIcon icon={faStripe} className='icon' />
    )
}
export const GoogleIcon = () => {
    return (
        <FontAwesomeIcon icon={faGoogle} className='icon' />
    )
}
export const AppleIcon = () => {
    return (
        <FontAwesomeIcon icon={faApple} className='icon' />
    )
}
export const VerifiedIcon = () => {
    return (
        <FontAwesomeIcon icon={faBadgeCheck} className='icon' color={'var(--gn-orange)'} />
    )
}
export const CashIcon = () => {
    return (
        <FontAwesomeIcon icon={faMoneyBillsSimple} className='icon' />
    )
}
export const RequestIcon = () => {
    return (
        <FontAwesomeIcon icon={faBellRing} className='icon' />
    )
}
export const EmptyIcon = () => {
    return (
        <FontAwesomeIcon icon={faEmptySet} className='icon' />
    )
}
export const PlayVideoIcon = () => {
    return (
        <FontAwesomeIcon icon={faCircleVideo} className='icon' />
    )
}
export const RepositionIcon = () => {
    return (
        <FontAwesomeIcon icon={faExpand} className='icon' />
    )
}
export const MonitorIcon = () => {
    return (
        <FontAwesomeIcon icon={faDesktop} className='icon' />
    )
}
export const SlidersIcon = () => {
    return (
        <FontAwesomeIcon icon={faSliders} className='icon' />
    )
}
export const PlugIcon = () => {
    return (
        <FontAwesomeIcon icon={faPlug} className='icon' />
    )
}
export const LinkIcon = () => {
    return (
        <FontAwesomeIcon icon={faLink} className='icon' />
    )
}
export const ImageIcon = () => {
    return (
        <FontAwesomeIcon icon={faImage} className='icon' />
    )
}
export const BuildingIcon = () => {
    return (
        <FontAwesomeIcon icon={faExcavator} className='icon' />
    )
}
export const ThumbsUpIcon = () => {
    return (
        <FontAwesomeIcon icon={faThumbsUp} className='icon' />
    )
}
export const ThumbsDownIcon = () => {
    return (
        <FontAwesomeIcon icon={faThumbsDown} className='icon' />
    )
}
export const PermissionsIcon = () => {
    return (
        <FontAwesomeIcon icon={faUserLock} className='icon' />
    )
}
export const HamburgerMenuIcon = () => {
    return (
        <FontAwesomeIcon icon={faBars} className='icon' style={{ fontSize: '1.25rem'}} />
    )
}
export const MobileIcon = () => {
    return (
        <FontAwesomeIcon icon={faMobileRetro} className='icon' />
    )
}
export const DNAIcon = () => {
    return (
        <FontAwesomeIcon icon={faDna} className='icon' />
    )
}
export const FilmIcon = () => {
    return (
        <FontAwesomeIcon icon={faVideo} className='icon' />
    )
}
export const VinylIcon = () => {
    return (
        <FontAwesomeIcon icon={faCompactDisc} className='icon' />
    )
}
export const LightModeIcon = () => {
    return (
        <FontAwesomeIcon icon={faSun} className='icon' />
    )
}
export const DarkModeIcon = () => {
    return (
        <FontAwesomeIcon icon={faMoon} className='icon' />
    )
}

export const RightArrowIcon = () => {
    return (
        <FontAwesomeIcon icon={faArrowRightLong} className='icon' />
    )
}
export const LeftArrowIcon = () => {
    return (
        <FontAwesomeIcon icon={faArrowLeftLong} className='icon' />
    )
}
export const UpArrowIcon = () => {
    return (
        <FontAwesomeIcon icon={faArrowUpLong} className='icon' />
    )
}
export const DownArrowIcon = () => {
    return (
        <FontAwesomeIcon icon={faArrowDownLong} className='icon' />
    )
}
export const WebsiteIcon = () => {
    return (
        <FontAwesomeIcon icon={faGlobePointer} className='icon' />
    )
}
export const TechRiderIcon = () => {
    return (
        <FontAwesomeIcon icon={faTachographDigital} className='icon' />
    )
}
export const UpdateIcon = () => {
    return (
        <FontAwesomeIcon icon={faSparkles} className='icon' />
    )
}

// Instrument icons for tech rider
export const VocalsIcon = () => {
    return (
        <FontAwesomeIcon icon={faMicrophoneLines} className='icon' />
    )
}

export const KeysIcon = () => {
    return (
        <FontAwesomeIcon icon={faPiano} className='icon' />
    )
}

export const SaxIcon = () => {
    return (
        <FontAwesomeIcon icon={faSaxophone} className='icon' />
    )
}

export const TrumpetIcon = () => {
    return (
        <FontAwesomeIcon icon={faTrumpet} className='icon' />
    )
}

/** Trombone: custom SVG (Font Awesome Pro trombone icon) */
export const TromboneIcon = () => {
    return (
        <span className="icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: '1em', height: '1em', fill: 'currentColor', verticalAlign: 'middle' }} aria-hidden>
                <path d="M477.5 32C447.1 32 418 44.1 396.5 65.5L311.6 150.4C273.7 188.3 223.9 211.9 170.6 217.2L112.9 223C88.3 225.5 77.5 255.5 95.1 273L223 401C240.5 418.5 270.5 407.8 273 383.2L278.8 325.4C282.1 292 292.7 260 309.4 231.4L398.1 320C373.9 344.2 320.7 397.4 171 547.1C162.8 555.3 151.6 560 140 560C115.8 560 96.1 540.4 96.1 516.1C96.1 504.5 100.7 493.3 109 485.1L174.2 419.9L140.3 386L75.1 451.2C57.9 468.4 48.2 491.8 48.2 516.2C48.2 566.9 89.3 608.1 140.1 608.1C164.5 608.1 187.8 598.4 205.1 581.2L385 401L401 385L558.5 227.5C579.9 206 592 176.9 592 146.5C592 83.3 540.7 32 477.5 32zM432 286.1L338.1 192.2C340.5 189.5 343 186.9 345.6 184.4L384 145.9L478.1 240L432 286.1zM417.9 112L430.4 99.5C442.9 87 459.8 80 477.4 80C514.1 80 543.9 109.8 543.9 146.5C543.9 164.1 536.9 181.1 524.4 193.5L512 206.1L417.9 112z"/>
            </svg>
        </span>
    )
}

export const PlaybackIcon = () => {
    return (
        <FontAwesomeIcon icon={faCompactDisc} className='icon' />
    )
}

export const AlbumCollectionIcon = () => {
    return (
        <FontAwesomeIcon icon={faAlbumCollectionCircleUser} className='icon' />
    )
}

export const FileUserIcon = () => {
    return (
        <FontAwesomeIcon icon={faFileUser} className='icon' />
    )
}

export const CelebrateIcon = () => {
    return (
        <FontAwesomeIcon icon={faFaceParty} className='icon' />
    )
}