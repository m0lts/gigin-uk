// Dependencies
    import { useEffect } from "react"

// Components
    import { EquipmentImageInput } from "/pages/Host/VenueCreator/Stages/Equipment/Inputs/Equipment.inputs"

// Styles
    import './equipment-images.styles.css'


export const HostEquipmentImages = ({ inHouseEquipment, setInHouseEquipment, setNextButtonAvailable }) => {

    const handleImageChange = (index, imageData) => {
        setInHouseEquipment(prevEquipment => {
            const updatedEquipment = [...prevEquipment];
            updatedEquipment[index].image = imageData;
            return updatedEquipment;
        });
    };

    useEffect(() => {
        setNextButtonAvailable(true);
    }, []);

    return (
        <div className='in-house-equipment-images profile-creator-stage'>
            <h1 className='title'>Photos of the Equipment</h1>
            <p className="text">Adding images of your equipment will improve your chances of finding musicians.</p>
            <div className="equipment-images">
                {inHouseEquipment && inHouseEquipment.map((object, index) => (
                    <EquipmentImageInput
                        key={index}
                        equipment={object.equipment}
                        image={object.image}
                        setImage={(imageData) => handleImageChange(index, imageData)}
                    />
                ))}
            </div>
        </div>
    );
};