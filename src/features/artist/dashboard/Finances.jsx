import React, { useState, useEffect } from 'react';
import { SortIcon, InvoiceIcon, LeftArrowIcon } from '@features/shared/ui/extras/Icons';
import { useStripeConnect } from '@hooks/useStripeConnect';
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
  ConnectAccountManagement,
} from '@stripe/react-connect-js';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { updateMusicianProfile, getMusicianProfileByMusicianId } from '@services/client-side/artists';
import { payoutToBankAccount, transferStripeFunds, deleteStripeConnectAccount, getConnectAccountStatus } from '@services/api/payments';
import { openInNewTab } from '@services/utils/misc';
import { formatFeeDate } from '@services/utils/dates';
import { toast } from 'sonner';
import { BankAccountIcon, CoinsIconSolid, CopyIcon, DeleteGigIcon, ErrorIcon, ExclamationIcon, ExclamationIconSolid, MoreInformationIcon, PaymentSystemIcon, PieChartIcon, StripeIcon, SuccessIcon, TickIcon, WarningIcon } from '../../shared/ui/extras/Icons';
import { getMusicianFees } from '../../../services/client-side/artists';
import Portal from '../../shared/components/Portal';
import { LoadingSpinner } from '../../shared/ui/loading/Loading';
import { LoadingModal } from '../../shared/ui/loading/LoadingModal';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { WelcomeModal } from '../components/WelcomeModal';

function CountdownTimer({ targetDate }) {
    const [label, setLabel] = React.useState("");
  
    React.useEffect(() => {
      if (!targetDate) return;
  
      const tick = () => {
        const now = new Date();
        const diff = targetDate - now;
        if (diff <= 0) {
          setLabel("Releasing soon");
          return true;
        }
        const hours   = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setLabel(`Releasing Fee in: ${hours}h ${minutes}m ${seconds}s`);
        return false;
      };
        if (tick()) return;
      const id = setInterval(() => {
        if (tick()) clearInterval(id);
      }, 1000);
  
      return () => clearInterval(id);
    }, [targetDate]);
  
    return <>{label || "Calculating..."}</>;
  }

