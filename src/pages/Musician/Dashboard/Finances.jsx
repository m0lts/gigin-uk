import React, { useState, useEffect } from 'react';
import { SortIcon, InvoiceIcon, RightChevronIcon } from '../../../components/ui/Extras/Icons';
import { useStripeConnect } from "../../../hooks/useStripeConnect";
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from "@stripe/react-connect-js";
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase';

export const Finances = ({ musicianProfile }) => {
    const [sortOrder, setSortOrder] = useState('desc');
    const [feesToDisplay, setFeesToDisplay] = useState([]);
    const [pendingTotal, setPendingTotal] = useState(0);
    const [accountCreatePending, setAccountCreatePending] = useState(false);
    const [onboardingExited, setOnboardingExited] = useState(false);
    const [error, setError] = useState(false);
    const [connectedAccountId, setConnectedAccountId] = useState();
    const stripeConnectInstance = useStripeConnect(connectedAccountId);

    useEffect(() => {
        if (musicianProfile) {
            // Combine pendingFees and clearedFees
            const combinedFees = [
                ...(musicianProfile.pendingFees || []),
                ...(musicianProfile.clearedFees || []),
            ];

            const totalPending = musicianProfile.pendingFees
                ? musicianProfile.pendingFees.reduce((sum, fee) => sum + fee.amount, 0)
                : 0;
            setPendingTotal(totalPending);

            // Sort combined fees by date
            combinedFees.sort((a, b) => {
                const dateA = new Date(a.gigDate).getTime();
                const dateB = new Date(b.gigDate).getTime();
                return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
            });

            setFeesToDisplay(combinedFees);
        }
    }, [musicianProfile, sortOrder]); // Re-run whenever musicianProfile or sortOrder changes

    const formatFeeDate = (timestamp) => {
        const date = new Date(timestamp);
        const day = date.getDate();
        const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' });
        const month = date.toLocaleDateString('en-GB', { month: 'short' });

        // Add ordinal suffix to the day
        const getOrdinalSuffix = (day) => {
            if (day > 3 && day < 21) return 'th';
            switch (day % 10) {
                case 1: return 'st';
                case 2: return 'nd';
                case 3: return 'rd';
                default: return 'th';
            }
        };

        return `${weekday}, ${day}${getOrdinalSuffix(day)} ${month}`;
    };

    const openGigUrl = (gigId) => {
        const url = `/gig/${gigId}`;
        window.open(url, '_blank');
    };

    const toggleSortOrder = () => {
        setSortOrder((prevOrder) => (prevOrder === 'desc' ? 'asc' : 'desc'));
    };

    const handlePayout = async () => {
        const amountToWithdraw = musicianProfile.withdrawableEarnings;
        if (!amountToWithdraw || amountToWithdraw <= 0) {
          alert("No funds available to withdraw.");
          return;
        }
        try {
          const payoutFunction = httpsCallable(functions, "payoutToBankAccount");
          const response = await payoutFunction({
            musicianId: musicianProfile.musicianId,
            amount: amountToWithdraw,
          });
      
          if (response.data.success) {
            alert("Payout successful!");
            window.location.reload();
          } else {
            alert("Payout failed. Please try again.");
          }
        } catch (error) {
          console.error("Error processing payout:", error);
          alert("An error occurred while processing the payout. Please try again later.");
        }
      };

    return (
        <>
            <div className="head">
                <h1 className="title">Finances</h1>
            </div>
            <div className="body finances">
                <div className="tile earnings">
                    <h2>Your Gig Earnings</h2>
                    <div className="earnings-flex">
                        <div className="earnings-type withdrawable">
                            <h6>Withdrawable Funds:</h6>
                            <h2>£{parseFloat(musicianProfile.withdrawableEarnings).toFixed(2)}</h2>
                        </div>
                        <div className="earnings-type total">
                            <h6>Total Earnings:</h6>
                            <h1>£{parseFloat(musicianProfile.totalEarnings).toFixed(2)}</h1>
                        </div>
                        <div className="earnings-type pending">
                            <h6>Pending Funds:</h6>
                            <h2>£{parseFloat(pendingTotal).toFixed(2)}</h2>
                        </div>
                    </div>
                </div>
                <div className="tile connect-account">
                    <h2>Connect Your Bank Account</h2>
                    <div className="stripe-window">
                        {connectedAccountId && !stripeConnectInstance && <h2>Add information to start accepting money</h2>}
                        {!connectedAccountId && <h4>We use stripe to securely manage your payment details. If you want your withdrawable earnings paid into your personal account, select Individual/Sole Trader. If you are paying the funds into a business account, you must select the type of business you are. This is required for legal compliance.</h4>}
                        {!accountCreatePending && !connectedAccountId && (
                            <button
                                className='btn primary'
                                onClick={async () => {
                                    setAccountCreatePending(true);
                                    setError(false);
                                    fetch("https://stripeaccount-gxujnzd2uq-ey.a.run.app", {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({ musicianId: musicianProfile.musicianId }),
                                    })
                                    .then((response) => response.json())
                                    .then((json) => {
                                        setAccountCreatePending(false);
                                        const { account, error } = json;

                                        if (account) {
                                        setConnectedAccountId(account);
                                        }

                                        if (error) {
                                        setError(true);
                                        }
                                    });
                                }}
                            >
                                    Add Bank Details
                            </button>
                        )}
                        {stripeConnectInstance && (
                        <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
                            <ConnectAccountOnboarding
                            onExit={() => setOnboardingExited(true)}
                            />
                        </ConnectComponentsProvider>
                        )}
                        {error && <p className="error">Something went wrong!</p>}
                        {(connectedAccountId || accountCreatePending || onboardingExited) && (
                        <div className="dev-callout">
                            {connectedAccountId && <h4>Your connected account ID is: <code className="bold">{connectedAccountId}</code></h4>}
                            {accountCreatePending && <h4>Creating a connected account...</h4>}
                            {onboardingExited && <h4>The Account Onboarding component has exited</h4>}
                        </div>
                        )}
                    </div>
                </div>
                <div className="tile your-fees">
                    <h2>Your Fees</h2>
                    <table>
                        <thead>
                            <tr>
                                <th id="date">
                                    Date
                                    <button className="sort btn text" onClick={toggleSortOrder}>
                                        <SortIcon />
                                    </button>
                                </th>
                                <th>Amount</th>
                                <th className="centre">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {feesToDisplay.length > 0 ? (
                                feesToDisplay.map((fee, index) => {
                                    return (
                                        <tr key={index} onClick={() => openGigUrl(fee.gigId)}>
                                            <td>{formatFeeDate(fee.gigDate)}</td>
                                            <td>£{fee.amount.toFixed(2)}</td>
                                            <td className={`status-box ${fee.status === 'cleared' ? 'succeeded' : fee.status}`}>
                                                <div className={`status ${fee.status === 'cleared' ? 'succeeded' : fee.status}`}>
                                                    {fee.status}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr className="no-fees">
                                    <td className="data" colSpan={6}>
                                        <div className="flex">
                                            <InvoiceIcon />
                                            <h4>No fees to show.</h4>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="tile withdraw">
                    <h2>Withdraw to bank account</h2>
                    <div className="amount">
                        <h1>£{parseFloat(musicianProfile.withdrawableEarnings).toFixed(2)}</h1>
                        <button className="btn primary-alt" onClick={handlePayout}>
                            Withdraw Funds
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};