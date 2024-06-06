import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LeftChevronIcon } from '/components/ui/Icons/Icons';
import { CameraIcon } from "../../../components/ui/Icons/Icons";
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { CloseIcon } from "../../../components/ui/Icons/Icons";

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
                src={URL.createObjectURL(image)}
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
        if (formData.photos.length < 3) return;
        navigate('/host/venue-builder/additional-details');
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
        if (formData.venueType === '') {
            navigate('/host/venue-builder');
        }
    }, [formData])

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="stage photos">
                <h2 className='orange-title'>Photos</h2>
                <h3 className='subtitle'>Let's spruce it up. Add some images of your space.</h3>
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
                    <h4>Drag the photos in order of their importance.</h4>
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