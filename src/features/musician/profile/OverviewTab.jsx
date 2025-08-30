import { useEffect, useState, useMemo } from 'react';
import { 
    BackgroundMusicIcon,
    ClubIcon,
    DotIcon,
    FacebookIcon,
    GuitarsIcon,
    InstagramIcon,
    MapIcon,
    PlayIcon,
    ShootingStarIcon,
    SoundcloudIcon,
    SpotifyIcon,
    TwitterIcon,
    YoutubeIcon } from '@features/shared/ui/extras/Icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faGuitar,
    faDrum,
    faPiano,
    faKeyboard,
    faSaxophone,
    faTrumpet,
    faFlute,
    faViolin,
    faMicrophone,
    faBanjo,
    faMandolin,
    faHeadphones,
    faLaptop,
    faMusic,
    faTurntable,
    faLightbulb
} from '@fortawesome/pro-light-svg-icons';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { EmptyIcon, PlayVideoIcon } from '../../shared/ui/extras/Icons';
import { ensureProtocol } from '../../../services/utils/misc';
  
  export const OverviewTab = ({ musicianData, viewingOwnProfile, setShowPreview, videoToPlay, setVideoToPlay, bandAdmin, setCurrentTrack }) => {
  
    const media = useMemo(() => {
      const imgs = (musicianData?.photos ?? []).map((src, i) => ({
        id: `img-${i}-${src}`,
        type: "image",
        src,
      }));
      const vids = (musicianData?.videos ?? []).slice(1).map((v, i) => ({
        id: `vid-${i}-${v.file}`,
        type: "video",
        file: v.file,
        poster: v.thumbnail || v.poster,
        date: v.date,
      }));
      const anyDates = vids.some(v => !!v.date);
      const merged = [...vids, ...imgs];
      return anyDates
        ? merged.sort((a, b) => (new Date(b.date || 0)) - (new Date(a.date || 0)))
        : merged;
    }, [musicianData]);

    const handlePlayTrack = (track) => {
      setCurrentTrack(track);
    };
  
    return (
      <div className="musician-profile-home">
        {(musicianData?.bio || musicianData?.videos?.length || musicianData?.tracks?.length) && (
          <div className="musician-profile-bio-buttons-container">
            {!!musicianData?.videos?.length ? (
              <figure className="showcase-video">
                <img src={musicianData.videos[0].thumbnail} alt={musicianData.videos[0].title} />
                <div className="showcase-video-details">
                  <h3>{musicianData.videos[0].title}</h3>
                  <p>{musicianData.videos[0].date}</p>
                </div>
                <button
                  className="btn icon"
                  onClick={() => setVideoToPlay(musicianData.videos[0])}
                >
                  <PlayIcon />
                </button>
              </figure>
            ) : (
              <div className="showcase-video empty-container">
                <EmptyIcon />
                <h4>No Video Uploaded</h4>
                {viewingOwnProfile && (
                  <button className="btn tertiary" onClick={() => setShowPreview(false)}>
                    Add Videos
                  </button>
                )}
              </div>
            )}
            <div className="artist-details">
              {!!musicianData?.bio?.text ? (
                <h4 className='bio-text'>{musicianData.bio.text}</h4>
              ) : (
                <div className="empty-container">
                  <EmptyIcon />
                  <h4>No Artist Bio</h4>
                  {viewingOwnProfile && (
                    <button className="btn tertiary" onClick={() => setShowPreview(false)}>
                      Add Bio
                    </button>
                  )}
              </div>
              )}
              <div className="interactive-buttons">
                {!!musicianData?.tracks?.length && (
                  <button
                    className="btn icon orange"
                    onClick={() => handlePlayTrack(musicianData.tracks[0])}
                  >
                    <PlayIcon />
                  </button>
                )}
                {musicianData?.socialMedia?.facebook && (
                    <a href={ensureProtocol(musicianData?.socialMedia?.facebook)} target='_blank' rel='noreferrer' className='btn icon'>
                        <FacebookIcon />
                    </a>
                )}
                {musicianData?.socialMedia?.instagram && (
                    <a href={ensureProtocol(musicianData?.socialMedia?.instagram)} target='_blank' rel='noreferrer' className='btn icon'>
                        <InstagramIcon />
                    </a>
                )}
                {musicianData?.socialMedia?.twitter && (
                    <a href={ensureProtocol(musicianData?.socialMedia?.twitter)} target='_blank' rel='noreferrer' className='btn icon'>
                        <TwitterIcon />
                    </a>
                )}
                {musicianData?.socialMedia?.spotify && (
                    <a href={ensureProtocol(musicianData?.socialMedia?.spotify)} target='_blank' rel='noreferrer' className='btn icon'>
                        <SpotifyIcon />
                    </a>
                )}
                {musicianData?.socialMedia?.soundcloud && (
                    <a href={ensureProtocol(musicianData?.socialMedia?.soundcloud)} target='_blank' rel='noreferrer' className='btn icon'>
                        <SoundcloudIcon />
                    </a>
                )}
                {musicianData?.socialMedia?.youtube && (
                    <a href={ensureProtocol(musicianData?.socialMedia?.youtube)} target='_blank' rel='noreferrer' className='btn icon'>
                        <YoutubeIcon />
                    </a>
                )}
              </div>
            </div>
          </div>
        )}
        {media.length ? (
          <div className="media-collage">
            {media.map(item => (
              <figure className="media-item" key={item.id}>
                {item.type === "image" ? (
                  <img
                    src={item.src}
                    alt="Musician media"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <button
                    type="button"
                    className="video-thumb"
                    onClick={() => setVideoToPlay(item)}
                    aria-label="Play video"
                  >
                    <video
                      src={item.file}
                      poster={item.poster}
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <PlayIcon />
                  </button>
                )}
              </figure>
            ))}
          </div>
        ) : (
          <div className="empty-container">
            <EmptyIcon />
            <h4>No Photos Uploaded</h4>
            {viewingOwnProfile && (
              <button className="btn tertiary" onClick={() => setShowPreview(false)}>
                Add Photos
              </button>
            )}
          </div>
        )}
    </div>
    );
  };