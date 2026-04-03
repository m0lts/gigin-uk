import React from 'react';
import Portal from '@features/shared/components/Portal';
import { CloseIcon } from '@features/shared/ui/extras/Icons';
import '@styles/host/add-performers-modal.styles.css';

/**
 * Same "Add performers" button used in calendar popup and full-page gig details.
 * Use this when you need the button in multiple places (e.g. empty state + actions row) with one modal.
 */
export function AddPerformersButton({ onClick, className = '' }) {
  return (
    <button
      type="button"
      className={`btn tertiary add-performers-btn ${className}`.trim()}
      onClick={onClick}
    >
      + Add performers
    </button>
  );
}

/**
 * Add performers modal only. Use with AddPerformersButton when the button is needed in more than one place.
 * Optional: editMode + onSaveEdit for editing an existing performer's name (same UI, prefilled name, Save button).
 */
export function AddPerformersModal({
  isOpen,
  onClose,
  addPerformerQuery,
  setAddPerformerQuery,
  addPerformerShowCrmList,
  setAddPerformerShowCrmList,
  addPerformerSelectedIds,
  toggleCrmSelection,
  addPerformerSaving,
  onAddFromTextBox,
  onAddFromCrmList,
  crmLoading,
  filteredCrmEntries,
  noCrmMessage,
  editMode,
  onSaveEdit,
  onRemoveEdit,
}) {
  const hasQuery = (addPerformerQuery || '').trim();
  const isEdit = !!editMode;

  if (!isOpen) return null;

  return (
    <Portal>
      <div
        className="modal cancel-gig add-performers-modal"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-performers-title"
      >
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="add-performers-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 id="add-performers-title" style={{ margin: 0 }}>{isEdit ? 'Edit performer' : 'Add performers'}</h3>
            <button type="button" className="btn icon" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <div className="add-performers-search-wrap">
            <input
              type="text"
              className="input add-performers-input"
              value={addPerformerQuery}
              onChange={(e) => setAddPerformerQuery(e.target.value)}
              placeholder={isEdit ? 'Performer name' : 'Type artist name'}
              id="add-performers-search"
            />
          </div>
          <div className="add-performers-actions" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {!isEdit && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => setAddPerformerShowCrmList((v) => !v)}
              >
                {addPerformerShowCrmList ? 'Hide CRM list' : 'Add from CRM list'}
              </button>
            )}
            {isEdit ? (
              <>
                {onRemoveEdit && (
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => onRemoveEdit()}
                    disabled={addPerformerSaving}
                  >
                    Remove performer
                  </button>
                )}
                {hasQuery && (
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => onSaveEdit?.((addPerformerQuery || '').trim())}
                    disabled={addPerformerSaving}
                    style={{ marginLeft: 'auto' }}
                  >
                    Save
                  </button>
                )}
              </>
            ) : (
              hasQuery && (
                <button
                  type="button"
                  className="btn primary"
                  onClick={onAddFromTextBox}
                  disabled={addPerformerSaving}
                  style={{ marginLeft: 'auto' }}
                >
                  Add to gig
                </button>
              )
            )}
          </div>
          {!isEdit && addPerformerShowCrmList && (
            <div className="add-performers-crm-list-wrap">
              {crmLoading ? (
                <p className="add-performers-muted">Loading…</p>
              ) : filteredCrmEntries.length === 0 ? (
                <p className="add-performers-muted">{noCrmMessage}</p>
              ) : (
                <>
                  <p className="add-performers-muted" style={{ marginBottom: '0.5rem' }}>
                    Select one or more, then click Add to gig.
                  </p>
                  <ul className="add-performers-list">
                    {filteredCrmEntries.map((entry) => (
                      <li key={entry.id}>
                        <button
                          type="button"
                          className={`btn secondary add-performers-list-btn${addPerformerSelectedIds.includes(entry.id) ? ' add-performers-list-btn--selected' : ''}`}
                          onClick={() => toggleCrmSelection(entry.id)}
                          disabled={addPerformerSaving}
                        >
                          {entry.name || 'Unknown'}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {addPerformerSelectedIds.length > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <button
                        type="button"
                        className="btn primary"
                        onClick={onAddFromCrmList}
                        disabled={addPerformerSaving}
                      >
                        Add to gig ({addPerformerSelectedIds.length})
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

/**
 * Shared "Add performers" button + modal – same look and behaviour in calendar popup and full-page gig details.
 * Use this when there is a single button (e.g. calendar). For two buttons + one modal, use AddPerformersButton and AddPerformersModal separately.
 */
export function AddPerformersButtonAndModal({
  showButton,
  onOpen,
  isOpen,
  onClose,
  addPerformerQuery,
  setAddPerformerQuery,
  addPerformerShowCrmList,
  setAddPerformerShowCrmList,
  addPerformerSelectedIds,
  toggleCrmSelection,
  addPerformerSaving,
  onAddFromTextBox,
  onAddFromCrmList,
  crmLoading,
  filteredCrmEntries,
  noCrmMessage,
}) {
  const openModal = () => {
    setAddPerformerQuery('');
    setAddPerformerShowCrmList(false);
    onOpen();
  };

  return (
    <>
      {showButton && <AddPerformersButton onClick={openModal} />}
      <AddPerformersModal
        isOpen={isOpen}
        onClose={onClose}
        addPerformerQuery={addPerformerQuery}
        setAddPerformerQuery={setAddPerformerQuery}
        addPerformerShowCrmList={addPerformerShowCrmList}
        setAddPerformerShowCrmList={setAddPerformerShowCrmList}
        addPerformerSelectedIds={addPerformerSelectedIds}
        toggleCrmSelection={toggleCrmSelection}
        addPerformerSaving={addPerformerSaving}
        onAddFromTextBox={onAddFromTextBox}
        onAddFromCrmList={onAddFromCrmList}
        crmLoading={crmLoading}
        filteredCrmEntries={filteredCrmEntries}
        noCrmMessage={noCrmMessage}
      />
    </>
  );
}
