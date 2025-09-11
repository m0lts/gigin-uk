import { LoadingSpinner } from "./Loading"

export const LoadingModal = ({ title = null, text = null }) => {
    return (
        <div className="modal loading">
            <div className="modal-content">
                <LoadingSpinner />
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