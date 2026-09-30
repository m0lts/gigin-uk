import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { httpClient } from '@services/http/client';

export function ContactMergeSuggestions({ onMerged }) {
  const [suggestions, setSuggestions] = useState([]);
  const [busyId, setBusyId] = useState('');

  const load = () => {
    httpClient.get('/contact-links/suggestions')
      .then((data) => setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []))
      .catch(() => setSuggestions([]));
  };

  useEffect(() => { load(); }, []);

  if (!suggestions.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
      {suggestions.map((item) => (
        <div key={item.crmEntryId} style={{ border: '1px solid #E5E7EB', borderRadius: 12, padding: 12 }}>
          <p style={{ margin: '0 0 8px' }}>
            This looks like <strong>{item.matchName}</strong>: merge?
          </p>
          <button
            type="button"
            className="btn primary"
            disabled={busyId === item.crmEntryId}
            onClick={async () => {
              setBusyId(item.crmEntryId);
              try {
                await httpClient.post('/contact-links/merge', {
                  body: { crmEntryId: item.crmEntryId, artistId: item.matchArtistId },
                });
                toast.success('Contacts merged.');
                setSuggestions((current) => current.filter((row) => row.crmEntryId !== item.crmEntryId));
                onMerged?.();
              } catch (err) {
                console.error(err);
                toast.error('Could not merge those contacts.');
              } finally {
                setBusyId('');
              }
            }}
          >
            Merge
          </button>
        </div>
      ))}
    </div>
  );
}
