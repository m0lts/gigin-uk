import { useEffect, useState } from 'react'
import { MusicianTypeInput, GenresInput, GigDurationInput, GigExtraInformation, GigStartTimeInput, MusicTypeInput, MusicianArrivalTimeInput } from "./Inputs/GigDetails.inputs"
import './gig-details.styles.css'


export const GigDetails = ({ gigDetails, setGigDetails }) => {

    const [musicianType, setMusicianType] = useState();
    const [musicType, setMusicType] = useState();
    const [genres, setGenres] = useState();
    const [gigStartTime, setGigStartTime] = useState();
    const [gigDuration, setGigDuration] = useState();
    const [musicianArrivalTime, setMusicianArrivalTime] = useState();
    const [extraInformation, setExtraInformation] = useState();

    useEffect(() => {
        const updatedGigDetails = {
            ...gigDetails,
            ...(musicianType && { musicianType: musicianType }),
            ...(musicType && { musicType: musicType }),
            ...(genres && { genres: genres }),
            ...(gigStartTime && { gigStartTime: gigStartTime }),
            ...(gigDuration && { gigDuration: gigDuration }),
            ...(musicianArrivalTime && { musicianArrivalTime: musicianArrivalTime }),
            ...(extraInformation && { extraInformation: extraInformation })
        }
        setGigDetails(updatedGigDetails);
    }, [musicianType, musicType, genres, gigStartTime, gigDuration, musicianArrivalTime, extraInformation])

    return (
        <div className="fields">
            <MusicianTypeInput
                musicianType={musicianType}
                setMusicianType={setMusicianType}
            />
            <MusicTypeInput
                musicType={musicType}
                setMusicType={setMusicType}
            />
            <GenresInput
                genres={genres}
                setGenres={setGenres}
            />
            <GigStartTimeInput
                gigStartTime={gigStartTime}
                setGigStartTime={setGigStartTime}
            />
            <GigDurationInput
                gigDuration={gigDuration}
                setGigDuration={setGigDuration}
            />
            <MusicianArrivalTimeInput
                musicianArrivalTime={musicianArrivalTime}
                setMusicianArrivalTime={setMusicianArrivalTime}
            />
            <GigExtraInformation
                extraInformation={extraInformation}
                setExtraInformation={setExtraInformation}
            />
        </div>
    )
}