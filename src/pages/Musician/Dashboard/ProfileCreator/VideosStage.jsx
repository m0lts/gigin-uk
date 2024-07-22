import { useEffect, useState } from "react";
import { CameraIcon, CloseIcon } from '/components/ui/Extras/Icons';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { EditIcon, PlusIcon, VideoIcon, LeftChevronIcon, RightChevronIcon } from "../../../../components/ui/Extras/Icons";

// const ItemType = 'VIDEO';

// const DraggableVideo = ({ video, index, moveVideo, removeVideo }) => {
//     const [, ref] = useDrag({
//         type: ItemType,
//         item: { index }
//     });

//     const [, drop] = useDrop({
//         accept: ItemType,
//         hover: (draggedItem) => {
//             if (draggedItem.index !== index) {
//                 moveVideo(draggedItem.index, index);
//                 draggedItem.index = index;
//             }
//         }
//     });

//     return (
//         <div
//             ref={(node) => ref(drop(node))}
//             className="preview-video-container"
//         >
//             <video
//                 width="200"
//                 controls
//                 className="preview-video"
//             >
//                 <source src={typeof video === 'string' ? video : URL.createObjectURL(video)} type="video/mp4" />
//                 Your browser does not support the video tag.
//             </video>
//             <button className="btn icon remove-button" onClick={() => removeVideo(index)}>
//                 <CloseIcon />
//             </button>
//         </div>
//     );
// };

// export const VideosStage = ({ data, onChange }) => {
//     const [videos, setVideos] = useState(data || []);

//     useEffect(() => {
//         onChange('videos', videos);
//     }, [videos]);

//     const handleFileChange = (event) => {
//         const files = Array.from(event.target.files);
//         setVideos((prevVideos) => [...prevVideos, ...files]);
//     };

//     const handleDrop = (event) => {
//         event.preventDefault();
//         const files = Array.from(event.dataTransfer.files);
//         setVideos((prevVideos) => [...prevVideos, ...files]);
//     };

//     const handleDragOver = (event) => {
//         event.preventDefault();
//     };

//     const moveVideo = (fromIndex, toIndex) => {
//         const updatedVideos = [...videos];
//         const [movedVideo] = updatedVideos.splice(fromIndex, 1);
//         updatedVideos.splice(toIndex, 0, movedVideo);
//         setVideos(updatedVideos);
//     };

//     const removeVideo = (index) => {
//         setVideos(videos.filter((_, i) => i !== index));
//     };

//     return (
//         <DndProvider backend={HTML5Backend}>
//             <div className="stage videos">
//                 <h3 className="section-title">Content</h3>
//                 <div className="video-space body">
//                     <h1>Upload some of your best footage.</h1>
//                     <div
//                         className="upload"
//                         onDrop={handleDrop}
//                         onDragOver={handleDragOver}
//                     >
//                         <input
//                             type="file"
//                             multiple
//                             accept="video/*"
//                             onChange={handleFileChange}
//                             style={{ display: 'none' }}
//                             id="fileInput"
//                         />
//                         <label htmlFor="fileInput" className="upload-label">
//                             <CameraIcon />
//                             <span>Click or drag videos here to upload.</span>
//                         </label>
//                     </div>
//                     <h6 className="input-label">Drag the videos to rearrange in order of their importance.</h6>
//                     <div className="preview">
//                         {videos.map((video, index) => (
//                             <DraggableVideo
//                                 key={index}
//                                 video={video}
//                                 index={index}
//                                 moveVideo={moveVideo}
//                                 removeVideo={removeVideo}
//                             />
//                         ))}
//                     </div>
//                 </div>
//             </div>
//         </DndProvider>
//     );
// };

export const VideosStage = ({ data, onChange }) => {
    const [videos, setVideos] = useState(data || []);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        onChange('videos', videos);
    }, [videos]);

    const handleFileChange = (event) => {
        const files = Array.from(event.target.files).map(file => ({
            file,
            title: file.name,
            date: new Date(file.lastModified).toISOString().split('T')[0]
        }));
        setVideos((prevVideos) => [...prevVideos, ...files]);
    };

    const handleTitleChange = (index, newTitle) => {
        setVideos((prevVideos) =>
            prevVideos.map((video, i) =>
                i === index ? { ...video, title: newTitle } : video
            )
        );
    };

    const handleDateChange = (index, newDate) => {
        setVideos((prevVideos) =>
            prevVideos.map((video, i) =>
                i === index ? { ...video, date: newDate } : video
            )
        );
    };

    console.log(data)

    const removeVideo = (index) => {
        setVideos((prevVideos) => {
            const newVideos = prevVideos.filter((_, i) => i !== index);
            if (currentIndex >= newVideos.length) {
                setCurrentIndex(Math.max(currentIndex - 1, 0));
            }
            return newVideos;
        });
    };

    const handlePrev = () => {
        setCurrentIndex((prevIndex) => Math.max(prevIndex - 1, 0));
    };

    const handleNext = () => {
        setCurrentIndex((prevIndex) => Math.min(prevIndex + 1, videos.length - 1));
    };

    return (
        <div className="stage videos">
            <h3 className="section-title">Content</h3>
            <div className="body">
                <h1>Upload some of your best footage.</h1>
                <div className="upload">
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
                        <span>Upload videos here.</span>
                    </label>
                </div>
                {videos.length > 0 && (
                    <div className="carousel-container">
                        <div className="carousel">
                            <div className="carousel-item" key={currentIndex}>
                                <div className="video-container">
                                    <video controls>
                                        <source src={typeof videos[currentIndex].file === 'string' ? videos[currentIndex].file : URL.createObjectURL(videos[currentIndex].file)} type="video/mp4" />
                                        Your browser does not support the video tag.
                                    </video>
                                </div>
                                <div className="form">
                                    <div className="input-group">
                                        <label htmlFor="title">Title</label>
                                        <input
                                            type="text"
                                            id="title"
                                            className="input"
                                            value={videos[currentIndex].title}
                                            onChange={(e) => handleTitleChange(currentIndex, e.target.value)}
                                            placeholder="Title"
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label htmlFor="date">Date</label>
                                        <input
                                            type="date"
                                            id="date"
                                            className="input"
                                            value={videos[currentIndex].date}
                                            onChange={(e) => handleDateChange(currentIndex, e.target.value)}
                                        />
                                    </div>
                                </div>
                                <button className="btn icon remove-button" onClick={() => removeVideo(currentIndex)}>
                                    <CloseIcon />
                                </button>
                            </div>
                        </div>
                        <div className="carousel-controls">
                            <button className="btn icon" onClick={handlePrev} disabled={currentIndex === 0}>
                                <LeftChevronIcon />
                            </button>
                            <button className="btn icon" onClick={handleNext} disabled={currentIndex === videos.length - 1}>
                                <RightChevronIcon />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};