export const Finances = ({ user, musicianProfile }) => {
    const {isMdUp, isLgUp, isSmUp} = useBreakpoint();
    const [sortOrder, setSortOrder] = useState('desc');
    const [feesToDisplay, setFeesToDisplay] = useState([]);
    const [pendingTotal, setPendingTotal] = useState(0);
    const [accountCreatePending, setAccountCreatePending] = useState(false);
    const [onboardingExited, setOnboardingExited] = useState(false);
    const [error, setError] = useState(false);
    const [connectedAccountId, setConnectedAccountId] = useState();
    const stripeConnectInstance = useStripeConnect(connectedAccountId);
    const [payingOut, setPayingOut] = useState(false);
    const accountUrl = import.meta.env.VITE_STRIPE_ACCOUNT_URL;
    const [showHelp, setShowHelp] = useState(false);
    const [showManage, setShowManage] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [acctStatus, setAcctStatus] = useState(null);
    const [acctStatusLoading, setAcctStatusLoading] = useState(false);
    const [paymentSystemModal, setPaymentSystemModal] = useState(false);
    const [stripeSystemModal, setStripeSystemModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);
    const [stripeBalance, setStripeBalance] = useState(null);
    const [loadingStripeBalance, setLoadingStripeBalance] = useState(false);
    const hasStripeAccount = !!user?.stripeConnectId;

    useEffect(() => {
        if (!connectedAccountId && musicianProfile?.stripeAccountId) {
          setConnectedAccountId(musicianProfile.stripeAccountId);
        }
      }, [musicianProfile?.stripeAccountId, connectedAccountId]);

    useEffect(() => {
        if (hasStripeAccount) {
          const fetchBalance = async () => {
            setLoadingStripeBalance(true);
            try {
              const { getStripeBalance } = await import('@services/api/payments');
              const result = await getStripeBalance();
              setStripeBalance(result?.data?.withdrawableEarnings || 0);
            } catch (e) {
              console.error('Failed to fetch Stripe balance:', e);
              // Fallback to user document value
              setStripeBalance(user?.withdrawableEarnings || 0);
            } finally {
              setLoadingStripeBalance(false);
            }
          };
          fetchBalance();
        } else {
          // If no Stripe account, use user document value
          setStripeBalance(user?.withdrawableEarnings || 0);
        }
      }, [hasStripeAccount, user?.withdrawableEarnings]);

    useEffect(() => {
        let ignore = false;
        const load = async () => {
          if (!musicianProfile?.stripeAccountId) return;
          setAcctStatusLoading(true);
          try {
            const data = await getConnectAccountStatus();
            if (!ignore) setAcctStatus(data);
          } catch (e) {
            console.error(e);
          } finally {
            if (!ignore) setAcctStatusLoading(false);
          }
        };
        load();
        return () => (ignore = true);
    }, [musicianProfile?.stripeAccountId]);

    const handleCopy = async (value) => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success('Copied to clipboard.')
        } catch {
            console.error('Copy failed');
        }
    };

    useEffect(() => {
        if (!musicianProfile?.id) return;
        const fetchFees = async () => {
            try {
                const { clearedFees, pendingFees } = await getMusicianFees(musicianProfile.id);
                const combinedFees = [...pendingFees, ...clearedFees];
                const totalPending = pendingFees.reduce((sum, fee) => sum + (fee.amount || 0), 0);
                setPendingTotal(totalPending);
                combinedFees.sort((a, b) => {
                    const dateA = new Date(a.gigDate).getTime();
                    const dateB = new Date(b.gigDate).getTime();
                    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
                });
                setFeesToDisplay(combinedFees);
            } catch (error) {
                console.error("Error fetching musician fees:", error);
            }
        };
        fetchFees();
    }, [musicianProfile?.id, sortOrder]);

    useEffect(() => {
        const handleClick = () => {
          setShowHelp(false);
        };
    
        window.addEventListener('click', handleClick);
    
        return () => {
          window.removeEventListener('click', handleClick);
        };
      }, [showHelp]);

    const toggleSortOrder = () => {
        setSortOrder((prevOrder) => (prevOrder === 'desc' ? 'asc' : 'desc'));
    };

    const handlePayout = async () => {
        setPayingOut(true);
        // Use Stripe balance if available, otherwise use user document value
        const amountToWithdraw = hasStripeAccount 
          ? (stripeBalance !== null ? stripeBalance : 0)
          : (user?.withdrawableEarnings || 0);
        if (!amountToWithdraw || amountToWithdraw <= 0) {
          toast.error('No funds available to withdraw.');
          return;
        }
        try {
            const success = await payoutToBankAccount({ musicianId: musicianProfile.musicianId, amount: amountToWithdraw });
            if (success) {
              toast.success('Payout successful!');
              // Refresh balance after payout
              if (hasStripeAccount) {
                const { getStripeBalance } = await import('@services/api/payments');
                const result = await getStripeBalance();
                setStripeBalance(result?.data?.withdrawableEarnings || 0);
              }
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

    const handleDeleteStripeAccount = async () => {
        if (!musicianProfile?.musicianId) return;
        setDeleting(true);
        try {
          const res = await deleteStripeConnectAccount({ musicianId: musicianProfile.musicianId });
          if (res.success) {
            setConnectedAccountId(null);
            toast.success('Stripe account deleted.');
            window.location.reload();
          } else {
            toast.error(res.message || 'Could not delete Stripe account.');
          }
        } catch (e) {
          console.error(e);
          toast.error('Failed to delete Stripe account.');
        } finally {
          setDeleting(false);
        }
    };

    const renderStatusBox = () => {
        if (acctStatusLoading) {
          return (
            <div className="status-box loading">
              <span>Checking account status…</span>
            </div>
          );
        }
        if (!acctStatus?.exists) return null;
    
        const { status, counts, actions } = acctStatus;
        const classes =
          status === 'all_good' ? 'ok' : status === 'warning' ? 'warn' : 'urgent';
    
        const label =
          status === 'all_good'
            ? 'No Actions Required'
            : status === 'warning' && actions.includes('individual.verification.document')
            ? `ID Verification Required.`
            : status === 'warning'
            ? `${actions.length} Action${actions.length === 1 ? '' : 's'} Required`
            : status === 'urgent' && actions.includes('individual.verification.document')
            ? `ID Verification Required.`
            : status === 'urgent'
            && 'Action Required'

        const icon = 
            status === 'all_good'
            ? <SuccessIcon />
            : status === 'warning'
            ? <ExclamationIconSolid />
            : status === 'urgent'
            && <WarningIcon />
    
        return (
            status !== 'all_good' ? (
                <div className={`status-box ${classes} clickable`} onClick={() => {
                    setShowManage(true);
                  }}>
                  {icon}
                  <span>{label}</span>
                </div>
            ) : (
                <div className={`status-box ${classes}`}>
                    {icon}
                    <span>{label}</span>
                </div>
            )
        );
      };

    const handleAccountManagementClose = async () => {
        setAcctStatusLoading(true);
        setShowManage(false);
        try {
          const fresh = await getConnectAccountStatus();
          setAcctStatus(fresh);
        } catch (e) {
          console.error('Refresh status failed', e);
        } finally {
            setAcctStatusLoading(false);
        }
    }

    return (
        <>
            <div className='head finances'>
                <h1 className='title'>Finances</h1>
                {musicianProfile.bankDetailsAdded && (
                    <div className="account-status">
                        <h6>Account Status:</h6>
                        {renderStatusBox()}
                    </div>
                )}
            </div>
            <div className='body finances'>
                <div className="top-section">
                    <div className='expenditure-card'>
                        <div className="expenditure-icon">
                            <CoinsIconSolid />
                        </div>
                        <div className="expenditure-text">
                            <h5>Withdrawable Funds</h5>
                            <h2>£{(() => {
                              const amount = hasStripeAccount 
                                ? (stripeBalance !== null ? parseFloat(stripeBalance) : 0)
                                : (user?.withdrawableEarnings ? parseFloat(user.withdrawableEarnings) : 0);
                              return amount.toFixed(2);
                            })()}</h2>
                        </div>
                        {musicianProfile.bankDetailsAdded ? (
                            payingOut ? (
                                <LoadingSpinner />
                            ) : (() => {
                              const withdrawableAmount = hasStripeAccount 
                                ? (stripeBalance !== null ? stripeBalance : 0)
                                : (user?.withdrawableEarnings || 0);
                              return withdrawableAmount > 0 && (
                                <button className='btn primary' onClick={handlePayout}>
                                    Withdraw Funds
                                </button>
                              );
                            })()
                        ) : (() => {
                          const withdrawableAmount = hasStripeAccount 
                            ? (stripeBalance !== null ? stripeBalance : 0)
                            : (user?.withdrawableEarnings || 0);
                          return withdrawableAmount > 0 && (
                            <h4 className='no-bank-details-added'>
                                Add Bank Details Before Withdrawing
                            </h4>
                          );
                        })()}
                    </div>
                    {isSmUp && (
                        <div className="venue-expenditure-container">
                            <div className="expenditure-card other">
                                <PieChartIcon />
                                <div className="expenditure-text">
                                    <h5>Total Earnings</h5>
                                    <h3>£{user?.totalEarnings ? parseFloat(user.totalEarnings).toFixed(2) : '0.00'}</h3>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                    {!musicianProfile.bankDetailsAdded && (
                        <div className='connect-account'>
                            <div className={`title ${!stripeConnectInstance ? 'right' : ''}`}>
                                {stripeConnectInstance && (
                                    <div className="text">
                                        <BankAccountIcon />
                                        <h2>Connect Your Bank Account</h2>
                                    </div>
                                )}
                                {showHelp && (
                                    <div className="more-information" onClick={() => setShowHelp(false)}>
                                        <MoreInformationIcon />
                                        <div className='text-information'>
                                            <p>Unless you are registered as a business, select Individual/Sole Trader.</p>
                                            <p>When Stripe asks for a website link, enter your gigin profile link:</p>
                                            <p className="link" onClick={(e) => {e.stopPropagation(); handleCopy(`https://giginmusic.com/${musicianProfile.musicianId}`)}}>https://giginmusic.com/{musicianProfile.musicianId} <CopyIcon /></p>
                                        </div>
                                    </div>
                                )}
                                <button className='btn secondary' onClick={(e) => {e.stopPropagation(); setShowHelp(!showHelp)}}>
                                    <MoreInformationIcon />
                                    <h4>Help</h4>
                                </button>
                            </div>
                            <div className={`stripe-window ${stripeConnectInstance ? 'stripe-active' : ''}`}>
                                {accountCreatePending ? (
                                    <div className="loading-state">
                                        <LoadingSpinner />
                                        <h3>Connecting to Stripe…</h3>
                                        <p className="muted">This usually takes a few seconds.</p>
                                    </div>
                                ) : (
                                    <>
                                        {!connectedAccountId && (
                                            <>
                                                <BankAccountIcon />
                                                <h2>Connect Your Bank Account</h2>
                                                <h4 className='help-text'>We use Stripe to securely manage bank connections. <br /> <br /> Click the information <MoreInformationIcon /> button above for help. This process should only take 2 minutes.</h4>
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
                                                await updateMusicianProfile({ musicianId: musicianProfile.musicianId, updates: {bankDetailsAdded: true} });
                                                const withdrawableFunds = user?.withdrawableEarnings || 0;
                                                if (withdrawableFunds && withdrawableFunds > 1) {
                                                    const sanitisedWithdrawableFunds = Math.round(parseFloat(withdrawableFunds) * 100);
                                                    await transferStripeFunds({ connectedAccountId: musicianProfile.stripeAccountId, amount: sanitisedWithdrawableFunds });
                                                }
                                                window.location.reload();
                                                toast.success('Stripe Account Linked!');
                                            } catch (error) {
                                                console.error('Error updating musician profile:', error);
                                                toast.error('Error connecting Stripe account. Please try again.');
                                            }
                                        }}
                                    />
                                </ConnectComponentsProvider>
                                )}
                                {error && <p className='error'>Something went wrong!</p>}
                            </div>
                        </div>
                    )}
                    {musicianProfile.bankDetailsAdded && isMdUp && (
                        <div className="information-grid">
                            <div className="information-item" onClick={() => setPaymentSystemModal(true)}>
                                <PaymentSystemIcon />
                                <h3>How The Gigin Payment System Works</h3>
                                <p>Learn how the Gigin payment system works and how to withdraw your gig earnings!</p>
                            </div>
                            <div className="information-item" onClick={() => setStripeSystemModal(true)}>
                                <StripeIcon />
                                <h3>How Stripe Securely Manages Your Funds</h3>
                                <p>Learn how Gigin uses Stripe to handle your gig payments and how your information is securely stored.</p>
                            </div>
                            <div className="information-item actions">
                                {musicianProfile.stripeAccountId && stripeConnectInstance && (
                                <button className="btn tertiary information-button" onClick={() => setShowManage(true)}>
                                    Edit Stripe Details
                                </button>
                                )}
                                <button className={`btn tertiary information-button`}  onClick={() => setShowDeleteModal(true)} disabled={deleting || (() => {
                                  const withdrawableAmount = hasStripeAccount 
                                    ? (stripeBalance !== null ? stripeBalance : 0)
                                    : (user?.withdrawableEarnings || 0);
                                  return withdrawableAmount > 0;
                                })()}>
                                    Delete Stripe Account
                                </button>
                            </div>
                        </div>
                    )}
                    {!isMdUp && (
                        <div className="information-item actions">
                            {musicianProfile.stripeAccountId && stripeConnectInstance && (
                            <button className="btn tertiary information-button" onClick={() => setShowManage(true)}>
                                Edit Stripe Details
                            </button>
                            )}
                            <button className={`btn tertiary information-button`}  onClick={() => setShowDeleteModal(true)} disabled={deleting || (user?.withdrawableEarnings || 0) > 0}>
                                    Delete Stripe Account
                                </button>
                            <button className="btn tertiary" onClick={() => setShowWelcomeModal(true)}>
                                View Tutorial
                            </button>
                        </div>
                    )}
                    {musicianProfile.bankDetailsAdded && (
                        <div className='tile your-fees'>
                            <h2>Your Fees</h2>
                            <table>
                                <thead>
                                    <tr>
                                        {isLgUp && (
                                            <th id='date'>
                                                Gig Date
                                                <button className='sort btn text' onClick={toggleSortOrder}>
                                                    <SortIcon />
                                                </button>
                                            </th>
                                        )}
                                        <th>Venue</th>
                                        <th>Amount</th>
                                        <th>Release Date</th>
                                        <th className='centre'>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                {feesToDisplay.length > 0 ? (
                                    feesToDisplay.map((fee, index) => {
                                        const now = new Date();

                                        const gigDateObj =
                                        fee.gigDate?.toDate ? fee.gigDate.toDate() : new Date(fee.gigDate);

                                        const clearingDate =
                                        fee.disputeClearingTime?.toDate
                                            ? fee.disputeClearingTime.toDate()
                                            : new Date(fee.disputeClearingTime);

                                        const isFutureGig   = gigDateObj > now;
                                        const inDisputeWind = gigDateObj <= now && clearingDate > now;

                                        // choose a status label or a component
                                        let statusNode;
                                        if (fee.status === "cleared") {
                                            statusNode = "Fee Released";
                                        } else if (fee.status === "in dispute") {
                                            statusNode = "In Dispute";
                                        } else if (fee.status === "pending") {
                                            if (isFutureGig) {
                                                statusNode = "Gig Not Performed Yet";
                                            } else if (inDisputeWind) {
                                                statusNode = <CountdownTimer targetDate={clearingDate} />;
                                            } else {
                                                statusNode = "Pending";
                                            }
                                        } else {
                                        statusNode = fee.status;
                                        }

                                        const statusClass =
                                        fee.status === "cleared"
                                            ? "succeeded"
                                            : fee.status === "in dispute"
                                            ? "declined"
                                            : fee.status;

                                        return (
                                        <tr key={fee.id || index} onClick={(e) => openInNewTab(`/gig/${fee.gigId}`, e)}>
                                            {isLgUp && <td>{formatFeeDate(fee.gigDate, "short")}</td>}
                                            <td>{fee.venueName}</td>
                                            <td>£{fee.amount.toFixed(2)}</td>
                                            {fee.disputeLogged ? (
                                                <td>N/A: Dispute Logged</td>
                                            ) : (
                                                <td>{formatFeeDate(fee.disputeClearingTime)}</td>
                                            )}
                                            <td className={`status-box ${statusClass}`}>
                                            <div className={`status ${statusClass}`}>{statusNode}</div>
                                            </td>
                                        </tr>
                                        );
                                    })
                                    ) : (
                                    <tr className="no-receipts">
                                        <td className="data" colSpan={6}>
                                        <div className="flex">
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
                    {showManage && stripeConnectInstance && (
                        <Portal>
                            <div className="modal stripe-account" onClick={() => handleAccountManagementClose()}>
                                <div className="modal-content scrollable" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header">
                                    <CoinsIconSolid />
                                    <h2>Edit payout details</h2>
                                    <p>Change your Stripe connect account details here.</p> 
                                    <div className="more-information">
                                    <p><MoreInformationIcon /> If you require ID verification, click the edit text under the "Personal Details" title. Then click the 'Upload Document' button to upload an ID document.</p>
                                    </div>
                                    <button className="btn close tertiary" onClick={() => handleAccountManagementClose()}>Close</button>
                                </div>
                                <div className="modal-body">
                                    <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
                                        <ConnectAccountManagement
                                            onExit={async () => {
                                                setAcctStatusLoading(true);
                                                setShowManage(false);
                                                try {
                                                const fresh = await getConnectAccountStatus();
                                                setAcctStatus(fresh);
                                                } catch (e) {
                                                console.error('Refresh status failed', e);
                                                } finally {
                                                    setAcctStatusLoading(false);
                                                }
                                            }}
                                        />
                                    </ConnectComponentsProvider>
                                </div>
                                </div>
                            </div>
                        </Portal>
                    )}
                    {paymentSystemModal && (
                        <Portal>
                            <div className="modal more-information" onClick={() => setPaymentSystemModal(false)}>
                                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                                    <div className="modal-header">
                                        <PaymentSystemIcon />
                                        <h2>How The Gigin Payment System Works</h2>
                                        <button className="btn close tertiary" onClick={() => setPaymentSystemModal(false)}>Close</button>
                                    </div>
                                    <div className="modal-body">
                                        <p>
                                            <strong>Note:</strong> The Gigin payment system applies only to gigs where a venue
                                            is paying a fee to the musician or band. Open mic nights, charity events, and
                                            ticketed gigs where payment comes from ticket sales do not use this process.
                                        </p>
                                        <hr />
                                        <p>
                                            Our goal is to make sure that musicians get paid fairly, on time, and securely —
                                            and that venues have the peace of mind that funds are only released when the gig
                                            has been performed as agreed. This is why all gig payments go through our
                                            partnership with Stripe, one of the world’s most trusted payment providers.
                                        </p>
                                        <hr />
                                        <ol>
                                            <li>
                                            <strong>1. Gig Application Accepted</strong><br />
                                            Once a venue accepts your gig application, we automatically prepare the secure
                                            payment process in the background.
                                            <br />
                                            This ensures that as soon as both parties
                                            agree to the gig, the financial side is ready to go.
                                            </li>

                                            <li>
                                            <strong>2. Venue Pays the Gig Fee</strong><br />
                                            The venue pays the agreed gig fee through Gigin. This payment is made before
                                            the performance date, so you can be confident that the money is already set
                                            aside and ready for release after the event.
                                            </li>

                                            <li>
                                            <strong>3. Funds Held in Secure Escrow</strong><br />
                                            Once the venue pays, the funds don’t go straight to the musician immediately.
                                            Instead, Stripe securely holds the payment in what’s effectively an “escrow”
                                            account. This protects both sides — the venue knows they won’t pay for a gig
                                            that doesn’t happen, and the musician knows the money can’t be pulled back once
                                            the gig is complete.
                                            </li>

                                            <li>
                                            <strong>4. Post-Gig Release</strong><br />
                                            After the gig takes place, there’s a 48-hour window where either the musician
                                            or the venue can raise a dispute if something didn’t go to plan (for example,
                                            if the gig was cancelled last-minute or there was a serious issue with the
                                            performance). If no dispute is raised during this period, Stripe automatically
                                            releases the funds to your connected Stripe account.
                                            </li>

                                            <li>
                                            <strong>5. Withdrawable Funds</strong><br />
                                            Once Stripe releases the funds, they will appear in your Gigin finances under
                                            <em>“Withdrawable Funds”</em>. This means the money is now yours to withdraw at
                                            any time — you’re not required to withdraw it immediately, so you can let
                                            payments build up if you prefer.
                                            </li>

                                            <li>
                                            <strong>6. Transfer to Your Bank</strong><br />
                                            When you choose to withdraw your balance, Stripe transfers the funds directly
                                            to the bank account you’ve set up in your Stripe Connect account. Bank
                                            transfers usually arrive within 1–2 working days, depending on your bank.
                                            </li>
                                        </ol>
                                        <hr />
                                        <p>
                                            This process has been designed to keep things fair, transparent, and secure for
                                            both musicians and venues. With Stripe’s trusted infrastructure handling all
                                            transactions, you can focus on the music while we take care of the payments.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Portal>
                    )}
                    {stripeSystemModal && (
                        <Portal>

                                <div className="modal more-information" onClick={() => setStripeSystemModal(false)}>
                                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header">
                                    <StripeIcon />
                                    <h2>How Stripe Securely Manages Your Funds</h2>
                                    <button className="btn close tertiary" onClick={() => setStripeSystemModal(false)}>Close</button>
                                </div>
                                <div className="modal-body">
                                    <p>
                                        Your Gigin payments are processed and held by <strong>Stripe</strong>, one of the
                                        world’s most trusted online payment providers. Stripe handles payments for
                                        millions of businesses — from small creators to large companies like Amazon,
                                        Booking.com, and Shopify — and is authorised and regulated as a licensed payment
                                        institution.
                                    </p>
                                    <br />
                                    <p>
                                        When you connect your bank account to Gigin, you’re actually creating a{" "}
                                        <strong>Stripe Connect account</strong> in your name.
                                        This account is completely separate from Gigin’s own finances and is owned and
                                        controlled by you.
                                    </p>
                                    <hr />
                                    <h3>How Stripe Protects Your Money</h3>
                                    <ul>
                                        <li>
                                        <strong>Funds are ring-fenced:</strong> Money paid for your gigs never touches
                                        Gigin’s bank accounts. It is held securely by Stripe until it’s ready to be
                                        released to you.
                                        </li>
                                        <li>
                                        <strong>Regulated & compliant:</strong> Stripe is regulated by the Financial
                                        Conduct Authority (FCA) in the UK and must follow strict security and compliance
                                        requirements.
                                        </li>
                                        <li>
                                        <strong>Bank-level security:</strong> All data — including your personal details
                                        and bank account — is encrypted. Stripe uses the same security protocols as
                                        major banks.
                                        </li>
                                    </ul>
                                    <hr />
                                    <h3>How Your Funds Move</h3>
                                    <ol>
                                        <li>
                                            <strong>1. </strong>
                                        Gig payment is made by the venue and held in your Stripe Connect account balance.
                                        </li>
                                        <li>
                                        <strong>2. </strong>
                                        Funds are only released once the gig has been performed and the dispute period
                                        has passed.
                                        </li>
                                        <li>
                                        <strong>3. </strong>
                                        Once released, you can withdraw your funds to your bank account at any time.
                                        </li>
                                    </ol>

                                    <p>
                                        This means you’re always in control — Gigin never has the ability to block or
                                        take your money. Stripe acts as the secure middle-man, ensuring that both sides
                                        are protected.
                                    </p>

                                    <hr />

                                    <h3>More About Stripe</h3>
                                    <ul className='no-padding'>
                                        <li>
                                        Learn more about{" "}
                                        <a
                                            href="https://stripe.com/gb/connect"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Stripe Connect
                                        </a>
                                        </li>
                                        <li>
                                        Read Stripe’s{" "}
                                        <a
                                            href="https://stripe.com/docs/security/stripe"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Security Overview
                                        </a>
                                        </li>
                                        <li>
                                        View Stripe’s{" "}
                                        <a
                                            href="https://stripe.com/gb/privacy"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Privacy Policy
                                        </a>
                                        </li>
                                    </ul>

                                    <p>
                                        With Stripe managing your funds, you get bank-level security, global compliance,
                                        and the peace of mind that your money is safe from the moment it’s paid until it
                                        arrives in your bank account.
                                    </p>
                                </div>
                                </div>
                            </div>
                        </Portal>
                    )}
                {showDeleteModal && (
                    <Portal>
                        {!deleting ? (
                            <div className='modal confirm' onClick={() => setShowDeleteModal(false)}>
                                <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '300px'}}>
                                    <div className="modal-header">
                                        <DeleteGigIcon />
                                        <h2>Are you sure you want to delete your stripe account?</h2>
                                    </div>
                                    <div className='two-buttons'>
                                        <button className="btn tertiary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                                        <button className="btn danger" onClick={handleDeleteStripeAccount}>Delete</button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <LoadingModal title={'Deleting Stripe Account'} text={"Please don't close this window or refresh the page"} />
                        )}
                    </Portal>
                )}
            </div>
            {showWelcomeModal && (
              <Portal>
                <WelcomeModal
                  user={user}
                  setShowWelcomeModal={setShowWelcomeModal}
                  role='musician'
                  revisiting={true}
                  financesOnly={true}
                />
              </Portal>
            )}
        </>
    );
};