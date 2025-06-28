import { NoTextLogo } from '@features/shared/ui/logos/Logos';
import { CameraIcon, DashboardIcon, HouseIcon } from '@features/shared/ui/extras/Icons';
import '@styles/host/venue-builder.styles.css'


export const UploadingProfile = ({ text, progress }) => {
    return (
        <div className='uploading-profile'>
            <NoTextLogo />
            <span className='text'>{text}</span>
            <div className='icons'>
                {progress < 33 ? (
                    <span className='active'><CameraIcon /></span>
                ) : (
                    <CameraIcon />
                )}
                {(progress >= 33 && progress < 66) ? (
                    <span className='active'><HouseIcon /></span>
                ) : (
                    <HouseIcon />
                )}
                {progress >= 66 ? (
                    <span className='active'><DashboardIcon /></span>
                ) : (
                    <DashboardIcon />
                )}
            </div>
            <div className='progress-bar-container'>
                <div className='progress-bar' style={{ width: `${progress}%` }}></div>
            </div>
            <p className='warning'>Please do not refresh the page or close this window.</p>
        </div>
    )
}