import { useState, useEffect } from "react"
import { useAuth } from '../../../hooks/useAuth';

export const MusicianDashboard = () => {

    const { user } = useAuth();

    const [loadingData, setLoadingData] = useState(false);

    return (
        <>  
            <h1>Musician Dashboard</h1>
        </>
    )
}