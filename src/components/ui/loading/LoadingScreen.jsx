import { LoadingThreeDots } from "./Loading"
import { NoTextLogo } from "../logos/Logos"
import '/styles/common/loading.styles.css'

export const LoadingScreen = () => {
    return (
        <div className="loading-screen">
            <div className="loading-body">
                <NoTextLogo />
                <LoadingThreeDots />
            </div>
        </div>
        
    )
}