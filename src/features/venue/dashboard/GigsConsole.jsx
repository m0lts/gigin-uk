import { format } from 'date-fns';
import {
  SearchIcon,
  LinkIcon,
  InviteIconSolid,
  OptionsIcon,
  DownChevronIcon,
  RightChevronIcon,
  CloseIcon,
  EditIcon,
  DuplicateGigIcon,
  DeleteGigIcon,
  CancelIcon,
  TickIcon,
  GigIcon,
  TemplateIcon,
} from '@features/shared/ui/extras/Icons';
import { hasVenuePerm } from '../../../services/utils/permissions';
import { updateGigDocument } from '@services/api/gigs';
import Portal from '../../shared/components/Portal';
import { NewGigSplitButton } from './new-gig/NewGigSplitButton';
import { toast } from 'sonner';

const TILES = [
  { key: 'all', label: 'All upcoming', dot: '#0F1115' },
  { key: 'attention', label: 'Needs action', dot: '#FF6C4B' },
  { key: 'awaiting', label: 'Awaiting payment', dot: 'oklch(0.72 0.15 70)' },
  { key: 'confirmed', label: 'Confirmed', dot: 'oklch(0.66 0.14 150)' },
];

function baseGigName(group) {
  const name = group.primaryGig.gigName || '';
  return group.isGroup ? name.replace(/\s*\(Set\s+\d+\)\s*$/, '') : name;
}

const PILL_LABELS = {
  confirmed: 'Confirmed',
  awaiting: 'Awaiting payment',
  negotiating: 'Negotiating',
  open: 'Open for applications',
  closed: 'Closed',
  played: 'Played',
  expired: 'Expired · unbooked',
  dispute: 'In dispute',
};

function StatusPill({ pillKey }) {
  return (
    <span className={`gigs-console__pill gigs-console__pill--${pillKey}`}>
      <span className="gigs-console__pill-dot" />
      {PILL_LABELS[pillKey]}
    </span>
  );
}

function OptionsMenu({
  group,
  now,
  venues,
  navigateToGig,
  closeOptionsMenu,
  openEditGigModal,
  openSoundEditor,
  openNotesEditor,
  setGroupVisibility,
  setSelectedGigs,
  setConfirmType,
  setConfirmModal,
  setConfirmMessage,
  handleCloneAsTemplate,
  refreshGigs,
}) {
  const gig = group.primaryGig;
  const canUpdate = hasVenuePerm(venues, gig.venueId, 'gigs.update');
  const canCreate = hasVenuePerm(venues, gig.venueId, 'gigs.create');
  const isFuture = gig.dateTime > now;
  const blocked = gig.status === 'confirmed' || gig.status === 'accepted' || gig.status === 'awaiting payment';
  const hasAccepted = gig?.applicants?.some((applicant) => applicant.status === 'accepted' || applicant.status === 'confirmed');

  return (
    <div className="gigs-console__options options-cell" onClick={(event) => event.stopPropagation()}>
      <button type="button" onClick={() => { closeOptionsMenu(); navigateToGig(group); }}>View Details <GigIcon /></button>
      {isFuture && (gig.status === 'open' || gig.status === 'upcoming') && !hasAccepted && canUpdate && (
        <button type="button" onClick={() => {
          if (!canCreate) toast.error('You do not have permission to duplicate this gig.');
          closeOptionsMenu();
          openEditGigModal(gig);
        }}>Edit <EditIcon /></button>
      )}
      {canUpdate && (
        <button type="button" onClick={(event) => openSoundEditor(group, event.currentTarget)}>Edit sound manager</button>
      )}
      {canUpdate && (
        <button type="button" onClick={(event) => openNotesEditor(group, event.currentTarget)}>Edit notes</button>
      )}
      {isFuture && canUpdate && (
        <button type="button" onClick={() => { closeOptionsMenu(); setGroupVisibility(group, !gig.private); }}>
          {gig.private ? 'Make public' : 'Make invite only'}
        </button>
      )}
      {isFuture && canCreate && (
        <button type="button" onClick={() => {
          closeOptionsMenu();
          setSelectedGigs(group.gigIds);
          setConfirmType('duplicate');
          setConfirmModal(true);
          setConfirmMessage('Duplicate this gig? The new gig will have no applicants.');
        }}>Duplicate <DuplicateGigIcon /></button>
      )}
      {isFuture && !blocked && canUpdate && (
        <button type="button" onClick={async () => {
          closeOptionsMenu();
          const newStatus = (gig.status === 'open' || gig.status === 'upcoming') ? 'closed' : 'open';
          try {
            await Promise.all(group.gigIds.map((id) => updateGigDocument({
              gigId: id,
              action: 'gigs.applications.manage',
              updates: { status: newStatus },
            })));
            toast.success(`Gig ${newStatus === 'open' ? 'Opened for Applications' : 'Closed from Applications'}`);
            refreshGigs();
          } catch (error) {
            console.error('Error updating status:', error);
            toast.error('Failed to update gig status.');
          }
        }}>
          {(gig.status === 'open' || gig.status === 'upcoming') ? 'Close Gig' : 'Reopen Gig'}
          {(gig.status === 'open' || gig.status === 'upcoming') ? <CloseIcon /> : <TickIcon />}
        </button>
      )}
      {canCreate && (
        <button type="button" onClick={() => { closeOptionsMenu(); handleCloneAsTemplate(gig); }}>
          Make Gig a Template <TemplateIcon />
        </button>
      )}
      {isFuture && !blocked && canUpdate ? (
        <button type="button" className="is-danger" onClick={() => {
          closeOptionsMenu();
          setSelectedGigs(group.gigIds);
          setConfirmType('delete');
          setConfirmModal(true);
          setConfirmMessage('Are you sure you want to delete this gig? This action cannot be undone.');
        }}>Delete <DeleteGigIcon /></button>
      ) : isFuture && gig.status === 'confirmed' && canUpdate && (
        <button type="button" className="is-danger" onClick={() => {
          closeOptionsMenu();
          setSelectedGigs(group.gigIds);
          setConfirmType('cancel');
          setConfirmModal(true);
          setConfirmMessage('Are you sure you want to cancel this gig?');
        }}>Cancel <CancelIcon /></button>
      )}
    </div>
  );
}

