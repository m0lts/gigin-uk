import { LoadingSpinner, LoadingThreeDots } from './Loading'
import { NoTextLogo } from '../logos/Logos'
import '@styles/shared/loading.styles.css'

export const LoadingScreen = () => {
    return (
        <div className='loading-screen'>
            <div className='loading-body'>
                <LoadingSpinner />
            </div>
        </div>
        
    )
}