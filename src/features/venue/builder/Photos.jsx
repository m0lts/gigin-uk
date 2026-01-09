import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CameraIcon, DeleteGigIcon } from '../../shared/ui/extras/Icons';

const MAX_IMAGES = 1;
const IMAGE_MIME = /^image\//i;

const prepareIncomingFiles = (fileList, currentCount, setStepError) => {
  const incoming = Array.from(fileList).filter(f => IMAGE_MIME.test(f.type));
  const availableSlots = Math.max(0, MAX_IMAGES - currentCount);
  const filesToProcess = incoming.slice(0, availableSlots);
  
  return filesToProcess.map(file => ({ file, offsetY: 0, blur: 0 }));
};

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
    venueName,
    updatePrimaryBlur,
    isBlurring,
    setIsBlurring,
  }) => {
  
    const [startY, setStartY] = useState(null);
    const [initialOffsetY, setInitialOffsetY] = useState(0);
    const [offsetY, setOffsetY] = useState(image.offsetY || 0);
    const [localBlur, setLocalBlur] = useState(image.blur || 0);
    const [imageError, setImageError] = useState(false);
    const [objectUrl, setObjectUrl] = useState(null);
    
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

    // Create and manage object URL for File objects
    useEffect(() => {
      if (image?.file instanceof File) {
        const url = URL.createObjectURL(image.file);
        setObjectUrl(url);
        return () => {
          URL.revokeObjectURL(url);
        };
      } else {
        setObjectUrl(null);
      }
    }, [image?.file]);

    const imageSrc = useMemo(() => {
        if (typeof image === 'string') return image;
        if (typeof image?.file === 'string') return image.file;
        if (image?.file instanceof File && objectUrl) {
          return objectUrl;
        }
        return '';
      }, [image, objectUrl]);

    // Sync local blur with image blur when image file changes (not when blur changes during editing)
    useEffect(() => {
      if (image?.blur !== undefined) {
        setLocalBlur(image.blur);
      }
    }, [image?.file]);
  
    return (
      <div className="image-row-card">
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
              transition: isRepositioning ? 'none' : 'transform 0.2s ease-out, filter 0.2s ease-out',
              filter: isPrimary ? (localBlur ? `blur(${localBlur}px)` : 'none') : (image.blur ? `blur(${image.blur}px)` : 'none'),
              display: imageError ? 'none' : 'block',
            }}
            onError={() => {
              setImageError(true);
            }}
            onLoad={() => {
              setImageError(false);
            }}
          />
          {imageError && (
            <div style={{ 
              padding: '2rem', 
              textAlign: 'center', 
              color: 'var(--gn-red)',
              backgroundColor: 'var(--gn-grey-200)',
              borderRadius: '1rem'
            }}>
              <p style={{ margin: 0, fontWeight: 500 }}>Image failed to load</p>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                This may be an iCloud file. Please download it to your computer first.
              </p>
            </div>
          )}
        </div>
  
        <div className="image-actions">
          {isPrimary ? (
            <>
              <button className="btn danger" onClick={() => removeImage(index)}>
                Delete Image
              </button>
              <button
                className="btn tertiary"
                onClick={() => {
                  setIsRepositioning((prev) => !prev);
                  if (isRepositioning) setIsBlurring(false);
                }}
              >
                {isRepositioning ? 'Save Position' : 'Reposition'}
              </button>
              <button
                className="btn tertiary"
                onClick={() => {
                  setIsBlurring((prev) => !prev);
                  if (isBlurring) setIsRepositioning(false);
                }}
              >
                {isBlurring ? 'Save Blur' : 'Blur'}
              </button>
              {isBlurring && (
                <div className="blur-control">
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="0.5"
                    value={localBlur}
                    onChange={(e) => {
                      const newBlur = parseFloat(e.target.value);
                      setLocalBlur(newBlur);
                      if (isPrimary && updatePrimaryBlur) {
                        updatePrimaryBlur(newBlur);
                      }
                    }}
                    className="blur-slider"
                  />
                  <span className="blur-value">
                    {Math.round((localBlur / 20) * 100)}%
                  </span>
                </div>
              )}
            </>
          ) : (
            <button className="btn icon remove" onClick={() => removeImage(index)}>
              <DeleteGigIcon />
            </button>
          )}
  
        </div>
      </div>
    );
  };

