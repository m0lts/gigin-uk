import { Header } from "../components/common/Header"

export const MusicianLayout = ({ children }) => {
    return (
        <section className="musician-layout" style={{ minHeight: '100vh' }}>
            <Header />
            <main style={{ height: '100%' }}>{children}</main>
        </section>
    )
}