import { useState } from "react"
import { CalendarIcon, CardIcon, ClockIcon, CoinsIcon, DoorIcon, DownChevronIcon, GuitarsIcon, HouseIcon, InvoiceIcon, LightBulbIcon, PlusIcon, PreviousIcon, TelescopeIcon, TickIcon } from "/components/ui/Icons/Icons"
import { useLocation, useNavigate } from "react-router-dom";


export const Sidebar = ({ setGigPostModal }) => {

    const navigate = useNavigate();
    const location = useLocation();

    const [showSubOptions, setShowSubOptions] = useState(true);

    return (
        <div className="sidebar">
            <button className="btn primary" onClick={() => setGigPostModal(true)}>
                <PlusIcon />
                Post a Gig
            </button>
            <ul className="menu">
                <li className={`menu-item ${location.pathname === '/host/dashboard' && 'active'}`} onClick={() => navigate('/host/dashboard')}>
                    <HouseIcon />
                    Overview
                </li>
            </ul>
            <ul className="menu">
                <li className="title">gigs</li>
                <li className={`menu-item expandable ${location.pathname === '/host/dashboard/gigs' && 'active'}`} onClick={() => navigate('/host/dashboard/gigs')}>
                    <CalendarIcon />
                    All gigs
                    <span className="sub" onClick={() => setShowSubOptions(!showSubOptions)} style={{ transform: showSubOptions ? 'rotate(180deg)' : 'rotate(0deg)' }}><DownChevronIcon /></span>
                </li>
                {showSubOptions && (
                    <>
                        <li className="menu-item sub" onClick={() => navigate('/host/dashboard/gigs?status=confirmed')}>
                            <span className="sub" style={{ color: 'green' }}><TickIcon /></span>
                            Confirmed
                        </li>
                        <li className="menu-item sub" onClick={() => navigate('/host/dashboard/gigs?status=upcoming')}>
                            <span className="sub" style={{ color: 'orange' }}><ClockIcon /></span>
                            Upcoming
                        </li>
                        <li className="menu-item sub" onClick={() => navigate('/host/dashboard/gigs?status=previous')}>
                            <span className="sub" style={{ color: 'var(--medium-grey)' }}><PreviousIcon /></span>
                            Previous
                        </li>
                    </>
                )}
            </ul>
            <ul className="menu">
                <li className="title">venues</li>
                <li className={`menu-item ${location.pathname === '/host/dashboard/venues' && 'active'}`} onClick={() => navigate('/host/dashboard/venues')}>
                    <DoorIcon />
                    My Venues
                </li>
                <li className={`menu-item`} onClick={() => navigate('/host/venue-builder')}>
                    <PlusIcon />
                    New Venue
                </li>
            </ul>
            <ul className="menu">
                <li className="title">musicians</li>
                <li className={`menu-item ${location.pathname === '/host/dashboard/musicians' && 'active'}`} onClick={() => navigate('/host/dashboard/musicians')}>
                    <GuitarsIcon />
                    Saved Musicians
                </li>
                <li className={`menu-item ${location.pathname === '/host/dashboard/musicians' && 'active'}`} onClick={() => navigate('/host/dashboard/musicians')}>
                    <TelescopeIcon />
                    Find Musicians
                </li>
            </ul>
            <ul className="menu">
                <li className="title">finances</li>
                <li className={`menu-item ${location.pathname === '/host/dashboard/finances' && 'active'}`} onClick={() => navigate('/host/dashboard/finances')}>
                    <CoinsIcon />
                    Gig Expenditure
                </li>
                <li className={`menu-item ${location.pathname === '/host/dashboard/finances' && 'active'}`} onClick={() => navigate('/host/dashboard/finances')}>
                    <CardIcon />
                    Card Details
                </li>
                <li className={`menu-item ${location.pathname === '/host/dashboard/finances' && 'active'}`} onClick={() => navigate('/host/dashboard/finances')}>
                    <InvoiceIcon />
                    Invoices
                </li>
            </ul>
                <div className="feedback-box">
                    <LightBulbIcon />
                    <h5>Tell us your ideas!</h5>
                    <p>Our mission is to make booking live music simple, fast and secure. If you notice areas for improvement, please let us know!</p>
                </div>
        </div>
    )
}