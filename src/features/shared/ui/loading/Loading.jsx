import '@styles/shared/loading.styles.css'

export const LoadingThreeDots = () => {
    return (
        <div className='loading dot-flashing'>
        </div>
    )
}

export const LoadingSpinner = ({ width = 40, height = 40 }) => {
    return (
        <div className="loading spinner" aria-hidden style={{ width: width, height: height }} />
    )
}