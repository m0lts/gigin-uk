import { CalendarIcon, CardIcon, ClockIcon, CoinsIcon, DoorIcon, DownChevronIcon, GuitarsIcon, HouseIcon, InvoiceIcon, PlusIcon, PreviousIcon, TelescopeIcon, TickIcon } from "../../../components/ui/Icons/Icons"


export const Sidebar = () => {
    return (
        <div className="sidebar">
            <button className="btn primary">
                <PlusIcon />
                Post a Gig
            </button>
            <ul className="menu">
                <li className="menu-item">
                    <HouseIcon />
                    Overview
                </li>
            </ul>
            <hr className="break" />
            <ul className="menu">
                <li className="title">gigs</li>
                <li className="menu-item expandable">
                    <CalendarIcon />
                    All gigs
                    <span className="sub"><DownChevronIcon /></span>
                </li>
                <li className="menu-item sub">
                    <span className="sub" style={{ color: 'green' }}><TickIcon /></span>
                    Confirmed
                </li>
                <li className="menu-item sub ">
                    <span className="sub" style={{ color: 'var(--gigin-orange)' }}><ClockIcon /></span>
                    Upcoming
                </li>
                <li className="menu-item sub">
                    <span className="sub" style={{ color: 'var(--medium-grey)' }}><PreviousIcon /></span>
                    Previous
                </li>
            </ul>
            <hr className="break" />
            <ul className="menu">
                <li className="title">venues</li>
                <li className="menu-item">
                    <DoorIcon />
                    My Venues
                </li>
                <li className="menu-item">
                    <PlusIcon />
                    New Venue
                </li>
            </ul>
            <hr className="break" />
            <ul className="menu">
                <li className="title">musicians</li>
                <li className="menu-item">
                    <GuitarsIcon />
                    Saved Musicians
                </li>
                <li className="menu-item">
                    <TelescopeIcon />
                    Find Musicians
                </li>
            </ul>
            <hr className="break" />
            <ul className="menu">
                <li className="title">financials</li>
                <li className="menu-item">
                    <CoinsIcon />
                    Gig Expenditure
                </li>
                <li className="menu-item">
                    <CardIcon />
                    Card Details
                </li>
                <li className="menu-item">
                    <InvoiceIcon />
                    Invoices
                </li>
            </ul>
        </div>
    )
}