import { useEffect, useState } from "react";
import { CloseIcon } from '/components/ui/Extras/Icons';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { BackgroundMusicIcon } from "../../../../components/ui/Extras/Icons";

const ItemType = 'TRACK';

const DraggableTrack = ({ track, index, moveTrack, removeTrack }) => {
    const [, ref] = useDrag({
        type: ItemType,
        item: { index }
    });

    const [, drop] = useDrop({
        accept: ItemType,
        hover: (draggedItem) => {
            if (draggedItem.index !== index) {
                moveTrack(draggedItem.index, index);
                draggedItem.index = index;
            }
        }
    });

    return (
        <div
            ref={(node) => ref(drop(node))}
            className="preview-track-container"
        >
            <audio controls className="preview-track">
                <source src={typeof track === 'string' ? track : URL.createObjectURL(track)} type="audio/mp3" />
                Your browser does not support the audio element.
            </audio>
            <button className="remove-button" onClick={() => removeTrack(index)}>
                <CloseIcon />
            </button>
        </div>
    );
};

export const TracksStage = ({ data, onChange }) => {
    const [tracks, setTracks] = useState(data || []);

    useEffect(() => {
        onChange('tracks', tracks);
    }, [tracks]);

    const handleFileChange = (event) => {
        const files = Array.from(event.target.files);
        setTracks((prevTracks) => [...prevTracks, ...files]);
    };

    const handleDrop = (event) => {
        event.preventDefault();
        const files = Array.from(event.dataTransfer.files);
        setTracks((prevTracks) => [...prevTracks, ...files]);
    };

    const handleDragOver = (event) => {
        event.preventDefault();
    };


    const moveTrack = (fromIndex, toIndex) => {
        const updatedTracks = [...tracks];
        const [movedTrack] = updatedTracks.splice(fromIndex, 1);
        updatedTracks.splice(toIndex, 0, movedTrack);
        setTracks(updatedTracks);
    };

    const removeTrack = (index) => {
        setTracks(tracks.filter((_, i) => i !== index));
    };

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="stage tracks">
                <h3>Stage 11: Tracks</h3>
                <div className="track-space">
                    <div
                        className="upload"
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                    >
                        <input
                            type="file"
                            multiple
                            accept="audio/*"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                            id="fileInput"
                        />
                        <label htmlFor="fileInput" className="upload-label">
                            <BackgroundMusicIcon />
                            <span>Click or drag tracks here to upload. Add at least 3 tracks.</span>
                        </label>
                    </div>
                    <h6 className="input-label">Drag the tracks to rearrange in order of their importance.</h6>
                    <div className="preview">
                        {tracks.map((track, index) => (
                            <DraggableTrack
                                key={index}
                                track={track}
                                index={index}
                                moveTrack={moveTrack}
                                removeTrack={removeTrack}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </DndProvider>
    );
};