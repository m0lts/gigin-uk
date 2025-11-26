import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { useArtistDashboard } from '../../../../context/ArtistDashboardContext';
import { useBreakpoint } from '@hooks/useBreakpoint';
import { getMusicianFees } from '@services/client-side/artists'; // TEMP: reuse legacy fees by treating artistProfileId as musicianId
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

export const ArtistProfileFinances = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isMdUp, isLgUp } = useBreakpoint();
  const { activeArtistProfile } = useArtistDashboard();

  const [sortOrder, setSortOrder] = useState('desc');
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
        // TEMP: reuse legacy musician fees API by passing artistProfileId as musicianId
        const { clearedFees = [], pendingFees = [] } =
          (await getMusicianFees(artistProfileId)) || {};

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
          return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });

        setFeesToDisplay(combinedFees);
      } catch (error) {
        console.error('Error fetching artist profile fees:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFees();
  }, [artistProfileId, sortOrder]);

  const handleToggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
  };

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
        <div className={`status-box ${classes}`}>
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
    return (pendingTotal || 0).toFixed(2);
  }, [pendingTotal]);

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
        {hasStripeAccount && (
          <div className="account-status">
            <h6>Account Status:</h6>
            {renderStatusBox()}
          </div>
        )}
      </div>

      <div className="artist-profile-gigs-content no-next-gig">
        <section className="artist-profile-gigs-section all-gigs">
          <div className="body gigs musician">
            <div className="top-section finances">
              <div className="expenditure-card">
                <div className="expenditure-icon">
                  <CoinsIconSolid />
                </div>
                <div className="expenditure-text">
                  <h5>Withdrawable Funds (for this artist)</h5>
                  <h2>£{withdrawableDisplay}</h2>
                </div>
                <button
                  className="btn secondary"
                  onClick={handleGoToPayoutSettings}
                >
                  Manage payout account
                </button>
              </div>

              {isMdUp && (
                <div className="venue-expenditure-container">
                  <div className="expenditure-card other">
                    <PieChartIcon />
                    <div className="expenditure-text">
                      <h5>Total Earnings (this artist)</h5>
                      <h3>£{totalEarningsDisplay}</h3>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {!hasStripeAccount && (
              <div className="artist-profile-finances-banner">
                <p>
                  Payouts for this artist are sent to your Gigin account&apos;s
                  payout details, not directly to this profile. Connect a payout
                  account in your account settings to start receiving payments.
                </p>
                <button
                  className="btn primary"
                  onClick={handleGoToPayoutSettings}
                >
                  Connect payout account
                </button>
              </div>
            )}


            <div className="tile your-fees">
              <h2>Your Fees for this Artist</h2>

              {loading ? (
                <div className="loading-state">
                  <LoadingSpinner />
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      {isLgUp && (
                        <th id="date">
                          Gig Date
                          <button
                            className="sort btn text"
                            onClick={handleToggleSortOrder}
                          >
                            <SortIcon />
                          </button>
                        </th>
                      )}
                      <th>Venue</th>
                      <th>Amount</th>
                      <th>Release Date</th>
                      <th className="centre">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feesToDisplay.length > 0 ? (
                      feesToDisplay.map((fee) => (
                        <tr
                          key={fee.id}
                          onClick={(e) => openInNewTab(`/gig/${fee.gigId}`, e)}
                        >
                          {isLgUp && (
                            <td>{formatFeeDate(fee.gigDate, 'short')}</td>
                          )}
                          <td>{fee.venueName}</td>
                          <td>£{fee.amount.toFixed(2)}</td>
                          <td>{formatFeeDate(fee.disputeClearingTime)}</td>
                          <td className={`status-box ${fee.status}`}>
                            <div className={`status ${fee.status}`}>
                              {fee.statusLabel || fee.status}
                            </div>
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


