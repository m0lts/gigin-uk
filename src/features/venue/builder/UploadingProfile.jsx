import { NoTextLogo } from '@features/shared/ui/logos/Logos';
import { LoadingSpinner } from '@features/shared/ui/loading/Loading';
import '@styles/host/venue-builder.styles.css'


export const UploadingProfile = ({ text, progress }) => {
    return (
        <div className='uploading-profile'>
            <NoTextLogo />
            <h1>{text}</h1>
            <LoadingSpinner marginTop={'1.25rem'} />
            {progress && (
                <div className='progress-bar-container'>
                    <div className='progress-bar' style={{ width: `${progress}%` }}></div>
                </div>
            )}
            <p className='warning'>Please do not refresh the page or close this window.</p>
        </div>
    )
}