import React, { useState, useEffect } from 'react';
import { SortIcon, InvoiceIcon, RightChevronIcon } from '../../../components/ui/Extras/Icons';
import { useStripeConnect } from "../../../hooks/useStripeConnect";
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from "@stripe/react-connect-js";
import { httpsCallable } from 'firebase/functions';
import { firestore, functions } from '../../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export const Finances = ({ musicianProfile, setMusicianProfile }) => {
    const [sortOrder, setSortOrder] = useState('desc');
    const [feesToDisplay, setFeesToDisplay] = useState([]);
    const [pendingTotal, setPendingTotal] = useState(0);
    const [accountCreatePending, setAccountCreatePending] = useState(false);
    const [onboardingExited, setOnboardingExited] = useState(false);
    const [error, setError] = useState(false);
    const [connectedAccountId, setConnectedAccountId] = useState();
    const stripeConnectInstance = useStripeConnect(connectedAccountId);

    const earningsData = feesToDisplay.reduce((acc, fee) => {
        const gigDate = new Date(fee.gigDate).toLocaleDateString('en-GB', {
            month: 'short',
            year: 'numeric',
        });
        acc[gigDate] = (acc[gigDate] || 0) + fee.amount;
        return acc;
    }, {});

    const chartData = {
        labels: Object.keys(earningsData), // Dates
        datasets: [
            {
                label: 'Total Earnings (£)',
                data: Object.values(earningsData),
                backgroundColor: 'rgba(255, 233, 228, 0.5)',
                borderColor: 'rgba(255, 108, 75, 1)',
                borderWidth: 1,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                display: true,
                position: 'bottom',
                labels: {
                    font: {
                        size: 14,
                        family: 'DM Sans',
                        weight: 'bold',
                    },
                    color: '#333',
                },
            },
            title: {
                display: true,
                text: '',
                font: {
                    size: 18,
                    family: 'DM Sans',
                    weight: 'bold',
                },
                color: '#333', // Title color
            },
            tooltip: {
                enabled: true,
                backgroundColor: 'rgba(0, 0, 0, 0.7)', // Tooltip background
                titleColor: '#fff', // Title font color
                bodyColor: '#fff', // Body font color
                borderColor: '#ddd', // Tooltip border
                borderWidth: 1, // Tooltip border width
            },
        },
        scales: {
            x: {
                grid: {
                    display: false,
                },
                ticks: {
                    color: '#333',
                    font: {
                        size: 12,
                        family: 'DM Sans',
                    },
                },
            },
            y: {
                grid: {
                    color: '#e0e0e0',
                    borderDash: [4, 4],
                },
                ticks: {
                    color: '#333',
                    font: {
                        size: 12,
                        family: 'DM Sans',
                    },
                },
                beginAtZero: true,
            },
        },
    };


    useEffect(() => {
        if (musicianProfile) {
            const combinedFees = [
                ...(musicianProfile.pendingFees || []),
                ...(musicianProfile.clearedFees || []),
            ];
            const totalPending = musicianProfile.pendingFees
                ? musicianProfile.pendingFees.reduce((sum, fee) => sum + fee.amount, 0)
                : 0;
            setPendingTotal(totalPending);
            combinedFees.sort((a, b) => {
                const dateA = new Date(a.gigDate).getTime();
                const dateB = new Date(b.gigDate).getTime();
                return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
            });
            setFeesToDisplay(combinedFees);
        }
    }, [musicianProfile, sortOrder]);

    const formatFeeDate = (timestamp) => {
        const date = new Date(timestamp);
        const day = date.getDate();
        const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' });
        const month = date.toLocaleDateString('en-GB', { month: 'short' });
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

      const handleEditBankDetails = async () => {
        try {
            const changeBankDetailsFunction = httpsCallable(functions, "changeBankDetails");
            const response = await changeBankDetailsFunction({
                accountId: musicianProfile.stripeAccountId,
            });
    
            // Extract URL from the response
            const { url } = response.data;
    
            if (url) {
                window.location.href = url; // Redirect to Stripe's account dashboard
            } else {
                alert("Unable to generate account link. Please try again.");
            }
        } catch (error) {
            console.error('Error generating account link:', error);
            alert("An error occurred while trying to edit bank details.");
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
                            <h2>£{parseFloat(musicianProfile.withdrawableEarnings ? musicianProfile.withdrawableEarnings : 0).toFixed(2)}</h2>
                        </div>
                        <div className="earnings-type total">
                            <h6>Total Earnings:</h6>
                            <h1>£{parseFloat(musicianProfile.totalEarnings ? musicianProfile.totalEarnings : 0).toFixed(2)}</h1>
                        </div>
                        <div className="earnings-type pending">
                            <h6>Pending Funds:</h6>
                            <h2>£{parseFloat(pendingTotal).toFixed(2)}</h2>
                        </div>
                    </div>
                </div>
                {musicianProfile.bankDetailsAdded ? (
                    <div className="tile connect-account graph">
                        <h2>Earnings Over Time</h2>
                        <Bar data={chartData} options={chartOptions} />
                    </div>
                ) : (
                    <div className="tile connect-account">
                        <h2>Connect Your Bank Account</h2>
                        <div className="stripe-window">
                            {connectedAccountId && !stripeConnectInstance && <h2>Add information to start accepting money</h2>}
                            {!connectedAccountId && <h4>We use Stripe to securely manage your payment details. <br /><br /> If you want your withdrawable earnings paid into your personal account, select Individual/Sole Trader. If you are paying the funds into a business account, you must select the type of business you are. This is required for legal compliance.</h4>}
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
                                    onExit={async () => {
                                        setOnboardingExited(true);
                                        try {
                                            const musicianRef = doc(firestore, "musicianProfiles", musicianProfile.musicianId);
                                            await updateDoc(musicianRef, {bankDetailsAdded: true});
                                            setMusicianProfile(...prev => ({...prev, bankDetailsAdded: true}));
                                        } catch (error) {
                                            console.error("Error updating musician profile:", error);
                                        }
                                    }}
                                />
                            </ConnectComponentsProvider>
                            )}
                            {error && <p className="error">Something went wrong!</p>}
                        </div>
                    </div>
                )}
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
                                            <td className={`status-box ${fee.status === 'cleared' ? 'succeeded' : fee.status === 'in dispute' ? 'declined' : fee.status}`}>
                                                <div className={`status ${fee.status === 'cleared' ? 'succeeded' : fee.status === 'in dispute' ? 'declined' : fee.status}`}>
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
                    <h2>Your Bank Account</h2>
                        <div className="amount">
                            <h4>Withdrawable Funds</h4>
                            <h1>£{musicianProfile.withdrawableEarnings ? parseFloat(musicianProfile.withdrawableEarnings).toFixed(2) : '0.00'}</h1>
                            <div className="two-buttons">
                                {musicianProfile.bankDetailsAdded && (
                                    <button className="btn secondary" onClick={handleEditBankDetails}>
                                        Edit Bank Details
                                    </button>
                                )}
                                <button className="btn primary-alt" onClick={handlePayout}>
                                    Withdraw Funds
                                </button>
                            </div>
                        </div>
                </div>
            </div>
        </>
    );
};