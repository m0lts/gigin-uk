import { useState } from 'react';
import { toast } from 'sonner';
import { updateUserDocument } from '@services/client-side/users';

export function ApplicationEmailToggle({ user }) {
  const [enabled, setEnabled] = useState(user?.emailNewApplications !== false);
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    if (!user?.uid || saving) return;
    const next = !enabled;
    setSaving(true);
    try {
      await updateUserDocument(user.uid, { emailNewApplications: next });
      setEnabled(next);
      toast.success(next ? 'Application emails on.' : 'Application emails off.');
    } catch (error) {
      console.error(error);
      toast.error('Failed to update email settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="password-settings">
      <h3>New applications:</h3>
      <div className="data-highlight">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '1rem' }}>
          <h4>Email me about new applications</h4>
          <label className="gigs-toggle-switch" style={{ cursor: saving ? 'not-allowed' : 'pointer' }}>
            <input type="checkbox" checked={enabled} onChange={toggle} disabled={saving} aria-label="Email me about new applications" />
            <span className="gigs-toggle-slider" />
          </label>
        </div>
      </div>
    </div>
  );
}
