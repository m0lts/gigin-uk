import { useState } from "react"
import { MapView } from "./MapView/MapView"
import { FilterBar } from "./FilterBar/FilterBar"
import { ListView } from "./ListView/ListView"
import { ChangeViewTypeButton } from "../../../components/Global/Buttons/Buttons"

export const Homepage = () => {

    // Handle view change
    const [showMap, setShowMap] = useState(true);

    return (
        <section className="homepage">
            <FilterBar />
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
    )
}