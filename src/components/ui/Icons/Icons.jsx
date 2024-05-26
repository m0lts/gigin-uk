import { faCircle } from "@fortawesome/free-solid-svg-icons"
import { faCheckCircle, faCoin, faGraduationCap, faGuitars, faMicrophoneLines, faPeopleGroup, faPeopleRoof, faShield, faShieldCheck, faXmarkCircle } from "@fortawesome/pro-light-svg-icons"
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