import { useState } from "react";
import { NextIcon, BackIcon, InsertImageIcon, XIcon } from "../../Icons/Icons"


export const ImageInputs = ({ images, setImages }) => {

    const [imageNumber, setImageNumber] = useState(0);
    const [imagePreviews, setImagePreviews] = useState([]);
    const imagePrompts = [
        'Primary venue image',
        'Secondary venue image',
        'Tertiary venue image',
        'Quaternary venue image'
    ]

    // Image addition and removal
    const handleImageChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const previews = [...imagePreviews];
                previews[imageNumber] = reader.result;
                setImagePreviews(previews);

                const updatedImages = [...images];
                updatedImages[imageNumber] = file;
                setImages(updatedImages);
            };
            reader.readAsDataURL(file);
        }
    };

    const removeImage = () => {
        const previews = [...imagePreviews];
        previews[imageNumber] = null;
        setImagePreviews(previews);

        const updatedImages = [...images];
        updatedImages[imageNumber] = null;
        setImages(updatedImages);

        const input = document.getElementById(`image-input-${imageNumber}`);
        if (input) {
            input.value = '';
        }
    };

    return (
        <div className='image-inputs profile-creator-stage'>
            <h1 className='title'>Let's spruce it up.</h1>
            <p className='text'>Please insert the images as prompted below</p>
            <div className="image-input-cont">
                <label htmlFor={`image-input-${imageNumber}`} className="insert-image-label">
                    {imagePreviews[imageNumber] ? (
                        <>
                            <img
                                src={imagePreviews[imageNumber]}
                                alt={`Preview ${imageNumber}`}
                                className="preview-image"
                                onClick={removeImage}
                            />
                            <div className="remove-image">
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
                {imageNumber > 0 && (
                    <BackIcon 
                        setStageNumber={setImageNumber}
                        stageNumber={imageNumber}
                    />
                )}
                <h3>{imagePrompts[imageNumber]}</h3>
                <NextIcon 
                    setStageNumber={setImageNumber}
                    stageNumber={imageNumber}
                    images={images}
                />
            </div>
        </div>
    )
};