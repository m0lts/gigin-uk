import { Outlet } from "react-router-dom"
import { Header } from "../../components/Global/header/Header"
import './index.styles.css'

export const Index = () => {
    return (
        <div className="app">
            <Header />
            <main className='app-body'>
                <Outlet />
            </main>
        </div>
    )
}