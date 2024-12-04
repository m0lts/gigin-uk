import { faFacebook, faFacebookSquare, faInstagram, faInstagramSquare, faSoundcloud, faSpotify, faTwitter, faTwitterSquare, faYoutube, faYoutubeSquare } from "@fortawesome/free-brands-svg-icons"
import { faCircle, faFilm, faLocationDot, faPlayCircle, faUserCircle, faVideo } from "@fortawesome/free-solid-svg-icons"
import { faAddressCard, faAmpGuitar, faArrowLeftFromArc, faArrowRightFromBracket, faArrowUpFromBracket, faArrowUpRightFromSquare, faBeerFoam, faCalendar, faCamcorder, faCameraViewfinder, faCastle, faCheck, faCheckCircle, faChevronDown, faChevronLeft, faChevronRight, faCircleArrowLeft, faCirclePlus, faClipboard, faClock, faCoin, faCoins, faCreditCard, faCutlery, faDoorOpen, faDrum, faEllipsis, faEnvelope, faFileInvoice, faFileMp3, faFileMp4, faGear, faGlassesRound, faGraduationCap, faGuitars, faHouseWindow, faLightbulb, faLocationPin, faMagnifyingGlass, faMailbox, faMailboxFlagUp, faMapLocation, faMicrophoneLines, faMicrophoneStand, faMuseum, faPause, faPencil, faPencilSquare, faPeopleGroup, faPeopleRoof, faPiano, faPlaceOfWorship, faPlay, faPlayPause, faQuestionCircle, faRectanglesMixed, faReel, faRingsWedding, faShield, faShieldCheck, faSort, faSpeakers, faTelescope, faTicket, faTurntable, faVolume, faX, faXmarkCircle, faStarShooting, faTrashCan, faBan } from "@fortawesome/pro-light-svg-icons"
import { faArrowUp, faFaceFrown, faFaceMeh, faFaceSmile, faFaceSmileHearts } from "@fortawesome/pro-regular-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faBookmark as faSaveIcon } from "@fortawesome/pro-light-svg-icons"
import { faBookmark as faSavedIcon } from "@fortawesome/free-solid-svg-icons"
import { faStar as faFullStar } from "@fortawesome/free-solid-svg-icons"
import { faStar as faEmptyStar } from "@fortawesome/pro-regular-svg-icons"


