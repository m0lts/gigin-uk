import { Route, Routes, useLocation, Link } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import React, { useState, useEffect, useMemo } from 'react'
import { GigPostModal } from '../gig-post/GigPostModal';
import { useAuth } from '@hooks/useAuth';
import { LoadingScreen } from '@features/shared/ui/loading/LoadingScreen';
import { Gigs } from './Gigs';
import '@styles/host/host-dashboard.styles.css'
import { Venues } from './Venues';
import { GigApplications } from './GigApplications';
import { useGigs } from '@context/GigsContext';
import { Overview } from './Overview';
import { Finances } from './Finances';
import { SavedMusicians } from './SavedMusicians';
import { FindMusicians } from './FindMusicians';
import { ReviewModal } from '@features/shared/components/ReviewModal';
import { WelcomeModal } from '@features/musician/components/WelcomeModal';
import { listenToTemplatesByVenueIds } from '@services/venues';
import { fetchCustomerData } from '@services/functions';
import { getBreadcrumbs } from '@services/utils/breadcrumbs';
import { getPendingGigsToReview } from '@services/utils/filtering';
import { RightChevronIcon } from '../../shared/ui/extras/Icons';
import { useVenueDashboard } from '@context/VenueDashboardContext';
import { getUnreviewedPastGigs } from '../../../services/utils/filtering';

export const VenueDashboard = ({ user }) => {
    const {
      loading,
      venueProfiles,
      gigs,
      incompleteGigs,
      templates,
      stripe: { customerDetails, savedCards, receipts },
      refreshData,
      refreshGigs,
      refreshTemplates,
      refreshStripe
    } = useVenueDashboard();
  
    const [gigPostModal, setGigPostModal] = useState(false);
    const [editGigData, setEditGigData] = useState();
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [gigToReview, setGigToReview] = useState(null);
    const [gigsToReview, setGigsToReview] = useState([]);
    const location = useLocation();
    const breadcrumbs = useMemo(() => getBreadcrumbs(location.pathname), [location.pathname]);
  
    useEffect(() => {
      if (location.state?.newUser) setShowWelcomeModal(true);
    }, [location]);
  
    useEffect(() => {
        const localGigsToReview = getPendingGigsToReview(gigs);
        const unreviewedGigs = getUnreviewedPastGigs(gigs);
        if (localGigsToReview.length > 0) {
          setGigToReview(localGigsToReview[0]);
          setGigsToReview(unreviewedGigs);
          setShowReviewModal(true);
        }
      }, [gigs]);

    return (
        <>  
            {loading && <LoadingScreen />}
            <Sidebar
              setGigPostModal={setGigPostModal}
              user={user}
            />
            <div className='window venue'>
                {location.pathname !== '/venues/dashboard' && (
                    <div className="breadcrumbs">
                        {breadcrumbs.map((crumb, index) => (
                            <React.Fragment key={crumb.path}>
                            <div className="breadcrumb">
                                {index !== breadcrumbs.length - 1 ? (
                                <Link to={crumb.path} className='breadcrumb-link'>{crumb.label}</Link>
                                ) : (
                                <p className='breadcrumb-text'>{crumb.label}</p>
                                )}
                            </div>
                            {index !== breadcrumbs.length - 1 && (
                                <div className="breadcrumb-separator">
                                <RightChevronIcon />
                                </div>
                            )}
                            </React.Fragment>
                        ))}
                    </div>
                )}
                <div className="output">
                    <Routes>
                        <Route index element={<Overview gigs={gigs} loadingGigs={loading} venues={venueProfiles} setGigPostModal={setGigPostModal} user={user} gigsToReview={gigsToReview} />} />
                        <Route path='gigs' element={<Gigs gigs={gigs} venues={venueProfiles} setGigPostModal={setGigPostModal} setEditGigData={setEditGigData} />} />
                        <Route path='gigs/gig-applications' element={<GigApplications setGigPostModal={setGigPostModal} setEditGigData={setEditGigData} />} />
                        <Route path='my-venues' element={<Venues venues={venueProfiles} />} />
                        <Route path='musicians' element={<SavedMusicians user={user} />} />
                        <Route path='musicians/find' element={<FindMusicians user={user} />} />
                        <Route path='finances' element={<Finances savedCards={savedCards} receipts={receipts} customerDetails={customerDetails} venues={venueProfiles} />} />
                    </Routes>
                </div>
            </div>
            {gigPostModal && 
              <GigPostModal 
                setGigPostModal={setGigPostModal} 
                venueProfiles={venueProfiles} 
                user={user} 
                templates={templates} 
                incompleteGigs={incompleteGigs} 
                editGigData={editGigData}
              />
            }
            {showReviewModal && 
                <ReviewModal
                    gigData={gigToReview}
                    reviewer='venue'
                    onClose={() => {
                        setShowReviewModal(false);
                        localStorage.setItem(`reviewedGig-${gigToReview.gigId}`, 'true');
                    }}
                />
            }
            {showWelcomeModal && (
                <WelcomeModal
                    user={user}
                    setShowWelcomeModal={setShowWelcomeModal}
                    role='venue'
                />
            )}
        </>
    )
}