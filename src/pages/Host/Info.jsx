import { Link } from "react-router-dom"

export const HostInfo = () => {
    return (
        <div>
            <h1>This is the Host info page</h1>
            <Link to={'/host/venue-builder'}>
                <button>
                    Let's get started
                </button>
            </Link>
        </div>
    )
}