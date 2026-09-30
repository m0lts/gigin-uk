import { useEffect, useState } from 'react';
import '@styles/shared/modals.styles.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBolt, faChevronDown, faFileLines, faListOl } from '@fortawesome/free-solid-svg-icons';
import { readLastNewGigRoute, writeLastNewGigRoute } from './useNewGigDraft';

const ROUTES = [
  { key: 'quick', title: 'Quick create', description: 'Four fields in a side panel. Fill in the rest later.', icon: faBolt },
  { key: 'full', title: 'Full form', description: 'Everything on one page, with a live preview of the listing.', icon: faFileLines },
  { key: 'wizard', title: 'Step by step', description: 'One question at a time. Good for your first gig.', icon: faListOl },
];

export function NewGigSplitButton({ onOpen, legacyHire }) {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState(readLastNewGigRoute);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const choose = (route, entry) => {
    setLast(route);
    writeLastNewGigRoute(route);
    setOpen(false);
    onOpen({ route, entry });
  };

  return (
    <div className="ng-split" onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" className="ng-split__main" onClick={() => choose(last, 'default')}>New gig</button>
      <button type="button" className="ng-split__more" aria-label="Choose how to create a gig" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <FontAwesomeIcon icon={faChevronDown} />
      </button>
      {open && (
        <div className="ng-split__menu" role="menu">
          {ROUTES.map((route) => (
            <button key={route.key} type="button" role="menuitem" onClick={() => choose(route.key, 'menu')}>
              <span className="ng-split__glyph"><FontAwesomeIcon icon={route.icon} /></span>
              <span>
                <strong>{route.title}</strong>
                <em>{route.description}</em>
              </span>
              {last === route.key && <span className="ng-split__tag">Default</span>}
            </button>
          ))}
          {legacyHire && (
            <button type="button" role="menuitem" onClick={() => { setOpen(false); legacyHire(); }}>
              <span className="ng-split__glyph">£</span>
              <span>
                <strong>Venue hire</strong>
                <em>Someone pays you for the room.</em>
              </span>
            </button>
          )}
          <p>New gig opens whichever you used last.</p>
        </div>
      )}
    </div>
  );
}
