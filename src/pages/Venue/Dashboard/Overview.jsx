import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";
import {CardForm} from '../../../components/common/CardDetails'
import { LoadingThreeDots } from "/components/ui/loading/Loading";
import { PlusIcon } from "/components/ui/Extras/Icons";
import VisaIcon from '/assets/images/visa.png';
import MastercardIcon from '/assets/images/mastercard.png';
import AmexIcon from '/assets/images/amex.png';


export const Overview = ({ savedCards, loadingStripeDetails, receipts }) => {

    const navigate = useNavigate();

    const cardBrandIcons = {
        visa: VisaIcon,
        mastercard: MastercardIcon,
        amex: AmexIcon,
        unknown: null,
    };

    const formatReceiptCharge = (amount) => {
        return (amount / 100).toFixed(2);
    };

    const formatReceiptDate = (timestamp) => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const openReceipt = (url) => {
        window.open(url, '_blank');
    };

    return (
        <div className="overview">
            <div className="grid-tile">
                <h2>Upcoming Gigs</h2>

            </div>
            <div className={`grid-tile ${loadingStripeDetails ? 'loading' : ''}`}>
                {loadingStripeDetails ? (
                    <LoadingThreeDots />
                ) : (
                    <>
                    <h2>Receipts</h2>
                    {receipts.length > 0 ? (
                        <ul className="receipt-list">
                            {receipts.map((receipt) => (
                                <li className="receipt-item" key={receipt.id} onClick={() => openReceipt(receipt.receipt_url)}>
                                    <div className="receipt-left">
                                        <h4>£{formatReceiptCharge(receipt.amount)}</h4>
                                        <h6>{formatReceiptDate(receipt.created)}</h6>
                                    </div>
                                    <div className="receipt-right">
                                        <span className={`status ${receipt.paid === true ? 'paid' : 'due'}`}>
                                            {receipt.paid === true ? (
                                                'Paid'
                                            ) : (
                                                'Due'
                                            )}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <h4>No Receipts.</h4>
                    )}
                    </>
                )}
            </div>
            <div className="grid-tile">
                <h2>Saved Musicians</h2>

            </div>
            <div className={`grid-tile ${loadingStripeDetails ? 'loading' : ''}`}>
                {loadingStripeDetails ? (
                    <LoadingThreeDots />
                ) : (
                    savedCards.length > 0 ? (
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
                        <li className="card-item hoverable" onClick={() => navigate('/venues/dashboard/finances')}>
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