// General icons
export const UserIcon = () => {
    return (
        <FontAwesomeIcon icon={faUserCircle} className="icon" />
    )
}
export const SearchIcon = () => {
    return (
        <FontAwesomeIcon icon={faMagnifyingGlass} className="icon" />
    )

}
export const LogOutIcon = () => {
    return (
        <FontAwesomeIcon icon={faArrowRightFromBracket} className="icon" />
    )
}
export const VenueBuilderIcon = () => {
    return (
        <FontAwesomeIcon icon={faPencil} className="icon" />
    )
}
export const SettingsIcon = () => {
    return (
        <FontAwesomeIcon icon={faGear} className="icon" />
    )
}
export const DotIcon = () => {
    return (
        <FontAwesomeIcon icon={faCircle} className="icon" />
    )
}
export const GuitarsIcon = () => {
    return (
        <FontAwesomeIcon icon={faGuitars} className="icon" />
    )
}
export const MicrophoneLinesIcon = () => {
    return (
        <FontAwesomeIcon icon={faMicrophoneLines} className="icon" />
    )
}
export const PeopleRoofIcon = () => {
    return (
        <FontAwesomeIcon icon={faPeopleRoof} className="icon" />
    )
}
export const PeopleGroupIcon = () => {
    return (
        <FontAwesomeIcon icon={faPeopleGroup} className="icon" />
    )
}
export const CoinIcon = () => {
    return (
        <FontAwesomeIcon icon={faCoin} className="icon" />
    )
}
export const TutoringIcon = () => {
    return (
        <FontAwesomeIcon icon={faGraduationCap} className="icon" />
    )
}
export const ShieldIcon = () => {
    return (
        <FontAwesomeIcon icon={faShieldCheck} className="icon" />
    )
}
export const SuccessIcon = () => {
    return (
        <FontAwesomeIcon icon={faCheckCircle} className="icon" style={{ color: 'green' }} />
    )
}
export const ErrorIcon = () => {
    return (
        <FontAwesomeIcon icon={faXmarkCircle} className="icon" style={{ color: 'red' }} />
    )
}
export const CloseIcon = () => {
    return (
        <FontAwesomeIcon icon={faX} className="icon" />
    )
}
export const SeeIcon = () => {
    return (
        <FontAwesomeIcon icon={faGlassesRound} className="icon" />
    )
}
export const QuestionCircleIcon = () => {
    return (
        <FontAwesomeIcon icon={faQuestionCircle} className="icon" />
    )
}
export const LeftChevronIcon = () => {
    return (
        <FontAwesomeIcon icon={faChevronLeft} className="icon" />
    )
}
export const RightChevronIcon = () => {
    return (
        <FontAwesomeIcon icon={faChevronRight} className="icon" />
    )
}
export const DownChevronIcon = () => {
    return (
        <FontAwesomeIcon icon={faChevronDown} className="icon" />
    )
}
export const ExitIcon = () => {
    return (
        <FontAwesomeIcon icon={faArrowLeftFromArc} className="icon" />
    )
}
export const HouseIcon = () => {
    return (
        <FontAwesomeIcon icon={faHouseWindow} className="icon" />
    )
}
export const BeerIcon = () => {
    return (
        <FontAwesomeIcon icon={faBeerFoam} className="icon" />
    )
}
export const MapIcon = () => {
    return (
        <FontAwesomeIcon icon={faMapLocation} className="icon" />
    )
}
export const MicrophoneIcon = () => {
    return (
        <FontAwesomeIcon icon={faMicrophoneStand} className="icon" />
    )
}
export const RestaurantIcon = () => {
    return (
        <FontAwesomeIcon icon={faCutlery} className="icon" />
    )
}
export const PlaceOfWorshipIcon = () => {
    return (
        <FontAwesomeIcon icon={faPlaceOfWorship} className="icon" />
    )
}
export const VillageHallIcon = () => {
    return (
        <FontAwesomeIcon icon={faMuseum} className="icon" />
    )
}
export const ClubIcon = () => {
    return (
        <FontAwesomeIcon icon={faTurntable} className="icon" />
    )
}
export const OtherIcon = () => {
    return (
        <FontAwesomeIcon icon={faCastle} className="icon" />
    )
}
export const SpeakersIcon = () => {
    return (
        <FontAwesomeIcon icon={faSpeakers} className="icon" />
    )
}
export const PianoIcon = () => {
    return (
        <FontAwesomeIcon icon={faPiano} className="icon" />
    )
}
export const AmpIcon = () => {
    return (
        <FontAwesomeIcon icon={faAmpGuitar} className="icon" />
    )
}
export const DrumsIcon = () => {
    return (
        <FontAwesomeIcon icon={faDrum} className="icon" />
    )
}
export const CameraIcon = () => {
    return (
        <FontAwesomeIcon icon={faCameraViewfinder} className="icon" />
    )
}
export const LocationPinIcon = () => {
    return (
        <FontAwesomeIcon icon={faLocationDot} className="icon" />
    )
}
export const DashboardIcon = () => {
    return (
        <FontAwesomeIcon icon={faRectanglesMixed} className="icon" />
    )
}
export const CalendarIcon = () => {
    return (
        <FontAwesomeIcon icon={faCalendar} className="icon" />
    )
}
export const TickIcon = () => {
    return (
        <FontAwesomeIcon icon={faCheck} className="icon" />
    )
}
export const ClockIcon = () => {
    return (
        <FontAwesomeIcon icon={faClock} className="icon" />
    )
}
export const PreviousIcon = () => {
    return (
        <FontAwesomeIcon icon={faCircleArrowLeft} className="icon" />
    )
}
export const DoorIcon = () => {
    return (
        <FontAwesomeIcon icon={faDoorOpen} className="icon" />
    )
}
export const PlusIcon = () => {
    return (
        <FontAwesomeIcon icon={faCirclePlus} className="icon" />
    )
}
export const TelescopeIcon = () => {
    return (
        <FontAwesomeIcon icon={faTelescope} className="icon" />
    )
}
export const CoinsIcon = () => {
    return (
        <FontAwesomeIcon icon={faCoins} className="icon" />
    )
}
export const CardIcon = () => {
    return (
        <FontAwesomeIcon icon={faCreditCard} className="icon" />
    )
}
export const InvoiceIcon = () => {
    return (
        <FontAwesomeIcon icon={faFileInvoice} className="icon" />
    )
}
export const LightBulbIcon = () => {
    return (
        <FontAwesomeIcon icon={faLightbulb} className="icon" />
    )
}
export const MailboxEmptyIcon = () => {
    return (
        <FontAwesomeIcon icon={faMailbox} className="icon" />
    )
}
export const MailboxFullIcon = () => {
    return (
        <FontAwesomeIcon icon={faMailboxFlagUp} className="icon" />
    )
}
export const ProfileIcon = () => {
    return (
        <FontAwesomeIcon icon={faAddressCard} className="icon" />
    )
}
export const InviteIcon = () => {
    return (
        <FontAwesomeIcon icon={faEnvelope} className="icon" />
    )
}
export const CopyIcon = () => {
    return (
        <FontAwesomeIcon icon={faClipboard} className="icon" />
    )
}
export const EditIcon = () => {
    return (
        <FontAwesomeIcon icon={faPencilSquare} className="icon" />
    )
}
export const OptionsIcon = () => {
    return (
        <FontAwesomeIcon icon={faEllipsis} className="icon" />
    )
}
export const SortIcon = () => {
    return (
        <FontAwesomeIcon icon={faSort} className="icon" />
    )
}
export const NewTabIcon = () => {
    return (
        <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="icon" />
    )
}
export const ShareIcon = () => {
    return (
        <FontAwesomeIcon icon={faArrowUpFromBracket} className="icon" />
    )
}
export const SaveIcon = () => {
    return (
        <FontAwesomeIcon icon={faSaveIcon} className="icon" />
    )
}
export const SavedIcon = () => {
    return (
        <FontAwesomeIcon icon={faSavedIcon} className="icon" />
    )
}
export const BackgroundMusicIcon = () => {
    return (
        <FontAwesomeIcon icon={faVolume} className="icon" />
    )
}
export const TicketIcon = () => {
    return (
        <FontAwesomeIcon icon={faTicket} className="icon" />
    )
}
export const WeddingIcon = () => {
    return (
        <FontAwesomeIcon icon={faRingsWedding} className="icon" />
    )
}
export const FaceHeartsIcon = () => {
    return (
        <FontAwesomeIcon icon={faFaceSmileHearts} className="icon" />
    )
}
export const FaceSmileIcon = () => {
    return (
        <FontAwesomeIcon icon={faFaceSmile} className="icon" />
    )
}
export const FaceMehIcon = () => {
    return (
        <FontAwesomeIcon icon={faFaceMeh} className="icon" />
    )
}
export const FaceFrownIcon = () => {
    return (
        <FontAwesomeIcon icon={faFaceFrown} className="icon" />
    )
}
export const FacebookIcon = () => {
    return (
        <FontAwesomeIcon icon={faFacebook} className="icon" color={'#0000ff'} />
    )
}
export const TwitterIcon = () => {
    return (
        <FontAwesomeIcon icon={faTwitter} className="icon" color={'#37b2ff'} />
    )
}
export const InstagramIcon = () => {
    return (
        <FontAwesomeIcon icon={faInstagram} className="icon" color={'#fbad50'} />
    )
}
export const YoutubeIcon = () => {
    return (
        <FontAwesomeIcon icon={faYoutube} className="icon" color={'#ff0000'} />
    )
}
export const SpotifyIcon = () => {
    return (
        <FontAwesomeIcon icon={faSpotify} className="icon" color={'#14cc00'} />
    )
}
export const SoundcloudIcon = () => {
    return (
        <FontAwesomeIcon icon={faSoundcloud} className="icon" color={'#ff5c37'} />
    )
}
export const VideoIcon = () => {
    return (
        <FontAwesomeIcon icon={faCamcorder} className="icon" />
    )
}
export const TrackIcon = () => {
    return (
        <FontAwesomeIcon icon={faFileMp3} className="icon" />
    )
}
export const PlayIcon = () => {
    return (
        <FontAwesomeIcon icon={faPlayCircle} className="icon" />
    )
}
export const PauseIcon = () => {
    return (
        <FontAwesomeIcon icon={faPause} className="icon" />
    )
}
export const StarIcon = () => {
    return (
        <FontAwesomeIcon icon={faFullStar} className="icon" />
    )
}
export const StarEmptyIcon = () => {
    return (
        <FontAwesomeIcon icon={faEmptyStar} className="icon" />
    )
}
export const ShootingStarIcon = () => {
    return (
        <FontAwesomeIcon icon={faStarShooting} className="icon" />
    )
}
export const DeleteIcon = () => {
    return (
        <FontAwesomeIcon icon={faTrashCan} className="icon" />
    )
}
export const RejectedIcon = () => {
    return (
        <FontAwesomeIcon icon={faBan} className="icon" />
    )
}
export const SendMessageIcon = () => {
    return (
        <FontAwesomeIcon icon={faArrowUp} className="icon" />
    )
}

