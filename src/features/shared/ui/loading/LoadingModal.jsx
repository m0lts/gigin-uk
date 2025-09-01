import { LoadingSpinner } from "./Loading"

export const LoadingModal = ({ title = null, text = null }) => {
    return (
        <div className="modal loading">
            <div className="modal-content">
                <LoadingSpinner width={50} height={50} />
                {title && (
                    <div className="loading-text">
                        <h3>{title}</h3>
                        {text && (
                            <p>{text}</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}