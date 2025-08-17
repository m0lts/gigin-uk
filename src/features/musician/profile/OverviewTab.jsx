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
import { EmptyIcon } from '../../shared/ui/extras/Icons';
  
  export const OverviewTab = ({ musicianData, viewingOwnProfile, setShowPreview, videoToPlay, setVideoToPlay }) => {
  
    const media = useMemo(() => {
      const imgs = (musicianData?.photos ?? []).map((src, i) => ({
        id: `img-${i}-${src}`,
        type: "image",
        src,
      }));
      const vids = (musicianData?.videos ?? []).map((v, i) => ({
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
  
    if (!media.length) {
      return (
        <div className="nothing-to-display">
            <EmptyIcon />
            {viewingOwnProfile ? (
                <>
                    <h4>More information will show here when you complete your profile.</h4>
                    <button className="btn primary" onClick={() => setShowPreview(false)}>
                        Finish Profile
                    </button>
                </>
            ) : (
                <>
                    <h4>No more information to show.</h4>
                </>
            )}
        </div>
      )
    }
  
    return (
      <div className="musician-profile-home">
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
        </div>
    );
  };