import { Footer } from "../components/common/Footer"
import { MusicianHeader } from "../components/common/Header"

export const MusicianLayout = ({ children }) => {
    return (
        <>
            <MusicianHeader />
            <main>{children}</main>
            <Footer />
        </>
    )
}