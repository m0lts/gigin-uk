import { ContactRadios, CloseButton, dateChip, FeeField, KindCards, TimeField, paymentsOn } from './newGigBits';

export function NewGigQuickDrawer({
  draft,
  patch,
  templates,
  contacts,
  submitting,
  onClose,
  onCreate,
  onFullForm,
}) {
  const date = draft.dates[0];
  const feeName = draft.kind === 'booked' ? 'Agreed fee' : 'Fee offered';
  return (
    <div className="ng-backdrop ng-backdrop--drawer" onClick={onClose}>
      <aside className="ng-drawer" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="New gig">
        <header className="ng-drawer__head">
          <div>
            <h2>New gig</h2>
            {date && <span className="ng-mono">{dateChip(date)}</span>}
          </div>
          <CloseButton onClick={onClose} />
        </header>
        <div className="ng-drawer__body">
          <section>
            <div className="ng-label">Start from</div>
            <div className="ng-pills">
              <button type="button" className={!draft.templateId ? 'is-on' : ''} onClick={() => patch({ templateId: '' })}>Blank</button>
              {templates.map((template) => {
                const id = template.templateId || template.id;
                return (
                  <button key={id} type="button" className={draft.templateId === id ? 'is-on' : ''} onClick={() => patch({ applyTemplate: template })}>
                    {template.name || template.templateName || 'Template'}
                  </button>
                );
              })}
            </div>
          </section>
          <section>
            <div className="ng-label">Have you already booked someone?</div>
            <KindCards kind={draft.kind} onChange={(kind) => patch({ kind })} />
          </section>
          {draft.kind === 'booked' && (
            <section>
              <div className="ng-label">Who?</div>
              <ContactRadios
                contacts={contacts}
                artistId={draft.artistId}
                onPick={(contact) => patch({ artistId: contact.id || contact.artistId, artistName: contact.name })}
              />
            </section>
          )}
          <section className="ng-three">
            <TimeField label="Starts" value={draft.start} onChange={(start) => patch({ start })} />
            <TimeField label="Ends" value={draft.end} onChange={(end) => patch({ end })} />
            {paymentsOn() && <FeeField label={feeName} value={draft.fee} onChange={(fee) => patch({ fee })} />}
          </section>
          <div className="ng-note">
            <span>i</span>
            <p>
              {draft.sets.length > 1
                ? `This template has ${draft.sets.length} sets. Times and fees are filled in. You can change them in the full form.`
                : draft.kind === 'booked'
                  ? 'They’ll be confirmed on the calendar. You can add load-in, a description and sets afterwards.'
                  : 'Nobody can see this yet. After you create it, offer it to artists you know or publish the listing.'}
            </p>
          </div>
        </div>
        <footer className="ng-drawer__foot">
          <button type="button" className="ng-primary" disabled={submitting} onClick={onCreate}>
            {draft.kind === 'booked' ? 'Add to calendar' : 'Create gig'}
          </button>
          <button type="button" className="ng-text" onClick={onFullForm}>Use the full form instead</button>
        </footer>
      </aside>
    </div>
  );
}
