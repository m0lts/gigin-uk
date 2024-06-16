import { LoadingThreeDots } from "./Loading"
import { TextLogo } from "../logos/Logos"
import '/styles/common/loading.styles.css'

export const LoadingScreen = () => {
    return (
        <div className="loading-screen">
            <div className="loading-body">
                <TextLogo />
                <LoadingThreeDots />
            </div>
        </div>
    )
}