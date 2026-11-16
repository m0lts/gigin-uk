import { useEffect, useState } from "react";
import { auth } from "@lib/firebase";
import { toast } from "sonner";
// Reuse your existing logo/icons if you like:
import { sendVerificationEmail } from "@services/api/users";
import { AuthCard, isGmail } from "../forms/AuthCard";
import "@styles/forms/auth-card.css";

export const  VerifyEmailModal = ({ setAuthModal, onClose }) => {

  const user = auth.currentUser;
  const email = user?.email || "";

  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    let stopped = false;
    let timer = 0;
    const tick = async () => {
      const current = auth.currentUser;
      if (!current || stopped) return;
      try {
        await current.reload();
        if (current.emailVerified) {
          await current.getIdToken(true);
          setAuthModal?.(false);
          return;
        }
      } catch { /* keep waiting for the email link */ }
      if (!stopped) timer = window.setTimeout(tick, 2000);
    };
    timer = window.setTimeout(tick, 1500);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [setAuthModal]);

  const handleResend = async () => {
    if (!auth.currentUser) {
      toast.error("No user found.");
      return;
    }
    setSending(true);
    try {
      await sendVerificationEmail({ actionUrl: window.location.origin });
      toast.success("Verification email sent.");
      setCooldown(30);
    } catch (e) {
      const msg = e?.message || "Failed to send verification email.";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const close = () => {
    onClose?.();
    setAuthModal?.(false);
  };
  const card = (
    <AuthCard
      title="Confirm your email"
      icon="mail"
      closable
      onClose={close}
      lede={<>Tap the link we sent to <strong>{email}</strong> to finish setting up. You can close this window.</>}
    >
      {isGmail(email) ? <a className="auth-card__primary" href="https://mail.google.com" target="_blank" rel="noreferrer">Open Gmail</a> : null}
      <div className="auth-card__actions">
        <button type="button" className="auth-card__link" onClick={handleResend} disabled={sending || cooldown > 0}>
          {cooldown > 0 ? `Resend email (${cooldown}s)` : 'Resend email'}
        </button>
        <button type="button" className="auth-card__link" onClick={close}>Change email</button>
      </div>
    </AuthCard>
  );
  if (setAuthModal) return card;
  return (
    <div className="modal auth" onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      {card}
    </div>
  );
}