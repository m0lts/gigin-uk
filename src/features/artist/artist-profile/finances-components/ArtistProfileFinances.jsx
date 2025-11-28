import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { useArtistDashboard } from '../../../../context/ArtistDashboardContext';
import { useBreakpoint } from '@hooks/useBreakpoint';
import { getArtistProfileFees } from '@services/client-side/artists';
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

  const hasStripeAccount = !!user?.stripeConnectId;
  const artistProfileId = activeArtistProfile?.id || null;

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
        ? 'ID Verification Required.'
        : status === 'warning'
        ? `${actions.length} Action${actions.length === 1 ? '' : 's'} Required`
        : status === 'urgent' && actions.includes('individual.verification.document')
        ? 'ID Verification Required.'
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

  const withdrawableDisplay = useMemo(() => {
    const amount = Number(activeArtistProfile?.withdrawableEarnings || 0);
    return amount.toFixed(2);
  }, [activeArtistProfile?.withdrawableEarnings]);

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

            {Number(activeArtistProfile?.withdrawableEarnings || 0) > 0 && (
              <div className="withdraw-funds-row">
                <button
                  className="btn artist-profile"
                  style={{ width: '100%' }}
                  onClick={handleGoToPayoutSettings}
                >
                  Withdraw Funds To Bank Account
                </button>
              </div>
            )}

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


