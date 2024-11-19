import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";
import {CardForm} from '../../../components/common/CardDetails'
import { LoadingThreeDots } from "/components/ui/loading/Loading";
import { PlusIcon } from "/components/ui/Extras/Icons";
import VisaIcon from '/assets/images/visa.png';
import MastercardIcon from '/assets/images/mastercard.png';
import AmexIcon from '/assets/images/amex.png';


export const Overview = ({ savedCards, loadingCards}) => {

    const navigate = useNavigate();

    const cardBrandIcons = {
        visa: VisaIcon,
        mastercard: MastercardIcon,
        amex: AmexIcon,
        unknown: null,
    };

    return (
        <div className="overview">
            <div className="grid-tile">
                <h2>Upcoming Gigs</h2>

            </div>
            <div className="grid-tile">
                <h2>Invoices</h2>

            </div>
            <div className="grid-tile">
                <h2>Saved Musicians</h2>

            </div>
            <div className={`grid-tile ${loadingCards ? 'loading' : ''}`}>
                {loadingCards ? (
                    <LoadingThreeDots />
                ) : (
                    savedCards.length < 0 ? (
                        <>
                        <h2>Saved Cards:</h2>
                        <ul className="card-list">
                        {savedCards.map((card) => (
                            <li
                                key={card.id}
                                className={`card-item`}
                            >   
                                <div className="card-left">
                                    <img
                                        src={cardBrandIcons[card.card.brand.toLowerCase()]}
                                        alt="Card Type"
                                        className="card-brand-icon"
                                    />
                                    <div className="card-details">
                                        <h4>
                                        {card.card.brand.toUpperCase()} ending in {card.card.last4}
                                        </h4>
                                        <h6>Expires {card.card.exp_month}/{card.card.exp_year}</h6>
                                    </div>
                                </div>
                                {card.customer.default_source && (card.customer.default_source === card.card.id) && (
                                    <div className="card-type">
                                        <p>Default</p>
                                    </div>
                                )}
                            </li>
                        ))}
                        <li className="card-item" onClick={() => navigate('/venues/dashboard/finances')}>
                            <h4>Add Another Card</h4>
                            <PlusIcon />
                        </li>
                        </ul>
                        </>
                    ) : (
                        <>
                        <h2>Saved Cards:</h2>
                            <div className="card-list">
                                <div className="card-item" onClick={() => navigate('/venues/dashboard/finances')}>
                                    <h4>Add a card to your account</h4>
                                    <PlusIcon />
                                </div>
                            </div>
                        </>
                    )
                )}
            </div>
            <div className="grid-tile">
                <h2>Finances</h2>


            </div>
            <div className="grid-tile">
                <h2>Settings</h2>


            </div>
            <div className="grid-tile">
                <h2>Your Venues</h2>

            </div>
            <div className="grid-tile">
                <h2>Recent Gigs</h2>

            </div>
        </div>
    );
};