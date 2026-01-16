import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CameraIcon, DeleteGigIcon, FilmIcon, PlayIcon } from '../../shared/ui/extras/Icons';
import { LoadingSpinner } from '../../shared/ui/loading/Loading';

const MAX_IMAGES = 1;
const IMAGE_MIME = /^image\//i;
const VIDEO_MIME = /^video\//i;
const MAX_VIDEO_STORAGE_BYTES = 100 * 1024 * 1024; // 100MB

// Helper function to generate video thumbnail
const generateVideoThumbnail = (file) => {
  if (typeof document === "undefined") {
    return Promise.resolve({ file: null, previewUrl: null });
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    const cleanup = () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    const handleError = (err) => {
      cleanup();
      if (err instanceof Error) {
        reject(err);
      } else {
        reject(new Error("Unable to generate video thumbnail"));
      }
    };

    video.addEventListener("error", handleError);
    video.addEventListener("loadeddata", () => {
      try {
        const targetTime = Math.min(1, video.duration ? Math.max(0, video.duration * 0.1) : 0.5);
        video.currentTime = targetTime || 0;
      } catch (error) {
        handleError(error);
      }
    });

    video.addEventListener("seeked", () => {
      try {
        const canvas = document.createElement("canvas");
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              cleanup();
              reject(new Error("Failed to capture video frame"));
              return;
            }
            const thumbnailFile = new File([blob], `${file.name.replace(/\.[^/.]+$/, "") || "video"}-thumbnail.png`, {
              type: "image/png",
              lastModified: Date.now(),
            });
            const previewUrl = URL.createObjectURL(blob);
            cleanup();
            resolve({ file: thumbnailFile, previewUrl });
          },
          "image/png",
          0.92
        );
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  });
};

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (!bytes || bytes <= 0) return '0B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  const formatted = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted}${units[index]}`;
};

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
    const [videos, setVideos] = useState(formData.videos || []);
    const [generatingThumbnails, setGeneratingThumbnails] = useState(new Set());
    
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
    
    // Calculate video storage usage
    const videoStorageUsage = useMemo(() => {
        return videos.reduce((total, video) => {
            // For new videos, use file size; for existing videos, use stored size bytes
            const videoSize = video.videoFile?.size || video.videoSizeBytes || 0;
            const thumbnailSize = video.thumbnailFile?.size || video.thumbnailSizeBytes || 0;
            return total + videoSize + thumbnailSize;
        }, 0);
    }, [videos]);
    
    const isOverStorageLimit = videoStorageUsage > MAX_VIDEO_STORAGE_BYTES;
    const storagePercent = (videoStorageUsage / MAX_VIDEO_STORAGE_BYTES) * 100;

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
    
    // Handle video file selection
    const handleVideoChange = async (event) => {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) return;
        
        const videoFiles = files.filter(f => VIDEO_MIME.test(f.type));
        if (videoFiles.length === 0) {
            setStepError?.('Only video files are allowed.');
            return;
        }
        
        // Check storage limit for new videos
        const newVideosSize = videoFiles.reduce((total, file) => total + file.size, 0);
        if (videoStorageUsage + newVideosSize > MAX_VIDEO_STORAGE_BYTES) {
            setStepError?.(`Total video storage cannot exceed ${formatFileSize(MAX_VIDEO_STORAGE_BYTES)}. Current usage: ${formatFileSize(videoStorageUsage)}`);
            return;
        }
        
        // Process each video file
        for (const videoFile of videoFiles) {
            const videoId = `video-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            setGeneratingThumbnails(prev => new Set(prev).add(videoId));
            
            try {
                const { file: thumbnailFile, previewUrl: thumbnailPreviewUrl } = await generateVideoThumbnail(videoFile);
                
                const newVideo = {
                    id: videoId,
                    title: videoFile.name.replace(/\.[^/.]+$/, "") || 'Untitled Video',
                    videoFile: videoFile,
                    videoSizeBytes: videoFile.size,
                    thumbnailFile: thumbnailFile,
                    thumbnailSizeBytes: thumbnailFile?.size || 0,
                    thumbnailPreviewUrl: thumbnailPreviewUrl,
                    isThumbnailGenerating: false,
                };
                
                setVideos(prev => [...prev, newVideo]);
            } catch (error) {
                console.error('Failed to generate thumbnail:', error);
                setStepError?.('Failed to generate video thumbnail. Please try again.');
            } finally {
                setGeneratingThumbnails(prev => {
                    const next = new Set(prev);
                    next.delete(videoId);
                    return next;
                });
            }
        }
        
        // Reset input
        if (event.target) {
            event.target.value = '';
        }
    };
    
    const removeVideo = (videoId) => {
        setVideos(prev => {
            const updated = prev.filter(v => v.id !== videoId);
            // Clean up object URLs
            const removed = prev.find(v => v.id === videoId);
            if (removed?.thumbnailPreviewUrl) {
                URL.revokeObjectURL(removed.thumbnailPreviewUrl);
            }
            return updated;
        });
    };
    
    // Sync videos to formData - use ref to prevent infinite loops
    const lastSyncedVideosRef = useRef(null);
    useEffect(() => {
        // Only sync if videos actually changed (compare by length and IDs)
        const videosChanged = 
            lastSyncedVideosRef.current === null ||
            lastSyncedVideosRef.current.length !== videos.length ||
            videos.some((video, index) => {
                const lastVideo = lastSyncedVideosRef.current[index];
                return !lastVideo || lastVideo.id !== video.id || 
                       lastVideo.videoFile !== video.videoFile ||
                       lastVideo.thumbnailFile !== video.thumbnailFile;
            });
        
        if (videosChanged) {
            lastSyncedVideosRef.current = videos;
            handleInputChange('videos', videos);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videos]);

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
            }
            if (formData.videos && formData.videos.length > 0) {
                setVideos(formData.videos);
            }
            hasInitializedRef.current = true;
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
                    
                    {/* Video Upload Section - Only show after image is uploaded */}
                    {images.length > 0 && (
                        <div className="upload-videos-section">
                                <h6 className='input-label'>Videos (Optional)</h6>
                                
                                {/* Storage Usage Bar */}
                                {videos.length > 0 && (
                                    <div className="storage-usage" style={{ 
                                        marginBottom: '1rem',
                                        padding: '0.75rem',
                                        backgroundColor: 'var(--gn-grey-100)',
                                        borderRadius: '0.5rem'
                                    }}>
                                        <div style={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            marginBottom: '0.5rem',
                                            fontSize: '0.875rem'
                                        }}>
                                            <span style={{ fontWeight: 500 }}>Video Storage Usage</span>
                                            <span style={{ 
                                                color: isOverStorageLimit ? 'var(--gn-red)' : 'inherit',
                                                fontWeight: 500
                                            }}>
                                                {formatFileSize(videoStorageUsage)} / {formatFileSize(MAX_VIDEO_STORAGE_BYTES)}
                                            </span>
                                        </div>
                                        <div style={{
                                            width: '100%',
                                            height: '8px',
                                            backgroundColor: 'var(--gn-grey-300)',
                                            borderRadius: '4px',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                width: `${Math.min(storagePercent, 100)}%`,
                                                height: '100%',
                                                backgroundColor: isOverStorageLimit ? 'var(--gn-red)' : 'var(--gn-orange)',
                                                transition: 'width 0.2s ease'
                                            }} />
                                        </div>
                                    </div>
                                )}
                                
                                {/* Video Upload Button */}
                                <div style={{ marginBottom: '1rem' }}>
                                    <input
                                        type='file'
                                        accept="video/*"
                                        onChange={handleVideoChange}
                                        onClick={() => setStepError(null)}
                                        style={{ display: 'none' }}
                                        id='videoInput'
                                        multiple
                                    />
                                    <label
                                        htmlFor="videoInput"
                                        className="upload-label"
                                        style={{ 
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '1rem',
                                            cursor: isOverStorageLimit ? 'not-allowed' : 'pointer',
                                            opacity: isOverStorageLimit ? 0.6 : 1,
                                            pointerEvents: isOverStorageLimit ? 'none' : 'auto',
                                            padding: '1rem',
                                            width: 'fit-content',
                                            border: '1px solid var(--gn-grey-350)',
                                            borderRadius: '0.5rem',
                                            boxShadow: '0 0 5px var(--gn-shadow)'
                                        }}
                                    >
                                        <FilmIcon style={{ fontSize: '1.5rem' }} />
                                        <div className="text"><h4>Click here to upload {videos.length === 0 ? 'a video' : 'another video'}.</h4></div>
                                    </label>
                                </div>
                                
                                {/* Videos List */}
                                {videos.length > 0 && (
                                    <div className="videos-list" style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                        gap: '1rem',
                                        marginTop: '1rem'
                                    }}>
                                        {videos.map((video) => {
                                            const isGenerating = generatingThumbnails.has(video.id);
                                            return (
                                                <div key={video.id} style={{
                                                    position: 'relative',
                                                    borderRadius: '0.5rem',
                                                    overflow: 'hidden',
                                                    backgroundColor: 'var(--gn-grey-100)'
                                                }}>
                                                    {isGenerating ? (
                                                        <div style={{
                                                            aspectRatio: '16/9',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '0.5rem',
                                                            padding: '1rem'
                                                        }}>
                                                            <LoadingSpinner />
                                                            <p style={{ fontSize: '0.75rem', color: 'var(--gn-grey-600)' }}>
                                                                Generating thumbnail...
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {video.thumbnailPreviewUrl || video.thumbnailUrl ? (
                                                                <img 
                                                                    src={video.thumbnailPreviewUrl || video.thumbnailUrl} 
                                                                    alt={video.title}
                                                                    style={{
                                                                        width: '100%',
                                                                        aspectRatio: '16/9',
                                                                        objectFit: 'cover',
                                                                        display: 'block'
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div style={{
                                                                    aspectRatio: '16/9',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    backgroundColor: 'var(--gn-grey-200)'
                                                                }}>
                                                                    <FilmIcon style={{ fontSize: '2rem', color: 'var(--gn-grey-400)' }} />
                                                                </div>
                                                            )}
                                                            <div style={{
                                                                position: 'absolute',
                                                                top: '50%',
                                                                left: '50%',
                                                                transform: 'translate(-50%, -50%)',
                                                                pointerEvents: 'none'
                                                            }}>
                                                                <PlayIcon style={{ fontSize: '2rem', color: 'white', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                                                            </div>
                                                        </>
                                                    )}
                                                    <div style={{
                                                        padding: '0.75rem',
                                                        backgroundColor: 'white'
                                                    }}>
                                                        <p style={{
                                                            margin: 0,
                                                            fontSize: '0.875rem',
                                                            fontWeight: 500,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap'
                                                        }}>
                                                            {video.title}
                                                        </p>
                                                        <p style={{
                                                            margin: '0.25rem 0 0 0',
                                                            fontSize: '0.75rem',
                                                            color: 'var(--gn-grey-600)'
                                                        }}>
                                                            {formatFileSize((video.videoSizeBytes || 0) + (video.thumbnailSizeBytes || 0))}
                                                        </p>
                                                    </div>
                                                    <button
                                                        className="btn icon remove"
                                                        onClick={() => removeVideo(video.id)}
                                                        style={{
                                                            position: 'absolute',
                                                            top: '0.5rem',
                                                            right: '0.5rem',
                                                            backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                                            border: 'none',
                                                            borderRadius: '50%',
                                                            width: '2rem',
                                                            height: '2rem',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            cursor: 'pointer',
                                                            color: 'white'
                                                        }}
                                                    >
                                                        <DeleteGigIcon />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                        </div>
                    )}
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

