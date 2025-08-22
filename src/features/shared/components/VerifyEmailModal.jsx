import { useEffect, useState } from "react";
import { auth } from "@lib/firebase";
import { sendEmailVerification, reload } from "firebase/auth";
import { toast } from "sonner";
// Reuse your existing logo/icons if you like:
import { NoTextLogo } from "@features/shared/ui/logos/Logos";
import { LoadingThreeDots } from "@features/shared/ui/loading/Loading";
import { useAuth } from '@hooks/useAuth'
import { useNavigate } from "react-router-dom";


export const  VerifyEmailModal = ({ onClose }) => {

  const { logout } = useAuth();
  const user = auth.currentUser;
  const email = user?.email || "";

  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResend = async () => {
    if (!auth.currentUser) {
      toast.error("No user found.");
      return;
    }
    setSending(true);
    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/email-verified`,
        handleCodeInApp: false,
      };
      await sendEmailVerification(auth.currentUser, actionCodeSettings);
      toast.success("Verification email sent.");
      setCooldown(30);
    } catch (e) {
      const msg = e?.message || "Failed to send verification email.";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const handleCheckVerified = async () => {
    if (!auth.currentUser) return;
    setChecking(true);
    try {
      await reload(auth.currentUser);
      if (auth.currentUser.emailVerified) {
        toast.success("Email verified!");
        onClose?.();
      } else {
        toast.info("Still not verified. Please click the link in your email.");
      }
    } catch (e) {
      toast.error(e?.message || "Could not refresh verification status.");
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = async () => {
    try {
        await logout();
        navigate();
    } catch (err) {
        console.error(err);
    } finally {
        window.location.reload();
    }
}

  return (
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-content auth">
        <div className="head">
          <NoTextLogo />
          <h1>Verify your email</h1>
          <p>
            We’ve sent a verification link to <strong>{email}</strong>. Please
            click the link in that email to verify your account.
          </p>
          <p>Didn’t get it? Check your spam/junk folder.</p>
        </div>

        <div className="modal-body" style={{ marginTop: 16 }}>
          <div className="two-buttons" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {checking ? (
                <LoadingThreeDots />
            ) : (
                <button
                type="button"
                className="btn primary"
                onClick={handleCheckVerified}
                disabled={checking}
                >
                I’ve verified – Check again
                </button>
            )}

            <button
              type="button"
              className="btn secondary"
              onClick={handleResend}
              disabled={sending || cooldown > 0}
              title={cooldown > 0 ? `Try again in ${cooldown}s` : undefined}
            >
              {sending ? (
                <LoadingThreeDots />
              ) : cooldown > 0 ? (
                `Resend email (${cooldown}s)`
              ) : (
                "Resend verification email"
              )}
            </button>
          </div>
          <button className="btn tertiary" onClick={handleLogout} style={{ margin: '1rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}

export const  VerifyInfoModal = ({ onClose }) => {
    return (
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content auth">
          <div className="modal-header">
            <NoTextLogo />
            <h1>Verify your email</h1>
            <p>
              We’ve sent a verification link to <strong>{email}</strong>. Please
              click the link in that email to verify your account.
            </p>
            <p>You must verify your account within 48 hours after signing up to continue using Gigin.</p>
          </div>
          <button className="btn close tertiary" onClick={() => onClose()}>
            Close
          </button>
          </div>
      </div>
    );
  }