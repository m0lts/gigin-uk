import { GiginLogo } from '../../../../components/Global/Logo/GiginLogo'
import './info-box.styles.css'

export const InfoBox = () => {
    return (
        <div className="info-box">
            <GiginLogo />
            <h1>Gigin members have hosted 3,892 gigs.</h1>
            <h3>We support both solo musicians and bands, just create a band in your control centre.</h3>
            <h3>Becoming a Gigin member is completely free for all!</h3>
            <h4>We believe live music should be available and enjoyed by all.</h4>
        </div>
    )
}