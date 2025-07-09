import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LeftChevronIcon, FileIcon, DeleteIcon, StarIcon } from '@features/shared/ui/extras/Icons';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

const ItemType = 'IMAGE';

const DraggableImage = ({ image, index, moveImage, removeImage, totalImages }) => {
    const [, ref] = useDrag({
        type: ItemType,
        item: { index },
    });

    const [, drop] = useDrop({
        accept: ItemType,
        hover: (draggedItem) => {
            if (draggedItem.index !== index) {
                moveImage(draggedItem.index, index);
                draggedItem.index = index;
            }
        },
    });

    return (
        <div ref={(node) => ref(drop(node))} className="image-row-card">
            <img
                src={typeof image === 'string' ? image : URL.createObjectURL(image)}
                alt={`Preview ${index}`}
                className="image-thumbnail"
            />
            <div className="image-actions">
                <button className="btn icon remove" onClick={() => removeImage(index)}>
                    <DeleteIcon />
                </button>
                <div className="position-select">
                    {Array.from({ length: totalImages }).map((_, i) => (
                        <button
                            key={i}
                            className={`btn tiny ${i === index ? 'selected' : ''}`}
                            onClick={() => moveImage(index, i)}
                            disabled={i === index}
                        >
                            {i === 0 ? (
                                    <span className={`first-image ${index === 0 ? 'gold' : 'black'}`}>
                                        <StarIcon />
                                    </span>
                                ) : (
                                    i + 1
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export const Photos = ({ formData, handleInputChange, stepError, setStepError }) => {
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
        if (images.length === 0) {
            setStepError('Please upload some images of your venue.');
            return;
        }
        if (images.length < 3) {
            setStepError('You must upload a minimum of three images.');
            return;
        };
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
            <div className='stage photos'>
                <div className="stage-content">
                    <div className="stage-definition">
                        <h1>Show Off Your Venue</h1>
                        <p className="stage-copy">Upload clear photos that highlight your venue’s space, stage setup, and unique atmosphere. A great first impression starts here.</p>
                    </div>
                    <div className='photo-space'>
                        <div
                            className={`upload ${stepError ? 'error' : ''}`}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                        >
                            <input
                                type='file'
                                multiple
                                onChange={handleFileChange}
                                onClick={() => setStepError(null)}
                                style={{ display: 'none' }}
                                id='fileInput'
                            />
                            <label htmlFor='fileInput' className='upload-label'>
                                <FileIcon />
                                Click to upload or drag and drop. <br /> <span>Add at least 3 images.</span>
                            </label>
                        </div>
                        <h6 className='input-label'>Arrange your images by importance using drag-and-drop or the position buttons.</h6>
                        <div className='preview'>
                            {images.map((image, index) => (
                                <DraggableImage
                                key={index}
                                image={image}
                                index={index}
                                moveImage={moveImage}
                                removeImage={removeImage}
                                totalImages={images.length}
                            />
                            ))}
                        </div>
                    </div>
                </div>
                <div className='stage-controls'>
                    <button className='btn secondary' onClick={() => navigate(-1)}>
                        Back
                    </button>
                    <button className='btn primary' onClick={handleNext}>Continue</button>
                </div>
            </div>
        </DndProvider>
    );
};

