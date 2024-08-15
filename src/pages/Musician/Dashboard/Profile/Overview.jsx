import { BackgroundMusicIcon, DotIcon, FacebookIcon, InstagramIcon, LocationPinIcon, ShootingStarIcon, SoundcloudIcon, SpotifyIcon, TwitterIcon, YoutubeIcon } from "../../../../components/ui/Extras/Icons"

export const Overview = ({musicianData}) => {

    return (
        <div className="overview">
            <div className="overview-top">
                <div className="info-box">
                    <h2>Watch</h2>
                    <div className="box-style video">
                        {musicianData.videos && musicianData.videos.length > 0 ? (
                            <div>
                                <video width="100%" controls>
                                    <source src={musicianData.videos[0].url} type="video/mp4" />
                                    Your browser does not support the video tag.
                                </video>
                                <p className="title">{musicianData.videos[0].title}</p>
                            </div>
                        ) : (
                            <p>No video available</p>
                        )}
                    </div>
                </div>
                <div className="info-box">
                    <h2>Bio</h2>
                    <div className="box-style text">
                        <p>{musicianData.bio.text}</p>
                    </div>
                </div>
            </div>
            <div className="overview-middle box-style">
                <h6 className="data">
                    <LocationPinIcon /> {musicianData.location.city} <DotIcon /> {musicianData.location.travelDistance}
                </h6>
                <h6 className="data">
                    <BackgroundMusicIcon /> {musicianData.musicType}
                </h6>
                <h6 className="data">
                    <ShootingStarIcon />
                    {musicianData.bio.experience === 'less than 1 year' ? (
                        <>Up and Comer</>
                    ) : musicianData.bio.experience === '1-2 years' ? (
                        <>Rising Star</>
                    ) : musicianData.bio.experience === '2-5 years' ? (
                        <>Seasoned Performer</>
                    ) : musicianData.bio.experience === '5+ years' && (
                        <>Veteran Performer</>
                    )}
                </h6>
            </div>
            <div className="overview-bottom">
                <div className="social-media-links list">
                    {musicianData.socialMedia.facebook && (
                            <a className="link" href={musicianData.socialMedia.facebook} target="_blank" rel="noopener noreferrer">
                                <FacebookIcon /> Facebook
                            </a>
                    )}
                    {musicianData.socialMedia.instagram && (
                            <a className="link" href={musicianData.socialMedia.instagram} target="_blank" rel="noopener noreferrer">
                                <InstagramIcon /> Instagram
                            </a>
                    )}
                    {musicianData.socialMedia.twitter && (
                            <a className="link" href={musicianData.socialMedia.twitter} target="_blank" rel="noopener noreferrer">
                                <TwitterIcon /> X
                            </a>
                    )}
                    {musicianData.socialMedia.spotify && (
                            <a className="link" href={musicianData.socialMedia.spotify} target="_blank" rel="noopener noreferrer">
                                <SpotifyIcon /> Spotify
                            </a>
                    )}
                    {musicianData.socialMedia.youtube && (
                            <a className="link" href={musicianData.socialMedia.youtube} target="_blank" rel="noopener noreferrer">
                                <YoutubeIcon /> Youtube
                            </a>
                    )}
                    {musicianData.socialMedia.soundcloud && (
                            <a className="link" href={musicianData.socialMedia.soundcloud} target="_blank" rel="noopener noreferrer">
                                <SoundcloudIcon /> SoundCloud
                            </a>
                    )}
                </div>
                <div className="info-box">
                    <h2>Sound</h2>
                    <ul className="box-style list">
                        {musicianData.instruments.map((instrument, index) => (
                            <li className="sound-item" key={index}>
                                {instrument}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    )
}