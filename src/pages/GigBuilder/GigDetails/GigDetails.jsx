import { useEffect, useState } from 'react'
import { MusicianTypeInput, GenresInput, GigDurationInput, GigExtraInformation, GigStartTimeInput, MusicTypeInput, MusicianArrivalTimeInput, GigFeeInput } from "/pages/GigBuilder/GigDetails/Inputs/GigDetails.inputs"
import './gig-details.styles.css'


export const GigDetails = ({ gigDetails, setGigDetails }) => {

    const [musicianType, setMusicianType] = useState();
    const [musicType, setMusicType] = useState();
    const [genres, setGenres] = useState();
    const [gigStartTime, setGigStartTime] = useState();
    const [gigDuration, setGigDuration] = useState();
    const [musicianArrivalTime, setMusicianArrivalTime] = useState();
    const [gigFee, setGigFee] = useState();
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
            ...(gigFee && { gigFee: gigFee }),
            ...(extraInformation && { extraInformation: extraInformation })
        }
        setGigDetails(updatedGigDetails);
    }, [musicianType, musicType, genres, gigStartTime, gigDuration, musicianArrivalTime, gigFee, extraInformation])


    return (
        <div className="fields">
            <MusicianTypeInput
                musicianType={musicianType}
                setMusicianType={setMusicianType}
                gigDetails={gigDetails}
            />
            <MusicTypeInput
                musicType={musicType}
                setMusicType={setMusicType}
                gigDetails={gigDetails}
            />
            <GenresInput
                genres={genres}
                setGenres={setGenres}
                gigDetails={gigDetails}
            />
            <GigStartTimeInput
                gigStartTime={gigStartTime}
                setGigStartTime={setGigStartTime}
                gigDetails={gigDetails}
            />
            <GigDurationInput
                gigDuration={gigDuration}
                setGigDuration={setGigDuration}
                gigDetails={gigDetails}
            />
            <MusicianArrivalTimeInput
                musicianArrivalTime={musicianArrivalTime}
                setMusicianArrivalTime={setMusicianArrivalTime}
                gigDetails={gigDetails}
            />
            <GigFeeInput 
                gigFee={gigFee}
                setGigFee={setGigFee}
                gigDetails={gigDetails}
            />
            <GigExtraInformation
                extraInformation={extraInformation}
                setExtraInformation={setExtraInformation}
                gigDetails={gigDetails}
            />
        </div>
    )
}