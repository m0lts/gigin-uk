import { useEffect, useState } from 'react'
import { MusicianTypeInput, GenresInput, GigDurationInput, GigExtraInformation, GigStartTimeInput, MusicTypeInput, MusicianArrivalTimeInput, GigFeeInput } from "/pages/GigBuilder/GigDetails/Inputs/GigDetails.inputs"
import './gig-details.styles.css'


export const GigDetails = ({ gigDetails, setGigDetails }) => {

    const [musicianType, setMusicianType] = useState(gigDetails.musicianType ? gigDetails.musicianType : undefined);
    const [musicType, setMusicType] = useState(gigDetails.musicType ? gigDetails.musicType : undefined);
    const [genres, setGenres] = useState(gigDetails.genres ? gigDetails.genres : undefined);
    const [gigStartTime, setGigStartTime] = useState(gigDetails.gigStartTime ? gigDetails.gigStartTime : undefined);
    const [gigDuration, setGigDuration] = useState(gigDetails.gigDuration ? gigDetails.gigDuration : undefined);
    const [musicianArrivalTime, setMusicianArrivalTime] = useState(gigDetails.musicianArrivalTime ? gigDetails.musicianArrivalTime : undefined);
    const [gigFee, setGigFee] = useState(gigDetails.gigFee ? gigDetails.gigFee : undefined);
    const [extraInformation, setExtraInformation] = useState(gigDetails.extraInformation ? gigDetails.extraInformation : undefined);

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

    console.log(gigDetails)

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
            <GigFeeInput 
                gigFee={gigFee}
                setGigFee={setGigFee}
            />
            <GigExtraInformation
                extraInformation={extraInformation}
                setExtraInformation={setExtraInformation}
            />
        </div>
    )
}