import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LeftChevronIcon, FileIcon, DeleteIcon, StarIcon } from '@features/shared/ui/extras/Icons';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { CameraIcon, DeleteGigIcon, RepositionIcon, SaveIcon } from '../../shared/ui/extras/Icons';

const ItemType = 'IMAGE';

const DraggableImage = ({
    image,
    index,
    moveImage,
    removeImage,
    totalImages,
    isPrimary,
    isRepositioning,
    setIsRepositioning,
    updatePrimaryOffset,
  }) => {
    const isDraggable = !isPrimary;
    const [, ref] = useDrag({
      type: ItemType,
      item: { index },
      canDrag: () => isDraggable,
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
  
    const [startY, setStartY] = useState(null);
    const [initialOffsetY, setInitialOffsetY] = useState(0);
    const [offsetY, setOffsetY] = useState(image.offsetY || 0);
    
    const handleMouseDown = (e) => {
      if (!isRepositioning) return;
      setStartY(e.clientY);
      setInitialOffsetY(offsetY);
    };
    
    const handleMouseMove = (e) => {
      if (!isRepositioning || startY === null) return;
      const deltaY = e.clientY - startY;
      const newOffset = Math.max(Math.min(initialOffsetY + deltaY * 0.2, 0), -50);
      setOffsetY(newOffset);
    };
  
    const handleMouseUp = () => {
      if (isRepositioning) {
        updatePrimaryOffset(offsetY);
      }
      setStartY(null);
    };
  
    const imageSrc = useMemo(() => {
        if (typeof image === 'string') return image;
        if (typeof image?.file === 'string') return image.file;
        if (image?.file instanceof File) return URL.createObjectURL(image.file);
        return '';
      }, [image]);

  
    return (
      <div ref={isDraggable ? (node) => ref(drop(node)) : null} className="image-row-card">
        <div
          className={`draggable-container ${isRepositioning ? 'repositioning' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            cursor: isRepositioning ? 'grabbing' : 'default',
            overflow: 'hidden',
            height: '100%',
            width: '100%',
          }}
        >
          <img
            src={imageSrc}
            className="image-thumbnail draggable"
            style={{
              objectFit: 'cover',
              transform: `translateY(${isPrimary ? offsetY : image.offsetY || 0}%)`,
              transition: isRepositioning ? 'none' : 'transform 0.2s ease-out',
            }}
          />
        </div>
  
        <div className="image-actions">
          {isPrimary ? (
            <>
              <button className="btn tertiary close" onClick={() => removeImage(index)}>
                <DeleteGigIcon />
              </button>
              <button
                className="btn secondary"
                onClick={() => setIsRepositioning((prev) => !prev)}
              >
                {isRepositioning ? <SaveIcon /> : <RepositionIcon />}
              </button>
            </>
          ) : (
            <button className="btn icon remove" onClick={() => removeImage(index)}>
              <DeleteGigIcon />
            </button>
          )}
  
          {!isPrimary && (
            <div className="position-select">
              {Array.from({ length: totalImages }).map((_, i) => (
                <button
                  key={i}
                  className={`btn tiny ${i === index ? 'selected' : ''}`}
                  onClick={() => moveImage(index, i)}
                  disabled={i === index}
                >
                    {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

export const Photos = ({ formData, handleInputChange, stepError, setStepError }) => {
    const navigate = useNavigate();
    const [images, setImages] = useState(formData.photos || []);
    const [primaryImage, setPrimaryImage] = useState(
        images[0]
          ? { file: images[0], offsetY: formData.primaryImageOffsetY || 0 }
          : null
      );
    const [otherImages, setOtherImages] = useState(images.slice(1));
    const [isRepositioning, setIsRepositioning] = useState(false);

    const updatePrimaryOffset = (newOffset) => {
        setPrimaryImage((prev) => ({
            ...prev,
            offsetY: newOffset,
        }));
    };

    useEffect(() => {
        handleInputChange(
          'photos',
          primaryImage ? [primaryImage, ...otherImages] : []
        );
      }, [primaryImage, otherImages]);

      useEffect(() => {
        if (images.length > 0) {
          const wrappedImages = images.map((img) =>
            typeof img === 'object' && 'file' in img ? img : { file: img, offsetY: 0 }
          );
          setPrimaryImage(wrappedImages[0]);
          setOtherImages(wrappedImages.slice(1));
        } else {
          setPrimaryImage(null);
          setOtherImages([]);
        }
      }, [images]);

      const handleFileChange = (event) => {
        const files = Array.from(event.target.files);
        const wrappedFiles = files.map(file => ({ file, offsetY: 0 }));
        setImages(prevImages => [...prevImages, ...wrappedFiles]);
      };
      
      const handleDrop = (event) => {
        event.preventDefault();
        const files = Array.from(event.dataTransfer.files);
        const wrappedFiles = files.map(file => ({ file, offsetY: 0 }));
        setImages(prevImages => [...prevImages, ...wrappedFiles]);
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

    const moveImage = (fromIndex, toIndex, newOffsetY = null) => {
        const updatedImages = [...images];
        if (newOffsetY !== null && fromIndex === 0 && toIndex === 0) {
          const updatedPrimary = { ...primaryImage, offsetY: newOffsetY };
          setPrimaryImage(updatedPrimary);
          return;
        }
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
                                <CameraIcon />
                                <div className="text">
                                    <h4>Click here to upload images, or drag and drop them here.</h4>
                                    <p>Add at least 3 images.</p>
                                </div>
                            </label>
                        </div>
                        {images.length > 0 && (
                            <>
                                <h6 className='input-label'>Add your best venue image here</h6>
                                <div className="primary-image-dropzone">
                                    {primaryImage ? (
                                        <div className="banner-preview">
                                            <DraggableImage
                                                image={primaryImage}
                                                index={0}
                                                moveImage={(fromIndex, toIndex) => {
                                                    if (fromIndex !== 0) {
                                                    const imageToMove = otherImages[fromIndex - 1];
                                                    const updatedOthers = otherImages.filter((_, i) => i !== fromIndex - 1);
                                                    setPrimaryImage(imageToMove);
                                                    setOtherImages([primaryImage, ...updatedOthers]);
                                                    }
                                                }}
                                                removeImage={() => {
                                                    setPrimaryImage(null);
                                                    setImages([...otherImages]);
                                                }}
                                                totalImages={images.length}
                                                isPrimary={true}
                                                isRepositioning={isRepositioning}
                                                setIsRepositioning={setIsRepositioning}
                                                updatePrimaryOffset={updatePrimaryOffset}
                                            />
                                        </div>
                                    ) : (
                                        <div
                                            className="upload empty-primary"
                                        >
                                            <h4>Drag a photo here to make it your primary image</h4>
                                        </div>
                                    )}
                                </div>
                                <h6 className='input-label'>Arrange your other images here</h6>
                                <div className='preview'>
                                    {otherImages.map((image, index) => (
                                        <DraggableImage
                                        key={`image-${index}`}
                                        image={image}
                                        index={index + 1}
                                        moveImage={moveImage}
                                        removeImage={removeImage}
                                        totalImages={images.length}
                                        isPrimary={false}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
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

