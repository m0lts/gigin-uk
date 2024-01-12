import { FilterBar } from '/pages/Home/FilterBar/FilterBar.jsx'
import { GigPreview } from '/pages/Home/GigPreview/GigPreview.jsx'
import './list-view.styles.css'

export const ListView = ({ gigs }) => {
    return (
        <section className='list-view'>
            <FilterBar />
            <ul className="gig-list">
                {gigs.map((gig, index) => (
                    <li key={index} className="gig-preview">
                        <GigPreview 
                            gig={gig}
                        />
                    </li>
                ))}
            </ul>
        </section>
    )
}