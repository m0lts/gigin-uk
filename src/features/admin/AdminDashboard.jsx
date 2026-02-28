import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { TextLogoLink } from '@features/shared/ui/logos/Logos';
import {
  verifyAdminPassword,
  getAdminSignups,
  getAdminActivity,
  getAdminGigs,
  getAdminSpaceHire,
  getAdminArtists,
  getAdminVenues,
  getAdminErrors,
  deleteAdminErrors,
  getAdminOverview,
} from '@services/api/admin';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import '@assets/fonts/fonts.css';
import '@styles/shared/buttons.styles.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const ADMIN_EMAIL = 'hq.gigin@gmail.com';
const ADMIN_UNLOCK_KEY = 'gigin_admin_unlocked';

const PAGES = [
  { id: 'overview', label: 'Overview' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'gigs', label: 'Gigs' },
  { id: 'spaceHire', label: 'Venue hire' },
  { id: 'venues', label: 'Venues' },
  { id: 'artists', label: 'Artists' },
  { id: 'activity', label: 'Recent activity' },
  { id: 'errors', label: 'Errors' },
];

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [currentPage, setCurrentPage] = useState('overview');

  const [overview, setOverview] = useState(null);
  const [signups, setSignups] = useState([]);
  const [gigs, setGigs] = useState([]);
  const [venues, setVenues] = useState([]);
  const [spaceHire, setSpaceHire] = useState([]);
  const [artists, setArtists] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [errors, setErrors] = useState([]);
  const [deletingErrorId, setDeletingErrorId] = useState(null);
  const [selectedErrorIds, setSelectedErrorIds] = useState([]);
  const [deletingBatch, setDeletingBatch] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadedPages, setLoadedPages] = useState(new Set());
  const [error, setError] = useState(null);
  const [expandedGigId, setExpandedGigId] = useState(null);
  const [expandedSpaceHireId, setExpandedSpaceHireId] = useState(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_UNLOCK_KEY);
    if (stored === 'true') setUnlocked(true);
  }, []);

  const loadPage = (pageId) => {
    if (loadedPages.has(pageId)) return;
    setLoading(true);
    setError(null);
    const requests = {
      overview: () => getAdminOverview().then((r) => ({ overview: r })),
      accounts: () => getAdminSignups().then((r) => ({ signups: r?.signups ?? [] })),
      gigs: () => getAdminGigs().then((r) => ({ gigs: r?.gigs ?? [] })),
      venues: () => getAdminVenues().then((r) => ({ venues: r?.venues ?? [] })),
      spaceHire: () => getAdminSpaceHire().then((r) => ({ items: r?.items ?? [] })),
      artists: () => getAdminArtists().then((r) => ({ artists: r?.artists ?? [] })),
      activity: () => getAdminActivity().then((r) => ({ recentActivity: r?.recentActivity ?? [] })),
      errors: () => getAdminErrors().then((r) => ({ errors: r?.errors ?? [] })),
    };
    const fn = requests[pageId];
    if (!fn) {
      setLoading(false);
      return;
    }
    fn()
      .then((data) => {
        if (data.overview !== undefined) setOverview(data.overview);
        if (data.signups !== undefined) setSignups(data.signups);
        if (data.gigs !== undefined) setGigs(data.gigs);
        if (data.venues !== undefined) setVenues(data.venues);
        if (data.items !== undefined) setSpaceHire(data.items);
        if (data.artists !== undefined) setArtists(data.artists);
        if (data.recentActivity !== undefined) setRecentActivity(data.recentActivity);
        if (data.errors !== undefined) setErrors(data.errors);
        setLoadedPages((prev) => new Set(prev).add(pageId));
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load data');
        if (err?.status === 403) setUnlocked(false);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!user || !unlocked) return;
    loadPage(currentPage);
  }, [user, unlocked, currentPage]);

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    setPasswordError('');
    if (!password.trim()) {
      setPasswordError('Enter the admin password.');
      return;
    }
    setVerifying(true);
    verifyAdminPassword(password)
      .then(() => {
        sessionStorage.setItem(ADMIN_UNLOCK_KEY, 'true');
        setUnlocked(true);
        setPassword('');
      })
      .catch((err) => {
        setPasswordError(err?.message || 'Invalid password.');
      })
      .finally(() => setVerifying(false));
  };

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_UNLOCK_KEY);
    setUnlocked(false);
  };

  const tableWrap = (content) => (
    <div style={{ overflowX: 'auto', background: 'var(--gn-white)', borderRadius: 'var(--gn-border-radius)', boxShadow: '0 0 8px var(--gn-shadow)' }}>
      {content}
    </div>
  );

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: 'Inter, sans-serif',
    fontSize: 14,
  };
  const thStyle = { textAlign: 'left', padding: 12, fontWeight: 600, color: 'var(--gn-off-black)', background: 'var(--gn-grey-250)', borderBottom: '1px solid var(--gn-grey-350)' };
  const tdStyle = { padding: 12, borderBottom: '1px solid var(--gn-grey-300)' };

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gn-grey-200)' }}>
        <p style={{ fontFamily: 'Inter, sans-serif', color: 'var(--gn-off-black)' }}>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', padding: 24, background: 'var(--gn-grey-200)' }}>
        <header style={{ marginBottom: 24 }}>
          <TextLogoLink />
        </header>
        <div style={{ maxWidth: 400, margin: '0 auto', padding: 24, background: 'var(--gn-white)', borderRadius: 'var(--gn-border-radius)', boxShadow: '0 0 8px var(--gn-shadow)' }}>
          <h2 style={{ marginBottom: 12, fontFamily: 'Inter, sans-serif', color: 'var(--gn-off-black)' }}>Admin access</h2>
          <p style={{ color: 'var(--gn-grey-600)', marginBottom: 24 }}>You need to be signed in to view the admin dashboard.</p>
          <button type="button" className="btn primary" onClick={() => navigate('/')}>Go to home</button>
        </div>
      </div>
    );
  }

  if (user.email !== ADMIN_EMAIL) {
    return (
      <div style={{ minHeight: '100vh', padding: 24, background: 'var(--gn-grey-200)' }}>
        <header style={{ marginBottom: 24 }}>
          <TextLogoLink />
        </header>
        <div style={{ maxWidth: 400, margin: '0 auto', padding: 24, background: 'var(--gn-white)', borderRadius: 'var(--gn-border-radius)', boxShadow: '0 0 8px var(--gn-shadow)' }}>
          <h2 style={{ marginBottom: 12, fontFamily: 'Inter, sans-serif', color: 'var(--gn-off-black)' }}>Access denied</h2>
          <p style={{ color: 'var(--gn-grey-600)', marginBottom: 24 }}>This area is restricted to the admin account.</p>
          <button type="button" className="btn primary" onClick={() => navigate('/')}>Go to home</button>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div style={{ minHeight: '100vh', padding: 24, background: 'var(--gn-grey-200)' }}>
        <header style={{ marginBottom: 24 }}>
          <TextLogoLink />
        </header>
        <div style={{ maxWidth: 400, margin: '0 auto', padding: 24, background: 'var(--gn-white)', borderRadius: 'var(--gn-border-radius)', boxShadow: '0 0 8px var(--gn-shadow)' }}>
          <h2 style={{ marginBottom: 12, fontFamily: 'Inter, sans-serif', color: 'var(--gn-off-black)' }}>Admin password</h2>
          <p style={{ color: 'var(--gn-grey-600)', marginBottom: 24 }}>Enter the admin password to continue.</p>
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: 'var(--gn-btn-padding-y) var(--gn-btn-padding-x)',
                borderRadius: 'var(--gn-btn-border-radius)',
                border: '1px solid var(--gn-grey-350)',
                marginBottom: 12,
                fontFamily: 'Inter, sans-serif',
                fontSize: 14,
              }}
            />
            {passwordError && <p style={{ color: 'var(--gn-red)', marginBottom: 12, fontSize: 14 }}>{passwordError}</p>}
            <button type="submit" className="btn primary" disabled={verifying}>
              {verifying ? 'Checking…' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (loading && !loadedPages.has(currentPage)) {
      return <p style={{ color: 'var(--gn-grey-600)' }}>Loading…</p>;
    }

    if (currentPage === 'overview') {
      const tileStyle = {
        background: 'var(--gn-white)',
        borderRadius: 'var(--gn-border-radius)',
        boxShadow: '0 0 8px var(--gn-shadow)',
        padding: 20,
        minWidth: 0,
      };
      const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxRotation: 45, font: { size: 10 }, maxTicksLimit: 12 } },
          y: { beginAtZero: true, ticks: { stepSize: 1 } },
        },
      };
      // Monthly view: last 30 days, one point per day
      const buildThirtyDays = () => {
        const out = [];
        const now = new Date();
        for (let i = 29; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
          out.push({ date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, count: 0 });
        }
        return out;
      };
      const dayLabels = (daily) => (daily || []).map((d) => {
        const s = d.date || '';
        if (!s) return '';
        const [y, m, day] = s.split('-');
        if (!y || !m || !day) return '';
        const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(day, 10));
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      });
      const buildChartData = (daily) => {
        const skeleton = buildThirtyDays();
        const isDailyArray = Array.isArray(daily) && daily.length > 0 && daily.some((d) => d && typeof d.date === 'string');
        if (isDailyArray) {
          const byDate = new Map(daily.map((d) => [d.date, Number(d.count) || 0]));
          skeleton.forEach((row) => {
            const c = byDate.get(row.date);
            if (c !== undefined) row.count = c;
          });
        }
        return {
          labels: dayLabels(skeleton),
          datasets: [{
            data: skeleton.map((d) => d.count),
            borderColor: 'var(--gn-orange)',
            backgroundColor: 'rgba(255, 108, 75, 0.1)',
            fill: true,
            tension: 0.3,
            pointBackgroundColor: 'var(--gn-orange)',
          }],
        };
      };
      const d = overview || {};
      const tiles = [
        { title: 'Account signups', stat: d.accountSignups, key: 'accountSignups' },
        { title: 'Gigs & hire opportunities posted', stat: d.gigsAndHire, key: 'gigsAndHire' },
        { title: 'Venue signups', stat: d.venueSignups, key: 'venueSignups' },
        { title: 'Artist signups', stat: d.artistSignups, key: 'artistSignups' },
      ];
      return (
        <>
          <h2 style={{ marginBottom: 16, fontFamily: 'Inter, sans-serif', color: 'var(--gn-off-black)', fontSize: '1.25rem' }}>Overview</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {tiles.map(({ title, stat }) => {
              const s = stat || { thisWeek: 0, thisMonth: 0, overall: 0, daily: [] };
              return (
                <div key={title} style={tileStyle}>
                  <h3 style={{ marginBottom: 12, fontSize: '1rem', fontWeight: 600, color: 'var(--gn-off-black)' }}>{title}</h3>
                  <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--gn-grey-600)' }}>This week</div>
                      <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--gn-off-black)' }}>{s.thisWeek ?? 0}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--gn-grey-600)' }}>This month</div>
                      <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--gn-off-black)' }}>{s.thisMonth ?? 0}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--gn-grey-600)' }}>Overall</div>
                      <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--gn-off-black)' }}>{s.overall ?? 0}</div>
                    </div>
                  </div>
                  <div style={{ height: 200 }}>
                    <Line data={buildChartData(s.daily)} options={chartOptions} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      );
    }

    if (currentPage === 'accounts') {
      return (
        <>
          <h2 style={{ marginBottom: 16, fontFamily: 'Inter, sans-serif', color: 'var(--gn-off-black)', fontSize: '1.25rem' }}>Sign up history</h2>
          {tableWrap(
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Signed up</th>
                </tr>
              </thead>
              <tbody>
                {signups.length === 0 ? (
                  <tr><td colSpan={2} style={{ ...tdStyle, color: 'var(--gn-grey-600)' }}>No sign ups yet.</td></tr>
                ) : (
                  signups.map((s) => (
                    <tr key={s.uid}>
                      <td style={tdStyle}>{s.email || s.uid}</td>
                      <td style={{ ...tdStyle, color: 'var(--gn-grey-600)' }}>{formatDate(s.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </>
      );
    }

    if (currentPage === 'gigs') {
      return (
        <>
          <h2 style={{ marginBottom: 16, fontFamily: 'Inter, sans-serif', color: 'var(--gn-off-black)', fontSize: '1.25rem' }}>Posted gigs (newest first)</h2>
          {tableWrap(
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 32 }}></th>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Venue</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Budget</th>
                </tr>
              </thead>
              <tbody>
                {gigs.length === 0 ? (
                  <tr><td colSpan={6} style={{ ...tdStyle, color: 'var(--gn-grey-600)' }}>No gigs.</td></tr>
                ) : (
                  gigs.map((g) => {
                    const expanded = expandedGigId === g.gigId;
                    return (
                      <Fragment key={g.gigId}>
                        <tr
                          key={g.gigId}
                          onClick={() => setExpandedGigId(expanded ? null : g.gigId)}
                          style={{ cursor: 'pointer', background: expanded ? 'var(--gn-grey-250)' : undefined }}
                        >
                          <td style={tdStyle}>{expanded ? '▼' : '▶'}</td>
                          <td style={tdStyle}>{g.title || g.gigId}</td>
                          <td style={tdStyle}>{g.venue?.venueName ?? '—'}</td>
                          <td style={tdStyle}>{g.status || '—'}</td>
                          <td style={{ ...tdStyle, color: 'var(--gn-grey-600)' }}>{formatDate(g.date || g.startDateTime)}</td>
                          <td style={tdStyle}>{g.budget ?? '—'}</td>
                        </tr>
                        {expanded && (
                          <tr key={`${g.gigId}-detail`}>
                            <td colSpan={6} style={{ ...tdStyle, background: 'var(--gn-grey-100)', verticalAlign: 'top' }}>
                              <div style={{ padding: 16 }}>
                                <p style={{ marginBottom: 8, fontWeight: 600 }}>Full details</p>
                                <p><strong>Gig ID:</strong> {g.gigId}</p>
                                <p><strong>Venue ID:</strong> {g.venueId ?? '—'}</p>
                                <p><strong>Kind:</strong> {g.kind ?? '—'}</p>
                                <p><strong>Agreed fee:</strong> {g.agreedFee ?? '—'}</p>
                                <p><strong>Paid:</strong> {g.paid != null ? String(g.paid) : '—'}</p>
                                <p><strong>Created:</strong> {formatDate(g.createdAt)}</p>
                                <p><strong>Private:</strong> {g.private != null ? String(g.private) : '—'}</p>
                                <p style={{ marginTop: 12, marginBottom: 4, fontWeight: 600 }}>Applicants</p>
                                {(!g.applicants || g.applicants.length === 0) ? (
                                  <p style={{ color: 'var(--gn-grey-600)' }}>No applicants.</p>
                                ) : (
                                  <table style={{ ...tableStyle, marginTop: 8, fontSize: 13 }}>
                                    <thead>
                                      <tr>
                                        <th style={thStyle}>ID</th>
                                        <th style={thStyle}>Fee</th>
                                        <th style={thStyle}>Status</th>
                                        <th style={thStyle}>Type</th>
                                        <th style={thStyle}>Time</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {g.applicants.map((a, i) => (
                                        <tr key={i}>
                                          <td style={tdStyle}>{a.id || '—'}</td>
                                          <td style={tdStyle}>{a.fee ?? '—'}</td>
                                          <td style={tdStyle}>{a.status ?? '—'}</td>
                                          <td style={tdStyle}>{a.type ?? '—'}</td>
                                          <td style={{ ...tdStyle, color: 'var(--gn-grey-600)' }}>{formatDate(a.timestamp)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </>
      );
    }

    if (currentPage === 'venues') {
      return (
        <>
          <h2 style={{ marginBottom: 16, fontFamily: 'Inter, sans-serif', color: 'var(--gn-off-black)', fontSize: '1.25rem' }}>Venues</h2>
          {tableWrap(
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Venue name</th>
                  <th style={thStyle}>Venue ID</th>
                  <th style={thStyle}>Created by</th>
                  <th style={thStyle}>Gigs</th>
                  <th style={thStyle}>Created</th>
                </tr>
              </thead>
              <tbody>
                {venues.length === 0 ? (
                  <tr><td colSpan={5} style={{ ...tdStyle, color: 'var(--gn-grey-600)' }}>No venues.</td></tr>
                ) : (
                  venues.map((v) => (
                    <tr key={v.id}>
                      <td style={tdStyle}>{v.venueName || '—'}</td>
                      <td style={tdStyle}>{v.id}</td>
                      <td style={tdStyle}>{v.createdBy || '—'}</td>
                      <td style={tdStyle}>{v.gigCount ?? 0}</td>
                      <td style={{ ...tdStyle, color: 'var(--gn-grey-600)' }}>{formatDate(v.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </>
      );
    }

    if (currentPage === 'spaceHire') {
      return (
        <>
          <h2 style={{ marginBottom: 16, fontFamily: 'Inter, sans-serif', color: 'var(--gn-off-black)', fontSize: '1.25rem' }}>Space hire opportunities (newest first)</h2>
          {tableWrap(
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 32 }}></th>
                  <th style={thStyle}>Venue ID</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Hire fee</th>
                </tr>
              </thead>
              <tbody>
                {spaceHire.length === 0 ? (
                  <tr><td colSpan={5} style={{ ...tdStyle, color: 'var(--gn-grey-600)' }}>No space hire opportunities.</td></tr>
                ) : (
                  spaceHire.map((item) => {
                    const expanded = expandedSpaceHireId === item.id;
                    return (
                      <Fragment key={item.id}>
                        <tr
                          onClick={() => setExpandedSpaceHireId(expanded ? null : item.id)}
                          style={{ cursor: 'pointer', background: expanded ? 'var(--gn-grey-250)' : undefined }}
                        >
                          <td style={tdStyle}>{expanded ? '▼' : '▶'}</td>
                          <td style={tdStyle}>{item.venueId || '—'}</td>
                          <td style={tdStyle}>{item.status ?? '—'}</td>
                          <td style={{ ...tdStyle, color: 'var(--gn-grey-600)' }}>{formatDate(item.date)}</td>
                          <td style={tdStyle}>{item.hireFee ?? '—'}</td>
                        </tr>
                        {expanded && (
                          <tr key={`${item.id}-detail`}>
                            <td colSpan={5} style={{ ...tdStyle, background: 'var(--gn-grey-100)', verticalAlign: 'top' }}>
                              <div style={{ padding: 16 }}>
                                <p style={{ marginBottom: 8, fontWeight: 600 }}>Full details</p>
                                <p><strong>ID:</strong> {item.id}</p>
                                <p><strong>Created by:</strong> {item.createdByUserId ?? '—'}</p>
                                <p><strong>Start / end time:</strong> {item.startTime ?? '—'} – {item.endTime ?? '—'}</p>
                                <p><strong>Access from:</strong> {item.accessFrom ?? '—'}</p>
                                <p><strong>Curfew:</strong> {item.curfew ?? '—'}</p>
                                <p><strong>Deposit required:</strong> {item.depositRequired != null ? String(item.depositRequired) : '—'}</p>
                                <p><strong>Deposit amount:</strong> {item.depositAmount ?? '—'}</p>
                                <p><strong>Hirer type:</strong> {item.hirerType ?? '—'}</p>
                                <p><strong>Hirer name:</strong> {item.hirerName ?? '—'}</p>
                                <p><strong>Private:</strong> {item.private != null ? String(item.private) : '—'}</p>
                                <p><strong>Linked gig ID:</strong> {item.linkedGigId ?? '—'}</p>
                                <p><strong>Created:</strong> {formatDate(item.createdAt)}</p>
                                <p><strong>Updated:</strong> {formatDate(item.updatedAt)}</p>
                                {item.technicalSetup && (
                                  <p><strong>Technical setup:</strong> {JSON.stringify(item.technicalSetup)}</p>
                                )}
                                {item.performers && item.performers.length > 0 && (
                                  <p><strong>Performers:</strong> {JSON.stringify(item.performers)}</p>
                                )}
                                {item.notesInternal && <p><strong>Notes (internal):</strong> {item.notesInternal}</p>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </>
      );
    }

    if (currentPage === 'artists') {
      return (
        <>
          <h2 style={{ marginBottom: 16, fontFamily: 'Inter, sans-serif', color: 'var(--gn-off-black)', fontSize: '1.25rem' }}>Artist profiles</h2>
          {tableWrap(
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Profile ID</th>
                  <th style={thStyle}>User ID</th>
                  <th style={thStyle}>Location</th>
                  <th style={thStyle}>Created</th>
                </tr>
              </thead>
              <tbody>
                {artists.length === 0 ? (
                  <tr><td colSpan={5} style={{ ...tdStyle, color: 'var(--gn-grey-600)' }}>No artist profiles.</td></tr>
                ) : (
                  artists.map((a) => (
                    <tr key={a.id}>
                      <td style={tdStyle}>{a.name || '—'}</td>
                      <td style={tdStyle}>{a.id}</td>
                      <td style={tdStyle}>{a.userId || '—'}</td>
                      <td style={tdStyle}>{a.location ?? '—'}</td>
                      <td style={{ ...tdStyle, color: 'var(--gn-grey-600)' }}>{formatDate(a.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </>
      );
    }

    if (currentPage === 'activity') {
      return (
        <>
          <h2 style={{ marginBottom: 16, fontFamily: 'Inter, sans-serif', color: 'var(--gn-off-black)', fontSize: '1.25rem' }}>Recent app activity</h2>
          {tableWrap(
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Details</th>
                  <th style={thStyle}>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.length === 0 ? (
                  <tr><td colSpan={3} style={{ ...tdStyle, color: 'var(--gn-grey-600)' }}>No recent activity.</td></tr>
                ) : (
                  recentActivity.map((a) => (
                    <tr key={a.id}>
                      <td style={tdStyle}>{a.type || '—'}</td>
                      <td style={tdStyle}>
                        {a.venueId && `Venue: ${a.venueId} `}
                        {a.artistProfileId && `Artist: ${a.artistProfileId} `}
                        {a.memberUid && `Member: ${a.memberUid}`}
                        {!a.venueId && !a.artistProfileId && !a.memberUid && '—'}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--gn-grey-600)' }}>{formatDate(a.at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </>
      );
    }

    if (currentPage === 'errors') {
      const handleDeleteError = (errId) => {
        setDeletingErrorId(errId);
        deleteAdminErrors([errId])
          .then(() => {
            setErrors((prev) => prev.filter((e) => e.id !== errId));
            setSelectedErrorIds((prev) => prev.filter((id) => id !== errId));
          })
          .catch((err) => setError(err?.message || 'Failed to delete'))
          .finally(() => setDeletingErrorId(null));
      };
      const allSelected = errors.length > 0 && selectedErrorIds.length === errors.length;
      const toggleSelectAll = () => {
        setSelectedErrorIds(allSelected ? [] : errors.map((e) => e.id));
      };
      const toggleSelectOne = (id) => {
        setSelectedErrorIds((prev) =>
          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
      };
      const handleDeleteSelected = () => {
        if (selectedErrorIds.length === 0) return;
        setDeletingBatch(true);
        deleteAdminErrors(selectedErrorIds)
          .then(() => {
            setErrors((prev) => prev.filter((e) => !selectedErrorIds.includes(e.id)));
            setSelectedErrorIds([]);
          })
          .catch((err) => setError(err?.message || 'Failed to delete'))
          .finally(() => setDeletingBatch(false));
      };
      const categoriesWithCount = errors.length
        ? [...errors.reduce((acc, e) => {
            const c = e.category || 'Other';
            acc.set(c, (acc.get(c) || 0) + 1);
            return acc;
          }, new Map())].map(([category, count]) => ({ category, count })).sort((a, b) => a.category.localeCompare(b.category))
        : [];
      const selectCategory = (category) => {
        const ids = errors.filter((e) => (e.category || 'Other') === category).map((e) => e.id);
        setSelectedErrorIds((prev) => [...new Set([...prev, ...ids])]);
      };
      const deselectCategory = (category) => {
        const ids = errors.filter((e) => (e.category || 'Other') === category).map((e) => e.id);
        setSelectedErrorIds((prev) => prev.filter((id) => !ids.includes(id)));
      };
      return (
        <>
          <h2 style={{ marginBottom: 16, fontFamily: 'Inter, sans-serif', color: 'var(--gn-off-black)', fontSize: '1.25rem' }}>Client errors</h2>
          {categoriesWithCount.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <span style={{ marginRight: 8, color: 'var(--gn-grey-600)', fontSize: 14 }}>Select by category:</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {categoriesWithCount.map(({ category, count }) => (
                  <span key={category} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      className="btn secondary small"
                      onClick={() => selectCategory(category)}
                    >
                      Select all {category} ({count})
                    </button>
                    <button
                      type="button"
                      className="btn secondary-alt small"
                      onClick={() => deselectCategory(category)}
                    >
                      Deselect {category}
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
          {selectedErrorIds.length > 0 && (
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: 'var(--gn-grey-600)', fontSize: 14 }}>{selectedErrorIds.length} selected</span>
              <button
                type="button"
                className="btn danger small"
                disabled={deletingBatch}
                onClick={handleDeleteSelected}
              >
                {deletingBatch ? 'Deleting…' : 'Delete selected'}
              </button>
            </div>
          )}
          {tableWrap(
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 44 }}>
                    {errors.length > 0 && (
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    )}
                  </th>
                  <th style={thStyle}>Category</th>
                  <th style={thStyle}>Message</th>
                  <th style={thStyle}>Path</th>
                  <th style={thStyle}>Time</th>
                  <th style={{ ...thStyle, width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {errors.length === 0 ? (
                  <tr><td colSpan={6} style={{ ...tdStyle, color: 'var(--gn-grey-600)' }}>No errors logged.</td></tr>
                ) : (
                  errors.map((e) => (
                    <tr key={e.id}>
                      <td style={tdStyle}>
                        <input
                          type="checkbox"
                          checked={selectedErrorIds.includes(e.id)}
                          onChange={() => toggleSelectOne(e.id)}
                          aria-label={`Select error ${e.id}`}
                        />
                      </td>
                      <td style={tdStyle}>{e.category}</td>
                      <td style={{ ...tdStyle, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.message}>{e.message || '—'}</td>
                      <td style={{ ...tdStyle, color: 'var(--gn-grey-600)', fontSize: 12 }}>{e.path || '—'}</td>
                      <td style={{ ...tdStyle, color: 'var(--gn-grey-600)' }}>{formatDate(e.ts)}</td>
                      <td style={tdStyle}>
                        <button
                          type="button"
                          className="btn danger small"
                          disabled={deletingErrorId === e.id}
                          onClick={() => handleDeleteError(e.id)}
                        >
                          {deletingErrorId === e.id ? '…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </>
      );
    }

    return null;
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gn-grey-200)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 24, flexWrap: 'wrap', gap: 12, borderBottom: '1px solid var(--gn-grey-350)', background: 'var(--gn-white)' }}>
        <TextLogoLink />
        <button type="button" className="btn secondary" onClick={handleLogout}>Lock dashboard</button>
      </header>

      {error && (
        <div style={{ margin: 24, padding: 12, background: 'var(--gn-offset-red)', color: 'var(--gn-red)', borderRadius: 'var(--gn-btn-border-radius)' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside style={{ width: 220, flexShrink: 0, padding: 24, background: 'var(--gn-white)', borderRight: '1px solid var(--gn-grey-350)' }}>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {PAGES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`btn ${currentPage === p.id ? 'primary' : 'secondary-alt'}`}
                style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                onClick={() => setCurrentPage(p.id)}
              >
                {p.label}
              </button>
            ))}
          </nav>
        </aside>
        <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
