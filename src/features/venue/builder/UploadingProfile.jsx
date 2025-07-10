import { NoTextLogo } from '@features/shared/ui/logos/Logos';
import { CameraIcon, DashboardIconLight, HouseIconLight } from '@features/shared/ui/extras/Icons';
import '@styles/host/venue-builder.styles.css'
import { LoadingThreeDots } from '../../shared/ui/loading/Loading';


export const UploadingProfile = ({ text, progress }) => {
    return (
        <div className='uploading-profile'>
            <NoTextLogo />
            <h1>{text}</h1>
            <LoadingThreeDots />
            <div className='progress-bar-container'>
                <div className='progress-bar' style={{ width: `${progress}%` }}></div>
            </div>
            <p className='warning'>Please do not refresh the page or close this window.</p>
        </div>
    )
}