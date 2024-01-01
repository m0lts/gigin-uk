import { useEffect, useState } from "react";
import { SingleImageInput } from "../../../Global/Images/ImageInputs"


export const InHouseEquipmentImages = ({ inHouseEquipment, setInHouseEquipment }) => {

    const handleImageChange = (index, imageData) => {
        const updatedEquipment = [...inHouseEquipment];
        updatedEquipment[index].image = imageData;
        setInHouseEquipment(updatedEquipment);
    };

    return (
        <div className='in-house-equipment-images profile-creator-stage'>
            <h1 className='title'>Photos of the Equipment</h1>
            <p className="text">Adding images of your equipment will improve your chances of finding musicians.</p>
            <div className="equipment-images">
                {inHouseEquipment && inHouseEquipment.map((equipment, index) => (
                    <div className="equipment" key={index}>
                        <h3 className="subtitle">{equipment.equipment}:</h3>
                        <SingleImageInput
                            image={equipment.image}
                            setImage={(imageData) => handleImageChange(index, imageData)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};