function GigCells({ row, past, groupTimeLabel, copiedGigId, copyGigLinkQuiet, venues, setSelectedGigForInvites, setShowInvitesModal }) {
  const { group, slotsBooked, totalApplicants, newApplicants, pill } = row;
  const gig = group.primaryGig;
  const names = group.allGigs.map((slot) => {
    const apps = Array.isArray(slot.applicants) ? slot.applicants : [];
    const confirmed = apps.find((applicant) => applicant?.status === 'confirmed');
    return confirmed?.name || confirmed?.artistName || slot.artistName || '';
  }).filter(Boolean);
  const booked = slotsBooked.filter(Boolean).length;
  const showShare = !past && pill !== 'confirmed';
  const canInvite = hasVenuePerm(venues, gig.venueId, 'gigs.invite');

  return (
    <>
      <span className="gigs-console__date">{gig.dateObj ? format(gig.dateObj, 'EEE dd MMM').toUpperCase() : '—'}</span>
      <span className="gigs-console__time">{groupTimeLabel(group)}</span>
      <span className="gigs-console__gig">
        <span className="gigs-console__gig-name">{baseGigName(group)}</span>
        {!past && group.isGroup && group.allGigs.length > 1 && (
          <span className="gigs-console__sets">{group.allGigs.length} sets</span>
        )}
      </span>
      <span className="gigs-console__lineup">
        {past ? (
          <span className="gigs-console__lineup-name">{names.length ? names.join(', ') : 'Unbooked'}</span>
        ) : (
          <>
            <span className="gigs-console__bars">
              {slotsBooked.map((isBooked, index) => (
                <span key={index} className={`gigs-console__slot${isBooked ? ' is-booked' : ''}`} />
              ))}
            </span>
            <span className="gigs-console__ratio">{booked}/{slotsBooked.length}</span>
          </>
        )}
      </span>
      <span className="gigs-console__apps">
        <span className="gigs-console__apps-count">{totalApplicants}</span>
        {!past && newApplicants > 0 && <span className="gigs-console__badge">{newApplicants} new</span>}
      </span>
      {past ? <span /> : (
        <span className="gigs-console__visibility">{gig.private ? 'Invite only' : 'Public'}</span>
      )}
      <StatusPill pillKey={pill} />
      <span className="gigs-console__share" onClick={(event) => event.stopPropagation()}>
        {!showShare && <span className="gigs-console__dash">—</span>}
        {showShare && !gig.private && (
          <button type="button" className="gigs-console__share-btn" onClick={() => copyGigLinkQuiet(gig)}>
            <LinkIcon />
            {copiedGigId === gig.gigId ? 'Copied' : 'Copy link'}
          </button>
        )}
        {showShare && gig.private && (
          <button
            type="button"
            className="gigs-console__share-btn"
            disabled={!canInvite}
            title={canInvite ? 'Create invite link' : 'You do not have permission to create invites'}
            onClick={() => {
              if (!canInvite) {
                toast.error('You do not have permission to perform this action.');
                return;
              }
              setSelectedGigForInvites(gig);
              setShowInvitesModal(true);
            }}
          >
            <InviteIconSolid />
            Invite
          </button>
        )}
      </span>
    </>
  );
}

