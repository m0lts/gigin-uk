import { LoadingSpinner, LoadingThreeDots } from './Loading'
import { NoTextLogo } from '../logos/Logos'
import '@styles/shared/loading.styles.css'

export const LoadingScreen = ({ text = null }) => {
    return (
        <div className='loading-screen'>
            <div className='loading-body'>
                <LoadingSpinner />
                {text && (
                    <h4>{text}</h4>
                )}
            </div>
        </div>
        
    )
}