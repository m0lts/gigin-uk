import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { useArtistDashboard } from '../../../../context/ArtistDashboardContext';
import { useBreakpoint } from '@hooks/useBreakpoint';
import { getArtistProfileFees, getArtistProfileMembers } from '@services/client-side/artists';
import { formatFeeDate } from '@services/utils/dates';
import { openInNewTab } from '@services/utils/misc';
import {
  CoinsIconSolid,
  PieChartIcon,
  InvoiceIcon,
  SortIcon,
  SuccessIcon,
  ExclamationIconSolid,
  WarningIcon,
} from '@features/shared/ui/extras/Icons';
import { LoadingSpinner } from '@features/shared/ui/loading/Loading';
import { getConnectAccountStatus } from '@services/api/payments';
import { BankAccountIcon, RightArrowIcon } from '../../../shared/ui/extras/Icons';

export const ArtistProfileFinances = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { activeArtistProfile } = useArtistDashboard();

  const [feesToDisplay, setFeesToDisplay] = useState([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [loading, setLoading] = useState(false);
  const [acctStatus, setAcctStatus] = useState(null);
  const [acctStatusLoading, setAcctStatusLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [stripeBalance, setStripeBalance] = useState(null);
  const [loadingStripeBalance, setLoadingStripeBalance] = useState(false);

  const hasStripeAccount = !!user?.stripeConnectId;
  // Use activeArtistProfile from context (which is filtered by activeProfileId prop)
  const artistProfileId = activeArtistProfile?.id || activeArtistProfile?.profileId || null;

  useEffect(() => {
    if (!artistProfileId) return;

    const fetchFees = async () => {
      setLoading(true);
      try {
        const { clearedFees = [], pendingFees = [] } =
          (await getArtistProfileFees(artistProfileId)) || {};

        const combinedFees = [...pendingFees, ...clearedFees];
        const totalPending = pendingFees.reduce(
          (sum, fee) => sum + (fee.amount || 0),
          0
        );
        const totalCleared = clearedFees.reduce(
          (sum, fee) => sum + (fee.amount || 0),
          0
        );

        setPendingTotal(totalPending);
        setTotalEarnings(totalPending + totalCleared);

        combinedFees.sort((a, b) => {
          const dateA = new Date(a.gigDate).getTime();
          const dateB = new Date(b.gigDate).getTime();
          return dateB - dateA;
        });

        setFeesToDisplay(combinedFees);
      } catch (error) {
        console.error('Error fetching artist profile fees:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFees();
  }, [artistProfileId]);

  useEffect(() => {
    if (!artistProfileId) return;

    const fetchMembers = async () => {
      setLoadingMembers(true);
      try {
        const membersList = await getArtistProfileMembers(artistProfileId);
        setMembers(membersList || []);
      } catch (error) {
        console.error('Error fetching artist profile members:', error);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchMembers();
  }, [artistProfileId]);

  const handleGoToPayoutSettings = () => {
    navigate('/account?show=payouts#payouts');
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

    const { status, actions } = acctStatus;
    const classes =
      status === 'all_good' ? 'ok' : status === 'warning' ? 'warn' : 'urgent';

    const label =
      status === 'all_good'
        ? 'No Actions Required'
        : status === 'warning' && actions.includes('individual.verification.document')
        ? 'ID Verification Required Soon'
        : status === 'warning'
        ? `${actions.length} Action${actions.length === 1 ? '' : 's'} Required`
        : status === 'urgent' && actions.includes('individual.verification.document')
        ? 'ID Verification Required'
        : status === 'urgent'
        ? 'Action Required'
        : 'Account Status';

    const icon =
      status === 'all_good'
        ? <SuccessIcon />
        : status === 'warning'
        ? <ExclamationIconSolid />
        : <WarningIcon />;

    return (
      status !== 'all_good' ? (
        <div className={`status-box ${classes} clickable`} onClick={() => {
          handleGoToPayoutSettings();
        }}>
          {icon}
          <span>{label}</span>
        </div>
      ) : (
        <div className={`status-box ${classes} clickable`} onClick={() => {
          handleGoToPayoutSettings();
        }}>
          {icon}
          <span>{label}</span>
        </div>
      )
    );
  };

  useEffect(() => {
    if (hasStripeAccount) {
      const fetchStatus = async () => {
        setAcctStatusLoading(true);
        try {
          const status = await getConnectAccountStatus();
          setAcctStatus(status);
        } catch (e) {
          console.error('Failed to fetch Stripe account status', e);
        } finally {
          setAcctStatusLoading(false);
        }
      };
      fetchStatus();
    }
  }, [hasStripeAccount]);

  useEffect(() => {
    if (hasStripeAccount) {
      const fetchBalance = async () => {
        setLoadingStripeBalance(true);
        try {
          const { getStripeBalance } = await import('@services/api/payments');
          const result = await getStripeBalance();
          setStripeBalance(result?.withdrawableEarnings || 0);
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

  const withdrawableDisplay = useMemo(() => {
    // If user has Stripe account, use Stripe balance (source of truth)
    // Otherwise, use withdrawableEarnings from user document
    const amount = hasStripeAccount 
      ? (stripeBalance !== null ? Number(stripeBalance) : 0)
      : Number(user?.withdrawableEarnings || 0);
    return amount.toFixed(2);
  }, [hasStripeAccount, stripeBalance, user?.withdrawableEarnings]);

  const totalEarningsDisplay = useMemo(() => {
    return (totalEarnings || 0).toFixed(2);
  }, [totalEarnings]);

  return (
    <div className="artist-profile-gigs-card">
      <div className="head finances">
        <div className="title-container">
          <CoinsIconSolid />
          <h3 className="title">Finances</h3>
        </div>
        <div className="finances-actions">
          {!hasStripeAccount && (
            <button
              className="btn secondary"
              onClick={handleGoToPayoutSettings}
            >
              Manage Payout Account
            </button>
          )}
          {hasStripeAccount && (
            <div className="account-status">
              {renderStatusBox()}
            </div>
          )}
        </div>
      </div>

      <div className="artist-profile-gigs-content no-next-gig">
        <section className="artist-profile-gigs-section all-gigs">
          <div className="body gigs musician">
            <div className="top-section finances">
              <div className="expenditure-card">
                <div className="expenditure-text">
                  <h6>Withdrawable Funds</h6>
                  <h3>£{withdrawableDisplay}</h3>
                </div>
              </div>

              <div className="venue-expenditure-container">
                <div className="expenditure-card other">
                  <PieChartIcon />
                  <div className="expenditure-text">
                    <h6>Total Artist Earnings</h6>
                    <h3>£{totalEarningsDisplay}</h3>
                  </div>
                </div>
              </div>
            </div>

            {(() => {
              const withdrawableAmount = hasStripeAccount 
                ? (stripeBalance !== null ? Number(stripeBalance) : 0)
                : Number(user?.withdrawableEarnings || 0);
              return withdrawableAmount > 0 && (
                <div className="withdraw-funds-row">
                  <button
                    className="btn artist-profile"
                    style={{ width: '100%' }}
                    onClick={handleGoToPayoutSettings}
                  >
                    Withdraw Funds To Bank Account
                  </button>
                </div>
              );
            })()}

            {!hasStripeAccount && (
                <div className="artist-profile-finances-banner">
                 <BankAccountIcon />
                 <h4>
                   Your finances are managed at your main Gigin account level. If you have
                   more than one Artist profile, all of your earnings are paid out to your
                   Gigin account, not to each individual Artist profile.
                 </h4>
                <button
                  className="btn primary"
                  onClick={handleGoToPayoutSettings}
                >
                  Connect Payout Account
                </button>
              </div>
            )}

            {/* Payout Recipients List */}
            {members.length > 0 && (
              <div className="payout-recipients-section">
                <h3>Payout Recipients</h3>
                {loadingMembers ? (
                  <div className="loading-state">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <div className="members-list">
                    {members.map((member) => (
                      <div key={member.id} className="member-item">
                        <div className="member-name">
                          {member.userName || member.userEmail || 'Unknown Member'}
                          {member.role === 'owner' && (
                            <span className="member-role"> (Owner)</span>
                          )}
                        </div>
                        <div className="member-payout-info">
                          <div className={`status-box ${member.payoutsEnabled ? 'ok' : 'warn'}`}>
                            {member.payoutsEnabled ? (
                              <>
                                <SuccessIcon />
                                <span>Payouts Enabled</span>
                              </>
                            ) : (
                              <>
                                <WarningIcon />
                                <span>Payouts Not Enabled</span>
                              </>
                            )}
                          </div>
                          <div className="payout-percentage">
                            <h6>Split</h6>
                            <h4>{member.payoutSharePercent !== undefined ? `${member.payoutSharePercent}%` : '0%'}</h4>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="tile your-fees">
              <h3 style={{ marginBottom: '1rem' }}>Gig Fees for this Artist</h3>

              {loading ? (
                <div className="loading-state">
                  <LoadingSpinner />
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Venue</th>
                      <th>Amount</th>
                      <th>Release Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feesToDisplay.length > 0 ? (
                      feesToDisplay.map((fee) => (
                        <tr
                          key={fee.id}
                          onClick={(e) => openInNewTab(`/gig/${fee.gigId}`, e)}
                        >
                          <td>{fee.venueName}</td>
                          <td>£{fee.amount.toFixed(2)}</td>
                          <td>{formatFeeDate(fee.disputeClearingTime)}</td>
                          <td className={`status-box ${fee.status}`}>
                            <p className={`status ${fee.status}`}>
                              {fee.statusLabel || fee.status}
                            </p>
                          </td>
                        </tr>
                      ))
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
              )}
            </div>
          </div>
        </section>
      </div>

    </div>
  );
};


