import { useEffect, useState } from "react";
import { auth } from "@lib/firebase";
import { toast } from "sonner";
// Reuse your existing logo/icons if you like:
import { NoTextLogo } from "@features/shared/ui/logos/Logos";
import { LoadingSpinner } from "../ui/loading/Loading";
import { sendVerificationEmail } from "@services/api/users";

export const  VerifyEmailModal = () => {

  const user = auth.currentUser;
  const email = user?.email || "";

  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

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
      await sendVerificationEmail({ actionUrl: window.location.origin });
      toast.success("Verification email sent.");
      setCooldown(60);
    } catch (e) {
      const msg = e?.message || "Failed to send verification email.";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal">
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

        <div className="modal-body verification" style={{ marginTop: 16 }}>
          {sending ? (
            <LoadingSpinner />
          ) : cooldown > 0 ? (
            <h4>Resend email ({cooldown}s)</h4>
          ) : (
            <button
              type="button"
              className="btn text"
              onClick={handleResend}
              disabled={sending || cooldown > 0}
              title={cooldown > 0 ? `Try again in ${cooldown}s` : undefined}
            >
              Resend verification email
            </button>
          )}
        </div>
      </div>
    </div>
  );
}