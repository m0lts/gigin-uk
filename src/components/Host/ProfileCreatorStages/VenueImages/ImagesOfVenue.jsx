import { useEffect } from "react"
import { MultipleImagesInput } from "../../../Global/Images/ImageInputs"


export const ImagesOfVenue = ({ images = [], setImages, numberOfImages, setNextButtonAvailable }) => {

    useEffect(() => {
        const containsNonNullImage = images.some((image) => image !== null && image !== undefined);
        if (images.length > 0 && containsNonNullImage) {
            setNextButtonAvailable(true);
        } else {
            setNextButtonAvailable(false);
        }
    }, [images]);

    return (
        <div className='image-inputs profile-creator-stage'>
            <h1 className='title'>Let's spruce it up.</h1>
            <p className='text'>Please insert up to {numberOfImages} images of the venue below. You can edit the order of the images later.</p>
            <MultipleImagesInput 
                images={images}
                setImages={setImages}
                numberOfImages={numberOfImages}
            />
        </div>
    )

}