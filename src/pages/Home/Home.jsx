import { useState } from "react"
import { MapView } from "/pages/Home/Features/MapView/MapView"
import { ListView } from "/pages/Home/Features/ListView/ListView"
import { ChangeViewTypeButton } from "/components/Global/Buttons/Buttons"
import { Header } from "/components/Global/Header/Header"
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