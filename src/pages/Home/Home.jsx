import { useState } from "react"
import { MapView } from "/pages/Home/MapView/MapView.jsx"
import { ListView } from "/pages/Home/ListView/ListView.jsx"
import { ChangeViewTypeButton } from "/pages/Home/Buttons/Home.buttons"
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