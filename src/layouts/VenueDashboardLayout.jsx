import { useEffect } from 'react';
import { Header } from '@features/venue/components/Header'
import { useAuth } from '@hooks/useAuth'
import '@styles/shared/dashboard.styles.css'
import { useNavigate } from 'react-router-dom';

// export const VenueDashboardLayout = ({ children, setAuthModal, setAuthType, user, setAuthClosable }) => {

//     const { loading } = useAuth();
//     const navigate = useNavigate();

//     useEffect(() => {
//         if (!loading && !user) {
//             setAuthModal(true);
//             setAuthClosable(false);
//         }

//         if (user && !user.venueProfiles) {
//             navigate('/venues/add-venue')
//         }

//     }, [user])

//     return (
//         <section className='dashboard'>
//             <Header 
//                 setAuthType={setAuthType}
//                 setAuthModal={setAuthModal}
//                 user={user}
//             />
//             <main className='main'>
//                 { children }
//             </main>
//         </section>
//     )
// }

export const VenueDashboardLayout = ({ children, setAuthModal, setAuthType, user, setAuthClosable }) => {

    const { loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && !user) {
            setAuthModal(true);
            setAuthClosable(false);
        }

        if (user && !user.venueProfiles) {
            navigate('/venues/add-venue')
        }

    }, [user])

    return (
        <section className='dashboard'>
            { children }
        </section>
    )
}