export function GigsConsole({
  gigsView,
  setGigsView,
  searchQuery,
  onSearchChange,
  searchInputRef,
  venues,
  selectedVenue,
  venueSwitcherLabel,
  updateUrlParams,
  venueMenuOpen,
  setVenueMenuOpen,
  venueMenuRef,
  newGigMenuOpen,
  setNewGigMenuOpen,
  newGigMenuRef,
  openNewGig,
  openManageTemplatesModal,
  canShowTemplatesButton,
  consoleRows,
  consoleStatusKey,
  selectedCount,
  allFutureSelected,
  toggleSelectAllFuture,
  toggleGroupSelection,
  groupIsSelected,
  clearSelection,
  groupTimeLabel,
  copiedGigId,
  copyGigLinkQuiet,
  navigateToGig,
  showPast,
  setShowPast,
  openOptionsGigId,
  toggleOptionsMenu,
  closeOptionsMenu,
  optionsMenuPos,
  setGroupVisibility,
  openSoundEditor,
  openNotesEditor,
  openEditGigModal,
  setSelectedGigs,
  setConfirmType,
  setConfirmModal,
  setConfirmMessage,
  handleCloneAsTemplate,
  refreshGigs,
  handleDuplicateSelected,
  handleBulkMakeTemplate,
  handleBulkInviteOnly,
  setShowInvitesModal,
  setSelectedGigForInvites,
  now,
  calendarView,
  editingSoundManager,
  soundManagerValue,
  setSoundManagerValue,
  soundManagerPosition,
  handleSaveSoundManager,
  setEditingSoundManager,
  editingNotes,
  notesValue,
  setNotesValue,
  notesPosition,
  handleSaveNotes,
  setEditingNotes,
}) {
  const rows = consoleRows || { future: [], past: [], counts: { all: 0, attention: 0, awaiting: 0, confirmed: 0 } };
  const openRow = [...rows.future, ...rows.past].find((row) => row.group.primaryGig.gigId === openOptionsGigId);
  const emptyAll = consoleStatusKey === 'all' && searchQuery.trim() === '' && rows.future.length === 0 && rows.counts.all === 0;

  return (
    <div className="gigs-console">
      <header className="gigs-console__bar">
        <div className="gigs-console__bar-left">
          <h1 className="gigs-console__title">Gigs</h1>
          <span className="gigs-console__divider" aria-hidden="true" />
          <div className="gigs-console__venue-wrap" ref={venueMenuRef}>
            {venues.length > 1 ? (
              <button
                type="button"
                className="gigs-console__venue"
                aria-expanded={venueMenuOpen}
                onClick={() => setVenueMenuOpen((open) => !open)}
              >
                {venueSwitcherLabel}
                <DownChevronIcon />
              </button>
            ) : (
              <span className="gigs-console__venue gigs-console__venue--static">{venueSwitcherLabel}</span>
            )}
            {venueMenuOpen && venues.length > 1 && (
              <div className="gigs-console__pop" role="listbox">
                <button type="button" className={!selectedVenue ? 'is-selected' : ''} onClick={() => { updateUrlParams('venue', ''); setVenueMenuOpen(false); }}>All venues</button>
                {venues.map((venue) => (
                  <button
                    type="button"
                    key={venue.venueId}
                    className={selectedVenue === venue.venueId ? 'is-selected' : ''}
                    onClick={() => { updateUrlParams('venue', venue.venueId); setVenueMenuOpen(false); }}
                  >
                    {venue.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="gigs-console__bar-right">
          <label className="gigs-console__search">
            <SearchIcon />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={onSearchChange}
              placeholder="Search gigs, artists…"
              aria-label="Search gigs, artists"
            />
            <kbd>/</kbd>
          </label>
          <div className="gigs-console__views" role="group" aria-label="Gigs view">
            <button type="button" className={gigsView === 'react' ? 'is-active' : ''} aria-pressed={gigsView === 'react'} onClick={() => setGigsView('react')}>Calendar</button>
            <button type="button" className={gigsView === 'table' ? 'is-active' : ''} aria-pressed={gigsView === 'table'} onClick={() => setGigsView('table')}>Table</button>
          </div>
          {canShowTemplatesButton && (
            <button type="button" className="gigs-console__secondary" onClick={openManageTemplatesModal}>Templates</button>
          )}
          <NewGigSplitButton
            onOpen={openNewGig}
            legacyHire={() => openNewGig({ legacy: true, kind: 'bookNew', entry: 'menu' })}
          />
        </div>
      </header>
      <div className="gigs-console__frame">
        {gigsView === 'react' ? calendarView : (
          <div className="gigs-console__content">
            <>
              <div className="gigs-console__tiles">
                {TILES.map((tile) => (
                  <button
                    key={tile.key}
                    type="button"
                    className={`gigs-console__tile${consoleStatusKey === tile.key ? ' is-selected' : ''}`}
                    onClick={() => updateUrlParams('status', tile.key === 'all' ? 'all' : tile.key)}
                  >
                    <span className="gigs-console__tile-label">
                      <span className="gigs-console__tile-dot" style={{ background: tile.dot }} />
                      {tile.label}
                    </span>
                    <span className="gigs-console__tile-count">{rows.counts[tile.key]}</span>
                  </button>
                ))}
              </div>
              <div className="gigs-console__card">
                <div className="gigs-console__head" role="row">
                  <span>
                    <input
                      type="checkbox"
                      className="gigs-check"
                      checked={allFutureSelected}
                      onChange={toggleSelectAllFuture}
                      aria-label="Select all upcoming gigs"
                    />
                  </span>
                  <span>Date</span>
                  <span>Time</span>
                  <span>Gig</span>
                  <span>Line-up</span>
                  <span>Applications</span>
                  <span>Visibility</span>
                  <span>Status</span>
                  <span>Share</span>
                  <span />
                </div>
                {rows.future.length === 0 ? (
                  <div className="gigs-console__empty">
                    <p>{emptyAll ? 'No upcoming gigs yet' : 'No gigs match this filter.'}</p>
                    {emptyAll && (
                      <button type="button" className="gigs-console__primary" onClick={() => openNewGig({ route: 'full', entry: 'default', kind: 'bookNew' })}>New gig</button>
                    )}
                  </div>
                ) : rows.future.map((row) => {
                  const selected = groupIsSelected(row.group);
                  return (
                    <div
                      key={row.group.primaryGig.gigId}
                      className={`gigs-console__row${selected ? ' is-selected' : ''}`}
                      role="row"
                      onClick={() => navigateToGig(row.group)}
                    >
                      <span onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="gigs-check"
                          checked={selected}
                          onChange={() => toggleGroupSelection(row.group)}
                          aria-label={`Select ${baseGigName(row.group)}`}
                        />
                      </span>
                      <GigCells
                        row={row}
                        groupTimeLabel={groupTimeLabel}
                        copiedGigId={copiedGigId}
                        copyGigLinkQuiet={copyGigLinkQuiet}
                        venues={venues}
                        setSelectedGigForInvites={setSelectedGigForInvites}
                        setShowInvitesModal={setShowInvitesModal}
                      />
                      <span className="gigs-console__more" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          className={openOptionsGigId === row.group.primaryGig.gigId ? 'is-open' : ''}
                          aria-label="Gig options"
                          onClick={(event) => toggleOptionsMenu(row.group.primaryGig.gigId, event.currentTarget)}
                        >
                          <OptionsIcon />
                        </button>
                      </span>
                    </div>
                  );
                })}
                <button
                  type="button"
                  className={`gigs-console__past${showPast ? ' is-open' : ''}`}
                  onClick={() => setShowPast((open) => !open)}
                  aria-expanded={showPast}
                >
                  <RightChevronIcon />
                  <span>Past gigs</span>
                  <span className="gigs-console__past-count">{rows.past.length}</span>
                </button>
                {showPast && rows.past.map((row) => (
                  <div
                    key={row.group.primaryGig.gigId}
                    className="gigs-console__row gigs-console__row--past"
                    role="row"
                    onClick={() => navigateToGig(row.group)}
                  >
                    <span />
                    <GigCells
                      row={row}
                      past
                      groupTimeLabel={groupTimeLabel}
                      copiedGigId={copiedGigId}
                      copyGigLinkQuiet={copyGigLinkQuiet}
                      venues={venues}
                      setSelectedGigForInvites={setSelectedGigForInvites}
                      setShowInvitesModal={setShowInvitesModal}
                    />
                    <span className="gigs-console__more" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        aria-label="Gig options"
                        onClick={(event) => toggleOptionsMenu(row.group.primaryGig.gigId, event.currentTarget)}
                      >
                        <OptionsIcon />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </>
          </div>
        )}
        {gigsView === 'table' && selectedCount > 0 && (
          <div className="gigs-console__bulk">
            <span className="gigs-console__bulk-count">{selectedCount} selected</span>
            <button type="button" onClick={handleDuplicateSelected}>Duplicate</button>
            <button type="button" onClick={handleBulkMakeTemplate}>Make template</button>
            <button type="button" onClick={handleBulkInviteOnly}>Set invite only</button>
            <button
              type="button"
              className="is-danger"
              onClick={() => {
                setConfirmType('delete');
                setConfirmModal(true);
                setConfirmMessage(selectedCount > 1
                  ? 'Are you sure you want to delete these gigs? This action cannot be undone.'
                  : 'Are you sure you want to delete this gig? This action cannot be undone.');
              }}
            >Delete</button>
            <span className="gigs-console__bulk-divider" aria-hidden="true" />
            <button type="button" className="gigs-console__bulk-close" aria-label="Clear selection" onClick={clearSelection}>×</button>
          </div>
        )}
      </div>
      {openRow && optionsMenuPos && (
        <Portal>
          <div style={{ position: 'fixed', top: optionsMenuPos.top, left: optionsMenuPos.left, transform: 'translateX(-100%)', zIndex: 40 }}>
            <OptionsMenu
              group={openRow.group}
              now={now}
              venues={venues}
              navigateToGig={navigateToGig}
              closeOptionsMenu={closeOptionsMenu}
              openEditGigModal={openEditGigModal}
              openSoundEditor={openSoundEditor}
              openNotesEditor={openNotesEditor}
              setGroupVisibility={setGroupVisibility}
              setSelectedGigs={setSelectedGigs}
              setConfirmType={setConfirmType}
              setConfirmModal={setConfirmModal}
              setConfirmMessage={setConfirmMessage}
              handleCloneAsTemplate={handleCloneAsTemplate}
              refreshGigs={refreshGigs}
            />
          </div>
        </Portal>
      )}
      {editingSoundManager && (
        <div className="sound-manager-editor" style={{ top: soundManagerPosition.top, left: soundManagerPosition.left }} onClick={(event) => event.stopPropagation()}>
          <h4>Sound Manager</h4>
          <textarea
            className="sound-manager-textarea"
            value={soundManagerValue}
            onChange={(event) => setSoundManagerValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') { setEditingSoundManager(null); setSoundManagerValue(''); }
            }}
            autoFocus
          />
          <div className="sound-manager-editor-actions">
            <button type="button" className="btn tertiary" onClick={() => { setEditingSoundManager(null); setSoundManagerValue(''); }}>Cancel</button>
            <button type="button" className="btn primary" onClick={() => {
              const group = [...rows.future, ...rows.past].find((row) => row.group.primaryGig.gigId === editingSoundManager);
              handleSaveSoundManager(editingSoundManager, group?.group.primaryGig.venueId);
            }}>Save</button>
          </div>
        </div>
      )}
      {editingNotes && (
        <div className="notes-editor" style={{ top: notesPosition.top, left: notesPosition.left }} onClick={(event) => event.stopPropagation()}>
          <h4>Notes</h4>
          <textarea
            className="notes-textarea"
            value={notesValue}
            onChange={(event) => setNotesValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') { setEditingNotes(null); setNotesValue(''); }
            }}
            autoFocus
          />
          <div className="notes-editor-actions">
            <button type="button" className="btn tertiary" onClick={() => { setEditingNotes(null); setNotesValue(''); }}>Cancel</button>
            <button type="button" className="btn primary" onClick={() => {
              const group = [...rows.future, ...rows.past].find((row) => row.group.primaryGig.gigId === editingNotes);
              handleSaveNotes(editingNotes, group?.group.primaryGig.venueId);
            }}>Save</button>
          </div>
        </div>
      )}
    </div>
  );
}
