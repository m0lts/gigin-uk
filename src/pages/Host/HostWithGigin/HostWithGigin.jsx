// Components
    import { HostLiveMusicHeader } from '/components/Header/Header';

// Styles and images
    import HostWithGiginPhoto from '/assets/images/host-with-gigin-photo.png';
    import './host-with-gigin.styles.css'

export const HostWithGigin = () => {
    return (
        <section className="host-with-gigin">
            <HostLiveMusicHeader />
            <div className="hero">
                <div className="left">
                    <h1 className="title">
                        Hassle-free
                        <br />
                         live music 
                        <br />
                        with 
                        <span className='text-gradient'> Gigin.</span>
                    </h1>
                </div>
                <div className="right">
                    <img src={HostWithGiginPhoto} alt="" />
                </div>
            </div>
        </section>
    )
}