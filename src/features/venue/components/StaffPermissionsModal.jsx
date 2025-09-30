// src/features/venue/components/StaffPermissionsModal.jsx
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PERMS_DISPLAY, PERM_DEFAULTS } from "@services/utils/permissions";
import { LeftArrowIcon, RightChevronIcon, SettingsIcon } from "../../shared/ui/extras/Icons";
import { LoadingSpinner } from "../../shared/ui/loading/Loading";
import { removeVenueMember, updateVenueMemberPermissions } from "../../../services/functions";
import { fetchVenueMembersWithUsers } from "../../../services/function-calls/venues";
import { normalizePermissions } from "../../../services/utils/permissions";

function formatWhen(ts) {
    if (!ts) return "—";
    const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

export const StaffPermissionsModal = ({ user, venue, onClose }) => {
    const [stage, setStage] = useState("select");
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState([]);
    const [selectedUid, setSelectedUid] = useState("");
    const [permissions, setPermissions] = useState({ ...PERM_DEFAULTS });
    const [saving, setSaving] = useState(false);
    const [removing, setRemoving] = useState(false);
  
    const selectedMember = useMemo(
      () => members.find((m) => m.uid === selectedUid) || null,
      [members, selectedUid]
    );
  
    // Load members on open
    useEffect(() => {
        let cancelled = false;
        async function run() {
          if (!venue?.venueId) return;
          try {
            setLoading(true);
            const list = await fetchVenueMembersWithUsers(venue.venueId);
            const filtered = list.filter(
              (m) => m.role !== "owner" && m.uid !== user.uid
            );
            if (!cancelled) setMembers(filtered);
          } catch (e) {
            console.error("Failed to load venue members:", e);
            if (!cancelled) toast.error("Failed to load members.");
          } finally {
            if (!cancelled) setLoading(false);
          }
        }
        run();
        return () => { cancelled = true; };
      }, [venue?.venueId, user?.uid]);
  
    const startEdit = (member) => {
      setSelectedUid(member.uid);
      setPermissions(normalizePermissions(member.permissions));
      setStage("edit");
    };
  
    const togglePerm = (key) =>
      setPermissions((p) => ({ ...p, [key]: !p[key] }));
  
    const handleSave = async () => {
      if (!selectedUid || !venue?.venueId) return;
      const prev = members;
      try {
        setLoading(true);
        setSaving(true);
        await updateVenueMemberPermissions(venue.venueId, selectedUid, permissions);
        toast.success("Permissions updated.");
        setMembers((prev) =>
          prev.map((m) =>
            m.uid === selectedUid ? { ...m, permissions: { ...permissions } } : m
          )
        );
        setStage("select");
      } catch (err) {
        setMembers(prev)
        console.error("Error updating permissions:", err);
        toast.error("Failed to update permissions.");
      } finally {
        setLoading(false);
        setSaving(false);
      }
    };
  
    const handleRemove = async () => {
      if (!selectedUid || !venue?.venueId) return;
      if (selectedUid === user?.uid) {
        toast.error("You can’t remove yourself here.");
        return;
      }
      if (!confirm("Are you sure?")) return;
      const prev = members;
      try {
        setLoading(true);
        setRemoving(true);
        await removeVenueMember(venue.venueId, selectedUid);
        toast.success("Member removed.");
        setMembers((prev) => prev.filter((m) => m.uid !== selectedUid));
        setSelectedUid("");
        setPermissions({ ...PERM_DEFAULTS });
        setStage("select");
      } catch (err) {
        setMembers(prev)
        console.error("Error removing member:", err);
        toast.error("Failed to remove member.");
      } finally {
        setLoading(false);
        setRemoving(false);
      }
    };
  
    const headerTitle =
      stage === "edit"
        ? `Edit Permissions — ${selectedMember?.user?.name || selectedMember?.user?.displayName || selectedMember?.user?.email || selectedUid}`
        : `Edit Staff Permissions`;
  
    return (
      <div className="modal staff-permissions" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <SettingsIcon />
            <h2>{headerTitle}</h2>
            {stage === "select" ? (
              <p>Select a staff member to edit permissions or remove them.</p>
            ) : stage === "edit" && (
                <button
                    className="btn text back"
                    onClick={() => setStage("select")}
                    disabled={saving || removing}
                >
                    <LeftArrowIcon />
                    Back To Staff Members
                </button>
            )}
          </div>
  
          <div className="modal-body">
            {loading ? (
              <LoadingSpinner marginTop={"2rem"} />
            ) : stage === "select" ? (
              <>
                {members.length === 0 ? (
                  <p>No staff members yet.</p>
                ) : (
                  <ul className="member-list">
                    {members.map((m) => {
                      const displayName =
                        m.user?.name ||
                        m.user?.displayName ||
                        m.user?.email ||
                        m.uid;
                      const addedAt = m.createdAt || m.addedAt || null;
                      return (
                        <li
                          key={m.uid}
                          className="member-list-item"
                          role="button"
                          tabIndex={0}
                          onClick={() => startEdit(m)}
                          onKeyDown={(e) => e.key === "Enter" && startEdit(m)}
                        >
                          <div className="member-info">
                            <h3 className="name">{displayName}{m.uid === user?.uid ? " (You)" : ""}</h3>
                            <p className="meta">Added: {formatWhen(addedAt)}</p>
                          </div>
                          <RightChevronIcon />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            ) : (
              // stage === "edit"
              <>
                <div className="permissions-list">
                    {/* Always-on */}
                    <label className="permission">
                        <input type="checkbox" checked readOnly disabled />
                        View gigs
                    </label>
    
                    {/* Selectable perms */}
                    {Object.keys(PERMS_DISPLAY).map((key) => (
                        <label key={key} className="permission">
                        <input
                            type="checkbox"
                            checked={!!permissions[key]}
                            onChange={() => togglePerm(key)}
                        />
                        {PERMS_DISPLAY[key]}
                        </label>
                    ))}
                </div>
  
                <div className="two-buttons">
                    <button
                        className="btn danger"
                        onClick={handleRemove}
                        disabled={removing || selectedUid === user?.uid}
                        title={selectedUid === user?.uid ? "You cannot remove yourself" : "Remove member from venue"}
                    >
                        {removing ? "Removing…" : "Remove Member"}
                    </button>
                    <button
                        className="btn primary"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? "Saving…" : "Save"}
                    </button>
                </div>
              </>
            )}
          </div>
  
          <button className="btn tertiary close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  };