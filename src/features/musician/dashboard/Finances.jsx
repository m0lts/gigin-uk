import React, { useState, useEffect } from 'react';
import { SortIcon, InvoiceIcon, LeftArrowIcon } from '@features/shared/ui/extras/Icons';
import { useStripeConnect } from '@hooks/useStripeConnect';
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from '@stripe/react-connect-js';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { updateMusicianProfile, getMusicianProfileByMusicianId } from '@services/musicians';
import { payoutToBankAccount, transferStripeFunds } from '@services/functions';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { openInNewTab } from '@services/utils/misc';
import { formatFeeDate } from '@services/utils/dates';
import { toast } from 'sonner';
import { BankAccountIcon, CoinsIconSolid, CopyIcon, MoreInformationIcon, PieChartIcon } from '../../shared/ui/extras/Icons';


export const Finances = ({ musicianProfile }) => {
    const [sortOrder, setSortOrder] = useState('desc');
    const [feesToDisplay, setFeesToDisplay] = useState([]);
    const [pendingTotal, setPendingTotal] = useState(0);
    const [accountCreatePending, setAccountCreatePending] = useState(false);
    const [onboardingExited, setOnboardingExited] = useState(false);
    const [error, setError] = useState(false);
    const [connectedAccountId, setConnectedAccountId] = useState();
    const stripeConnectInstance = useStripeConnect(connectedAccountId);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [payingOut, setPayingOut] = useState(false);
    const accountUrl = import.meta.env.VITE_STRIPE_ACCOUNT_URL;
    const [showHelp, setShowHelp] = useState(false);

    useResizeEffect((width) => {
        setWindowWidth(width);
    });

    const handleCopy = async (value) => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success('Copied to clipboard.')
        } catch {
            console.error('Copy failed');
        }
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

    const toggleSortOrder = () => {
        setSortOrder((prevOrder) => (prevOrder === 'desc' ? 'asc' : 'desc'));
    };

    const handlePayout = async () => {
        setPayingOut(true);
        const amountToWithdraw = musicianProfile.withdrawableEarnings;
        if (!amountToWithdraw || amountToWithdraw <= 0) {
          toast.error('No funds available to withdraw.');
          return;
        }
        try {
            const success = await payoutToBankAccount(musicianProfile.musicianId, amountToWithdraw);
            if (success) {
              toast.success('Payout successful!');
              window.location.reload();
            } else {
              toast.error('Payout failed. Please try again.');
            }
        } catch (error) {
          console.error('Error processing payout:', error);
          toast.error('An error occurred while processing the payout. Please try again later.');
        } finally {
            setPayingOut(false);
        }
      };

    return (
        <>
            <div className='head'>
                <h1 className='title'>Finances</h1>
            </div>
            <div className='body finances'>
            <div className="top-section">
                <div className='expenditure-card'>
                    <div className="expenditure-icon">
                        <CoinsIconSolid />
                    </div>
                    <div className="expenditure-text">
                        <h5>Withdrawable Funds</h5>
                        <h2>£{musicianProfile.withdrawableEarnings ? parseFloat(musicianProfile.withdrawableEarnings).toFixed(2) : '0.00'}</h2>
                    </div>
                    {musicianProfile.bankDetailsAdded ? (
                        payingOut ? (
                            <LoadingThreeDots />
                        ) : musicianProfile.withdrawableEarnings && (
                            <button className='btn primary' onClick={handlePayout}>
                                Withdraw Funds
                            </button>
                        )
                    ) : musicianProfile.withdrawableEarnings && (
                        <h4 className='no-bank-details-added'>
                            Add Bank Details Before Withdrawing
                        </h4>
                    )}
                </div>
                <div className="venue-expenditure-container">
                    <div className="expenditure-card other">
                        <PieChartIcon />
                        <div className="expenditure-text">
                            <h3>£{musicianProfile.totalEarnings ? parseFloat(musicianProfile.totalEarnings).toFixed(2) : '0.00'}</h3>
                            <h5>Total Earnings</h5>
                        </div>
                    </div>
                </div>
            </div>
                {!musicianProfile.bankDetailsAdded && (
                    <div className='connect-account'>
                        <div className="title">
                            {stripeConnectInstance && (
                                <div className="text">
                                    <BankAccountIcon />
                                    <h2>Connect Your Bank Account</h2>
                                </div>
                            )}
                            {showHelp ? (
                                <div className="more-information" onClick={() => setShowHelp(false)}>
                                    <MoreInformationIcon />
                                    <div className='text-information'>
                                        <p>If you aren't operating as a business, select Individual/Sole Trader. If you are operating as a business, you must select the type of business you are. This is required for legal compliance.</p>
                                        <p>When Stripe asks for a website link, enter your gigin profile link:</p>
                                        <p className="link" onClick={(e) => {e.stopPropagation(); handleCopy(`https://gigin.ltd/${musicianProfile.musicianId}`)}}>https://gigin.ltd/{musicianProfile.musicianId} <CopyIcon /></p>
                                    </div>
                                </div>
                            ) : (
                                <button className='btn secondary' onClick={() => setShowHelp(true)}>
                                    <MoreInformationIcon />
                                    <h4>Helpful Setup Information</h4>
                                </button>
                            )}
                        </div>
                        <div className={`stripe-window ${stripeConnectInstance ? 'stripe-active' : ''}`}>
                            {accountCreatePending ? (
                                <div className="loading-state">
                                    <LoadingThreeDots />
                                    <h3>Connecting to Stripe…</h3>
                                    <p className="muted">This usually takes a few seconds.</p>
                                </div>
                            ) : (
                                <>
                                    {!connectedAccountId && (
                                        <>
                                            <BankAccountIcon />
                                            <h2>Connect Your Bank Account</h2>
                                            <h4>We use Stripe to securely manage bank connections. <br /> If you need any help or don't understand something, click the information button above.</h4>
                                        </>
                                    )}
                                    {!accountCreatePending && !connectedAccountId && (
                                        <button
                                            className='btn primary'
                                            onClick={async () => {
                                                setAccountCreatePending(true);
                                                setError(false);
                                                try {
                                                const res = await fetch(accountUrl, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ musicianId: musicianProfile.musicianId }),
                                                });
                                                const { account, error } = await res.json();
                                                if (account) {
                                                    setConnectedAccountId(account);
                                                    await updateMusicianProfile(musicianProfile.musicianId, { stripeAccountId: account });
                                                } else if (error) {
                                                    setError(true);
                                                }
                                                } catch (e) {
                                                console.error(e);
                                                setError(true);
                                                } finally {
                                                setAccountCreatePending(false);
                                                }
                                            }}
                                        >
                                            Connect to Stripe
                                        </button>
                                    )}
                                </>
                            )}

                            {stripeConnectInstance && (
                            <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
                                <ConnectAccountOnboarding
                                    onExit={async () => {
                                        setOnboardingExited(true);
                                        try {
                                            await updateMusicianProfile(musicianProfile.musicianId, {bankDetailsAdded: true});
                                            const musicianDoc = await getMusicianProfileByMusicianId(musicianProfile.musicianId);
                                            const withdrawableFunds = musicianDoc.withdrawableFunds;
                                            if (withdrawableFunds && withdrawableFunds > 1) {
                                                const success = await transferStripeFunds(musicianProfile.stripeAccountId, withdrawableFunds * 100);
                                                if (success) {
                                                    await clearMusicianBalance(musicianProfile.musicianId);
                                                } else {
                                                    console.error('Error transferring funds to Stripe account.');
                                                }
                                            }
                                            toast.success('Stripe Account Linked!')
                                        } catch (error) {
                                            console.error('Error updating musician profile:', error);
                                            toast.error('Error connecting Stripe account. Please try again.')
                                        }
                                    }}
                                />
                            </ConnectComponentsProvider>
                            )}
                            {error && <p className='error'>Something went wrong!</p>}
                        </div>
                    </div>
                )}
                {musicianProfile.bankDetailsAdded && (
                    <div className='tile your-fees'>
                        <h2>Your Fees</h2>
                        <table>
                            <thead>
                                <tr>
                                    {windowWidth > 915 && (
                                        <th id='date'>
                                            Date
                                            <button className='sort btn text' onClick={toggleSortOrder}>
                                                <SortIcon />
                                            </button>
                                        </th>
                                    )}
                                    <th>Amount</th>
                                    <th className='centre'>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {feesToDisplay.length > 0 ? (
                                    feesToDisplay.map((fee, index) => {
                                        return (
                                            <tr key={index} onClick={(e) => openInNewTab(`/gig/${fee.gigId}`, e)}>
                                                {windowWidth > 915 && (
                                                <td>{formatFeeDate(fee.gigDate)}</td>
                                                )}
                                                <td>£{fee.amount.toFixed(2)}</td>
                                                <td className={`status-box ${fee.status === 'cleared' ? 'succeeded' : fee.status === 'in dispute' ? 'declined' : fee.status}`}>
                                                    <div className={`status ${fee.status === 'cleared' ? 'succeeded' : fee.status === 'in dispute' ? 'declined' : fee.status}`}>
                                                        {fee.status === 'cleared' ? 'Withdrawable' : fee.status}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr className='no-receipts'>
                                        <td className='data' colSpan={6}>
                                            <div className='flex'>
                                                <InvoiceIcon />
                                                <h4>No Fees</h4>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
};