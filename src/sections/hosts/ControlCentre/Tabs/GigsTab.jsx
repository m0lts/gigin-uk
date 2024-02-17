import { EllipsisVerticleIcon, FiltersIcon, MenuIcon } from "../../../../components/Icons/Icons"
import { useState } from "react"
import { AddGigModal } from "./AddGigModal";

export const GigsTab = () => {

    const [addGigModal, setAddGigModal] = useState(false);

    return (
        <div className="gigs-tab tab">
            <div className="tab-banner">
                <h3 className="title">Gigs</h3>
                <button className="btn btn-black" onClick={() => setAddGigModal(true)}>
                    Create Gig
                </button>
            </div>
            {addGigModal && <AddGigModal addGigModal={addGigModal} setAddGigModal={setAddGigModal} />}
            <div className="tab-content table">
                <div className="head item">
                    <div className="left">
                        <h6>Upcoming</h6>
                    </div>
                    <div className="right">
                        <button className="btn btn-icon"><FiltersIcon /></button>
                    </div>
                </div>
                <div className="body">
                    <div className="item">
                        <div className="left">
                            <p>12th August 2021</p>
                            <p>The Old Blue Last</p>
                        </div>
                        <div className="right">
                            <button className="btn btn-icon"><EllipsisVerticleIcon /></button>
                        </div>
                    </div>
                    <div className="item">
                        <div className="left">
                            <p>12th August 2021</p>
                            <p>The Old Blue Last</p>
                        </div>
                        <div className="right">
                            <button className="btn btn-icon"><EllipsisVerticleIcon /></button>
                        </div>
                    </div>
                    <div className="item">
                        <div className="left">
                            <p>12th August 2021</p>
                            <p>The Old Blue Last</p>
                        </div>
                        <div className="right">
                            <button className="btn btn-icon"><EllipsisVerticleIcon /></button>
                        </div>
                    </div>
                </div>
                <div className="head item">
                    <div className="left">
                        <h6>Previous</h6>
                    </div>
                    <div className="right">
                        <button className="btn btn-icon"><FiltersIcon /></button>
                    </div>
                </div>
                <div className="body">
                    <div className="item">
                        <div className="left">
                            <p>12th August 2021</p>
                            <p>The Old Blue Last</p>
                        </div>
                        <div className="right">
                            <button className="btn btn-icon"><EllipsisVerticleIcon /></button>
                        </div>
                    </div>
                    <div className="item">
                        <div className="left">
                            <p>12th August 2021</p>
                            <p>The Old Blue Last</p>
                        </div>
                        <div className="right">
                            <button className="btn btn-icon"><EllipsisVerticleIcon /></button>
                        </div>
                    </div>
                    <div className="item">
                        <div className="left">
                            <p>12th August 2021</p>
                            <p>The Old Blue Last</p>
                        </div>
                        <div className="right">
                            <button className="btn btn-icon"><EllipsisVerticleIcon /></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}