import { Footer } from '@features/shared/components/Footer'
import { Header } from '@features/shared/components/Header'

export const GigGoerLayout = ({ children }) => {
    return (
        <>
            <Header />
            <main>{children}</main>
            <Footer />
        </>
    )
}