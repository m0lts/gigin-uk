export const ReviewsTab = ({ reviews }) => {
    if (reviews && reviews.length > 0) {
        return (
            <div className="reviews">
                <h1>reviews page</h1>
            </div>
        )
    } else {
        return (
            <div className="no-reviews">
                <h4>No reviews to show.</h4>
            </div>
        )
    }
}