export const Photos = ({ formData, handleInputChange, stepError, setStepError }) => {
    const navigate = useNavigate();
    const [images, setImages] = useState(formData.photos || []);
    
    // Initialize primaryImage from formData.photos
    const getInitialPrimaryImage = () => {
        if (!formData.photos || formData.photos.length === 0) return null;
        const firstPhoto = formData.photos[0];
        if (typeof firstPhoto === 'object' && firstPhoto?.file) {
            return { 
                file: firstPhoto.file, 
                offsetY: firstPhoto.offsetY || formData.primaryImageOffsetY || 0, 
                blur: firstPhoto.blur || formData.primaryImageBlur || 0 
            };
        }
        if (typeof firstPhoto === 'string') {
            return { 
                file: firstPhoto, 
                offsetY: formData.primaryImageOffsetY || 0, 
                blur: formData.primaryImageBlur || 0 
            };
        }
        return null;
    };
    
    const [primaryImage, setPrimaryImage] = useState(getInitialPrimaryImage());
    const [isRepositioning, setIsRepositioning] = useState(false);
    const [isBlurring, setIsBlurring] = useState(false);

    const updatePrimaryOffset = (newOffset /* -50..0 from your drag */) => {
      setPrimaryImage((prev) => ({ ...prev, offsetY: newOffset }));
      // Convert editor's range [-50..0] to "percent from top" [0..50].
      // 50 + (-50..0) => [0..50]. If you ever extend drag below center,
      // you can allow positive newOffset up to +50 to reach [0..100].
      const percentFromTop = Math.max(0, Math.min(100, 50 + Number(newOffset || 0)));
      handleInputChange?.('primaryImageOffsetY', percentFromTop);
    };

    const updatePrimaryBlur = (newBlur) => {
      setPrimaryImage((prev) => ({ ...prev, blur: newBlur }));
      handleInputChange?.('primaryImageBlur', newBlur);
    };

    const toEditorOffset = (percentFromTop) => {
      const n = parseFloat(percentFromTop);
      if (!Number.isFinite(n)) return 0;
      // Stored 0..100 (0 = top, 50 = center, 100 = bottom)
      // Editor wants -50..+50 relative to center
      return Math.max(-50, Math.min(50, n - 50));
    };

    // Sync primaryImage to formData.photos when the file changes
    const lastSyncedFileRef = useRef(null);
    useEffect(() => {
        const currentFile = primaryImage?.file;
        if (currentFile !== lastSyncedFileRef.current) {
            lastSyncedFileRef.current = currentFile;
            if (primaryImage !== null) {
                handleInputChange('photos', [primaryImage]);
            } else if (images.length === 0) {
                handleInputChange('photos', []);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [primaryImage?.file, images.length]);

    useEffect(() => {
      if (images.length > 0) {
        const wrappedImages = images.map((img, i) => {
          if (typeof img === 'object' && 'file' in img) {
            if (i === 0 && primaryImage && img.file === primaryImage.file && primaryImage.blur !== undefined) {
              return { ...img, blur: primaryImage.blur };
            }
            return img;
          }
          const offsetY = i === 0 ? toEditorOffset(formData.primaryImageOffsetY) : 0;
          const blur = i === 0 ? (primaryImage?.blur ?? formData.primaryImageBlur ?? 0) : 0;
          return { file: img, offsetY, blur };
        });
        const clamped = wrappedImages.slice(0, MAX_IMAGES);
        if (wrappedImages.length > MAX_IMAGES) {
          setStepError?.(`You can upload up to ${MAX_IMAGES} image.`);
        }
        const newPrimaryImage = clamped[0] || null;
        if (primaryImage?.file !== newPrimaryImage?.file) {
          setPrimaryImage(newPrimaryImage);
        }
      } else if (primaryImage !== null) {
        setPrimaryImage(null);
      }
    }, [images, formData.primaryImageOffsetY, primaryImage, setStepError]);

      const handleFileChange = (event) => {
        const currentCount = images.length;
        const triedNonImage = Array.from(event.target.files).some(f => !IMAGE_MIME.test(f.type));
        const overCap = currentCount + Array.from(event.target.files).length > MAX_IMAGES;
      
        if (triedNonImage) {
          setStepError?.('Only image files are allowed.');
          return;
        }
        if (overCap) {
          setStepError?.(`You can upload up to ${MAX_IMAGES} image.`);
          return;
        }
        
        const wrappedFiles = prepareIncomingFiles(event.target.files, currentCount, setStepError);
        if (wrappedFiles.length === 0) return;
        setImages(wrappedFiles);
      };
      
      const handleDrop = (event) => {
        event.preventDefault();
        const currentCount = images.length;
        const triedNonImage = Array.from(event.dataTransfer.files).some(f => !IMAGE_MIME.test(f.type));
        const overCap = currentCount + Array.from(event.dataTransfer.files).length > MAX_IMAGES;
      
        if (triedNonImage) {
          setStepError?.('Only image files are allowed.');
          return;
        }
        if (overCap) {
          setStepError?.(`You can upload up to ${MAX_IMAGES} image.`);
          return;
        }
        
        const wrappedFiles = prepareIncomingFiles(event.dataTransfer.files, currentCount, setStepError);
        if (wrappedFiles.length === 0) return;
        setImages(wrappedFiles);
      };

    const handleDragOver = (event) => {
        event.preventDefault();
    };

    const handleNext = () => {
        if (images.length === 0) {
            setStepError('Please upload an image of your venue.');
            return;
        }
        navigate('/venues/add-venue/additional-details');
    };

    const removeImage = (index) => {
        setImages([]);
    };

    useEffect(() => {
        if (formData.type === '') {
            navigate('/venues/add-venue');
        }
    }, [formData]);
    
    // Sync formData.photos to images only on initial mount
    // Use a ref to track if we've already initialized to prevent loops
    const hasInitializedRef = useRef(false);
    useEffect(() => {
        // Only sync on initial mount when images is empty
        // This prevents circular updates
        if (!hasInitializedRef.current && images.length === 0) {
            if (formData.photos && formData.photos.length > 0) {
                setImages(formData.photos);
                hasInitializedRef.current = true;
            } else {
                hasInitializedRef.current = true; // Mark as initialized even if no photos
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run on mount

    return (
        <div className='stage photos'>
                <div className="stage-content">
                    <div className="stage-definition">
                        <h1>Show Off Your Venue</h1>
                        <p className="stage-copy">Upload a clear photo that highlights your venue's space, stage setup, and unique atmosphere. A great first impression starts here.</p>
                    </div>
                    <div className='photo-space'>
                      {images.length === 0 && (
                        <div
                            className={`upload ${stepError ? 'error' : ''}`}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                        >
                            <input
                                type='file'
                                accept="image/*" 
                                onChange={handleFileChange}
                                onClick={() => setStepError(null)}
                                style={{ display: 'none' }}
                                id='fileInput'
                            />
                        <label
                          htmlFor="fileInput"
                          className={`upload-label ${images.length >= MAX_IMAGES ? 'disabled' : ''}`}
                          style={{ pointerEvents: images.length >= MAX_IMAGES ? 'none' : 'auto', opacity: images.length >= MAX_IMAGES ? 0.6 : 1 }}
                        >
                          <CameraIcon />
                          <div className="text">
                            <h4>{images.length >= MAX_IMAGES ? 'Image uploaded' : 'Click here to upload an image, or drag and drop it here.'}</h4>
                            <p>Add 1 image.</p>
                          </div>
                        </label>
                        </div>
                        )}
                        {images.length > 0 && (
                            <>
                                <h6 className='input-label'>Your venue image</h6>
                                <div className="primary-image-dropzone">
                                    {primaryImage ? (
                                        <div className="banner-preview">
                                            <DraggableImage
                                                image={primaryImage}
                                                index={0}
                                                moveImage={() => {}}
                                                removeImage={() => {
                                                    setPrimaryImage(null);
                                                    setImages([]);
                                                }}
                                                totalImages={1}
                                                isPrimary={true}
                                                isRepositioning={isRepositioning}
                                                setIsRepositioning={(updater) => {
                                                  const next =
                                                    typeof updater === 'function' ? updater(isRepositioning) : updater;
                                                  if (isRepositioning && !next && primaryImage) {
                                                    const percentFromTop = Math.max(
                                                      0,
                                                      Math.min(100, 50 + Number(primaryImage.offsetY || 0))
                                                    );
                                                    handleInputChange?.('primaryImageOffsetY', percentFromTop);
                                                  }
                                                  setIsRepositioning(next);
                                                }}
                                                updatePrimaryOffset={updatePrimaryOffset}
                                                venueName={formData?.name}
                                                updatePrimaryBlur={updatePrimaryBlur}
                                                isBlurring={isBlurring}
                                                setIsBlurring={setIsBlurring}
                                            />
                                        </div>
                                    ) : (
                                        <div
                                            className="upload empty-primary"
                                        >
                                            <h4>Drag a photo here</h4>
                                        </div>
                                    )}
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
    );
};

