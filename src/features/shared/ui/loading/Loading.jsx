import '@styles/shared/loading.styles.css'

export const LoadingThreeDots = () => {
    return (
        <div className='loading dot-flashing'>
        </div>
    )
}

export const LoadingSpinner = ({ width = 20, height = 20, marginTop = 0, marginBottom = 0, color = 'var(--gn-off-black)' }) => {
    return (
        <div className="loading spinner" aria-hidden style={{ width: width, height: height, margin: '0.5rem auto', marginTop: marginTop, marginBottom: marginBottom, borderTop: `2px solid ${color}`, borderRight: `2px solid ${color}`, borderBottom: `2px solid ${color}` }} />
    )
}