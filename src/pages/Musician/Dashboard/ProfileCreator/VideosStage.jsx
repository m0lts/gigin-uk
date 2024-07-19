import { useEffect, useState } from "react";
import { CameraIcon, CloseIcon } from '/components/ui/Extras/Icons';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

const ItemType = 'VIDEO';

const DraggableVideo = ({ video, index, moveVideo, removeVideo }) => {
    const [, ref] = useDrag({
        type: ItemType,
        item: { index }
    });

    const [, drop] = useDrop({
        accept: ItemType,
        hover: (draggedItem) => {
            if (draggedItem.index !== index) {
                moveVideo(draggedItem.index, index);
                draggedItem.index = index;
            }
        }
    });

    return (
        <div
            ref={(node) => ref(drop(node))}
            className="preview-video-container"
        >
            <video
                width="200"
                controls
                className="preview-video"
            >
                <source src={typeof video === 'string' ? video : URL.createObjectURL(video)} type="video/mp4" />
                Your browser does not support the video tag.
            </video>
            <button className="remove-button" onClick={() => removeVideo(index)}>
                <CloseIcon />
            </button>
        </div>
    );
};

export const VideosStage = ({ data, onChange }) => {

    const [videos, setVideos] = useState(data || []);

    useEffect(() => {
        onChange('videos', videos);
    }, [videos]);

    const handleFileChange = (event) => {
        const files = Array.from(event.target.files);
        setVideos((prevVideos) => [...prevVideos, ...files]);
    };

    const handleDrop = (event) => {
        event.preventDefault();
        const files = Array.from(event.dataTransfer.files);
        setVideos((prevVideos) => [...prevVideos, ...files]);
    };

    const handleDragOver = (event) => {
        event.preventDefault();
    };

    const moveVideo = (fromIndex, toIndex) => {
        const updatedVideos = [...videos];
        const [movedVideo] = updatedVideos.splice(fromIndex, 1);
        updatedVideos.splice(toIndex, 0, movedVideo);
        setVideos(updatedVideos);
    };

    const removeVideo = (index) => {
        setVideos(videos.filter((_, i) => i !== index));
    };

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="stage videos">
                <h3>Stage 10: Videos</h3>
                <div className="video-space">
                    <div
                        className="upload"
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                    >
                        <input
                            type="file"
                            multiple
                            accept="video/*"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                            id="fileInput"
                        />
                        <label htmlFor="fileInput" className="upload-label">
                            <CameraIcon />
                            <span>Click or drag videos here to upload. Add at least 3 videos.</span>
                        </label>
                    </div>
                    <h6 className="input-label">Drag the videos to rearrange in order of their importance.</h6>
                    <div className="preview">
                        {videos.map((video, index) => (
                            <DraggableVideo
                                key={index}
                                video={video}
                                index={index}
                                moveVideo={moveVideo}
                                removeVideo={removeVideo}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </DndProvider>
    );
};