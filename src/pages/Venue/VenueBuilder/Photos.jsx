import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LeftChevronIcon, CameraIcon, CloseIcon } from '/components/ui/Extras/Icons';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

const ItemType = 'IMAGE';

const DraggableImage = ({ image, index, moveImage, removeImage }) => {
    const [, ref] = useDrag({
        type: ItemType,
        item: { index }
    });

    const [, drop] = useDrop({
        accept: ItemType,
        hover: (draggedItem) => {
            if (draggedItem.index !== index) {
                moveImage(draggedItem.index, index);
                draggedItem.index = index;
            }
        }
    });

    return (
        <div
            ref={(node) => ref(drop(node))}
            className="preview-image-container"
        >
            <img
                src={typeof image === 'string' ? image : URL.createObjectURL(image)}
                alt={`Preview ${index}`}
                className="preview-image"
            />
            <button className="remove-button" onClick={() => removeImage(index)}>
                <CloseIcon />
            </button>
        </div>
    );
};

export const Photos = ({ formData, handleInputChange }) => {
    const navigate = useNavigate();
    const [images, setImages] = useState(formData.photos || []);

    useEffect(() => {
        handleInputChange('photos', images);
    }, [images]);

    const handleFileChange = (event) => {
        const files = Array.from(event.target.files);
        setImages((prevImages) => [...prevImages, ...files]);
    };

    const handleDrop = (event) => {
        event.preventDefault();
        const files = Array.from(event.dataTransfer.files);
        setImages((prevImages) => [...prevImages, ...files]);
    };

    const handleDragOver = (event) => {
        event.preventDefault();
    };

    const handleNext = () => {
        if (images.length < 3) return;
        navigate('/venues/add-venue/additional-details');
    };

    const moveImage = (fromIndex, toIndex) => {
        const updatedImages = [...images];
        const [movedImage] = updatedImages.splice(fromIndex, 1);
        updatedImages.splice(toIndex, 0, movedImage);
        setImages(updatedImages);
    };

    const removeImage = (index) => {
        setImages(images.filter((_, i) => i !== index));
    };

    useEffect(() => {
        if (formData.type === '') {
            navigate('/venues/add-venue');
        }
    }, [formData]);

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="stage photos">
                <h3>Let's spruce it up! Add some images of your space.</h3>
                <div className="photo-space">
                    <div
                        className="upload"
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                    >
                        <input
                            type="file"
                            multiple
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                            id="fileInput"
                        />
                        <label htmlFor="fileInput" className="upload-label">
                            <CameraIcon />
                            <span>Click or drag images here to upload. Add at least 3 images.</span>
                        </label>
                    </div>
                    <h6 className="input-label">Drag your venue's main image to the left.</h6>
                    <div className="preview">
                        {images.map((image, index) => (
                            <DraggableImage
                                key={index}
                                image={image}
                                index={index}
                                moveImage={moveImage}
                                removeImage={removeImage}
                            />
                        ))}
                    </div>
                </div>
                <div className="controls">
                    <button className='btn secondary' onClick={() => navigate(-1)}>
                        <LeftChevronIcon />
                    </button>
                    <button className='btn primary' onClick={handleNext}>Continue</button>
                </div>
            </div>
        </DndProvider>
    );
};

