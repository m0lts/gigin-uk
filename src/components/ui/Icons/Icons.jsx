import { faCircle } from "@fortawesome/free-solid-svg-icons"
import { faArrowLeftFromArc, faCheckCircle, faChevronLeft, faCoin, faGlassesRound, faGraduationCap, faGuitars, faMicrophoneLines, faPeopleGroup, faPeopleRoof, faQuestionCircle, faShield, faShieldCheck, faX, faXmarkCircle } from "@fortawesome/pro-light-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

// General icons
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
export const ExitIcon = () => {
    return (
        <FontAwesomeIcon icon={faArrowLeftFromArc} className="icon" />
    )
}