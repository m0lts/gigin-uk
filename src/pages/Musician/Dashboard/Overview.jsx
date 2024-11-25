import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";
import {CardForm} from '../../../components/common/CardDetails'
import { LoadingThreeDots } from "/components/ui/loading/Loading";
import { PlusIcon } from "/components/ui/Extras/Icons";
import { FaceFrownIcon, TelescopeIcon } from '../../../components/ui/Extras/Icons';


export const Overview = ({ musicianProfile, gigApplications }) => {

    const navigate = useNavigate();

    const formatPaymentCharge = (amount) => {
        return (amount / 100).toFixed(2);
    };

    const formatPaymentDate = (timestamp) => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };
    console.log(gigApplications)
    console.log(musicianProfile)

    return (
        <div className="overview-page">
            <div className="grid-tile">
                <h2>Next Gig</h2>
                
            </div>
            <div className={`grid-tile`}>
                <h2>Your Payments</h2>
                {musicianProfile.pendingFees.length > 0 ? (
                    musicianProfile.pendingFees.map((fee, index) => (
                        <div key={index} className="pending-fee">
                            <h1>{fee.amount}</h1>
                        </div>
                    ))
                ) : (
                    <div className="no-pending-fees">
                        <FaceFrownIcon />
                        <h4>You have no pending fees.</h4>
                    </div>
                )}
            </div>
            <div className="grid-tile">
                <h2>Gig Applications</h2>

            </div>
            <div className={`grid-tile `}>
                <h2>Messages</h2>
            </div>
            <div className="grid-tile find-gig hoverable" onClick={() => navigate('/find-a-gig')}>
                <TelescopeIcon />
                <h2>Find a Gig</h2>
            </div>
        </div>
    );
};