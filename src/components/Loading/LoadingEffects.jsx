import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import './loading-effects.styles.css'

export const LoadingDots = () => {
    return (
        <div className='loading-dots'>
            <div className='dot dot1'></div>
            <div className='dot dot2'></div>
            <div className='dot dot3'></div>
        </div>
    )
}

export const LoadingSkeletonText = ({ count = 1, height }) => {
    return (
        <div className="loading-skeleton">
            <Skeleton
                count={count}
                height={height}
            />
        </div>
    )
}
export const LoadingSkeletonIcon = () => {
    return (
        <Skeleton
            width={50}
            height={50}
        />
    )
}