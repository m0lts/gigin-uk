import { Link } from 'react-router-dom'
import { FilterBar } from '/pages/Home/FilterBar/FilterBar.jsx'
import { GigPreview } from '/pages/Home/GigPreview/GigPreview.jsx'
import './list-view.styles.css'

export const ListView = ({ gigs }) => {

    return (
        <section className='list-view'>
            <FilterBar />
            <div className="gig-list">
                {gigs.map((gig, index) => (
                    <Link to={`/${gig._id}`} state={gig} key={index} className="gig-preview link">
                        <GigPreview 
                            gig={gig}
                        />
                    </Link>
                ))}
            </div>
        </section>
    )
}