// Styles
    import './notifications-tile.styles.css'

export const NotificationsTile = () => {
    return (
        <div className='notifications-tile tile bckgrd-grey'>
            <h1 className='title'>Notifications</h1>
            <div className="notifications">
                <div className="notification">
                    <div className="dot"></div>
                    <p className="date">19/01/2024</p>
                    <p className='description'>You created the musician profile: Jazz Pianist.</p>
                    <button className="btn red-button">Delete</button>
                </div>
                <div className="notification">
                    <div className="dot"></div>
                    <p className="date">19/01/2024</p>
                    <p className='description'>You created the musician profile: Jazz Pianist.</p>
                    <button className="btn red-button">Delete</button>
                </div>
                <div className="notification">
                    <div className="dot"></div>
                    <p className="date">19/01/2024</p>
                    <p className='description'>You created the musician profile: Jazz Pianist.</p>
                    <button className="btn red-button">Delete</button>
                </div>
            </div>
        </div>
    )
}