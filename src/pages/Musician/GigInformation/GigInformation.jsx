// Dependencies
    import { useState, useEffect } from 'react'
    import { useLocation, useParams } from 'react-router-dom'

// Components
    import { Header } from '/components/Header/Header'

// Styles
    import './gig-information.styles.css'

export const GigInformation = () => {

    const [gigInformation, setGigInformation] = useState({});

    const { id } = useParams();
    const location = useLocation();

    useEffect(() => {
        setGigInformation(location.state);
    }, [location, id]);

    useEffect(() => {
        console.log(id);
        console.log(location.state);
        console.log(gigInformation);
    }, [id, location, gigInformation]);

    return (
        <>
            <Header />
            <section className="gig-information">
                <h1>gig information</h1>
                <p>{id}</p>
            </section>
        </>
    )
}