import { EllipsisVerticleIcon } from "../../../../components/Icons/Icons"
import { useState } from "react"
import { AddVenueModal } from "./AddVenueModal";

export const VenuesTab = () => {

    const [addVenueModal, setAddVenueModal] = useState(false);

    return (
        <div className="venues-tab tab">
            <div className="tab-banner">
                <h3 className="title">Venues</h3>
                <button className="btn btn-black" onClick={() => setAddVenueModal(true)}>
                    Add Venue
                </button>
            </div>
            {addVenueModal && <AddVenueModal addVenueModal={addVenueModal} setAddVenueModal={setAddVenueModal} />}
            <div className="tab-content">
                <div className="card">
                    <div className="left">
                        <h4 className="title">The Old Blue Last</h4>
                        <p className="address">38 Great Eastern St, Hackney, London EC2A 3ES</p>
                        <p className="description">The Old Blue Last is a pub and live music venue in Shoreditch, East London. It is the first pub on the left as you come out of Old Street Station.</p>
                    </div>
                    <div className="right">
                        <button className="btn btn-icon"><EllipsisVerticleIcon /></button>
                    </div>
                </div>
                <div className="card">
                    <div className="left">
                        <h4 className="title">The Old Blue Last</h4>
                        <p className="address">38 Great Eastern St, Hackney, London EC2A 3ES</p>
                        <p className="description">The Old Blue Last is a pub and live music venue in Shoreditch, East London. It is the first pub on the left as you come out of Old Street Station.</p>
                    </div>
                    <div className="right">
                        <button className="btn btn-icon"><EllipsisVerticleIcon /></button>
                    </div>
                </div>
                <div className="card">
                    <div className="left">
                        <h4 className="title">The Old Blue Last</h4>
                        <p className="address">38 Great Eastern St, Hackney, London EC2A 3ES</p>
                        <p className="description">The Old Blue Last is a pub and live music venue in Shoreditch, East London. It is the first pub on the left as you come out of Old Street Station.</p>
                    </div>
                    <div className="right">
                        <button className="btn btn-icon"><EllipsisVerticleIcon /></button>
                    </div>
                </div>
                <div className="card">
                    <div className="left">
                        <h4 className="title">The Old Blue Last</h4>
                        <p className="address">38 Great Eastern St, Hackney, London EC2A 3ES</p>
                        <p className="description">The Old Blue Last is a pub and live music venue in Shoreditch, East London. It is the first pub on the left as you come out of Old Street Station.</p>
                    </div>
                    <div className="right">
                        <button className="btn btn-icon"><EllipsisVerticleIcon /></button>
                    </div>
                </div>
            </div>
        </div>
    )
}