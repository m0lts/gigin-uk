import { useState } from "react";
import { NextIcon, BackIcon, InsertImageIcon, XIcon } from "/components/Icons/Icons"
import './images.inputs.styles.css'

export const MultipleImagesInput = ({ images, setImages, numberOfImages }) => {

    const [imageNumber, setImageNumber] = useState(0);

    // Image addition and removal
    const handleImageChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const updatedImages = [...images];
            updatedImages[imageNumber] = file;
            setImages(updatedImages);
          }
    };

    const removeImage = () => {
        const updatedImages = [...images];
        updatedImages[imageNumber] = null;
        setImages(updatedImages);

        const input = document.getElementById(`image-input-${imageNumber}`);
        if (input) {
            input.value = '';
        }
    };

    return (
        <>
            <div className="multiple-image-inputs-cont">
                <label htmlFor={`image-input-${imageNumber}`} className="insert-image-label">
                    {images[imageNumber] ? (
                        <>
                            <img
                                src={typeof images[imageNumber] === 'string' ? images[imageNumber] : URL.createObjectURL(images[imageNumber])}
                                alt={`Preview ${imageNumber}`}
                                className="preview-image"
                                
                            />
                            <div className="remove-image" onClick={removeImage}>
                                <XIcon />
                                <span>Remove Image</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <InsertImageIcon />
                            <span>Insert Image</span>
                        </>
                    )}
                </label>
                <input
                    type="file"
                    id={`image-input-${imageNumber}`}
                    accept="image/*"
                    className="image-input"
                    onChange={(event) => handleImageChange(event)}
                />
            </div>
            <div className={`image-change-bar ${imageNumber === 0 ? 'right-flex' : ''}`}>
                <BackIcon 
                    setStageNumber={setImageNumber}
                    stageNumber={imageNumber}
                />
                <h3>{imageNumber + 1}/{numberOfImages}</h3>
                <NextIcon 
                    setStageNumber={setImageNumber}
                    stageNumber={imageNumber}
                    maxNumber={numberOfImages}
                />
            </div>
        </>
    )
};
