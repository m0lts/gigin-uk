import { useState } from "react"
import { MapView } from "/pages/Home/MapView/home.map-view.jsx"
import { ListView } from "/pages/Home/ListView/home.list-view.jsx"
import { ChangeViewTypeButton } from "/pages/Home/Buttons/home.buttons.jsx"
import { Header } from "/components/Header/Header"
import './home.styles.css'

export const Home = () => {

    // Handle view change
    const [showMap, setShowMap] = useState(true);

    return (
        <div className="home">
            <Header />
            <section className="body">
                {showMap ? (
                    <MapView />
                ) : (
                    <ListView />
                )}
                <ChangeViewTypeButton 
                    showMap={showMap}
                    setShowMap={setShowMap}
                />
            </section>
        </div>
    )
}