import { useParams } from 'react-router-dom';

export const GigInfo = () => {
    const { gigId } = useParams(); // Extract gigId from URL params

    return (
        <div>
            <h1>Gig ID: {gigId}</h1>
            {/* Fetch gig data from the database based on gigId */}
            {/* Display gig information here */}
        </div>
    );
};