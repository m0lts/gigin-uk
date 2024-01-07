import { FilterBar } from '/pages/Home/FilterBar/FilterBar.jsx'
import './list-view.styles.css'

export const ListView = () => {
    return (
        <section className='list-view'>
            <FilterBar />
            <h1>ListView</h1>
        </section>
    )
}