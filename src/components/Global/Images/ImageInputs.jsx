import { useState } from "react";
import { NextIcon, BackIcon, InsertImageIcon, XIcon } from "../Icons/Icons"
import './image-inputs.styles.css'

export const MultipleImagesInput = ({ images, setImages, numberOfImages }) => {

    const [imageNumber, setImageNumber] = useState(0);

    // Image addition and removal
    const handleImageChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const updatedImages = [...images];
                updatedImages[imageNumber] = reader.result;
                setImages(updatedImages);
            };
            reader.readAsDataURL(file);
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
                                src={images[imageNumber]}
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

export const SingleImageInput = ({ image, setImage }) => {

    // Image addition and removal
    const handleImageChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImage(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const removeImage = () => {
        setImage(null);
        const input = document.getElementById(`image-input`);
        if (input) {
            input.value = '';
        }
    };

    return (
        <div className="single-image-input-cont">
            <label htmlFor='image-input' className="insert-image-label">
                {image ? (
                    <>
                        <img
                            src={image}
                            alt='Preview'
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
                id='image-input'
                accept="image/*"
                className="image-input"
                onChange={(event) => handleImageChange(event)}
            />
        </div>
    )
};