import { FilterBar } from '/pages/Home/FilterBar/home.filter-bar.jsx'
import './home.list-view.styles.css'

export const ListView = () => {
    return (
        <section className='list-view'>
            <FilterBar />
            <h1>ListView</h1>
        </section>
    )
}