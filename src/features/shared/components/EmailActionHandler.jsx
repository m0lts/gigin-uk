// EmailActionHandler.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { applyActionCode } from "firebase/auth";
import { auth } from "@lib/firebase";
import { LoadingSpinner } from "@features/shared/ui/loading/Loading";
import { toast } from "sonner";
import { sendVerificationEmail } from "@services/api/users";
import '@styles/shared/legals.styles.css'

export const EmailActionHandler = ({ user }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const continueUrlRaw = searchParams.get("continueUrl");
  const continueUrl = continueUrlRaw ? decodeURIComponent(continueUrlRaw) : null;

  const [state, setState] = useState({
    status: "loading",
    title: "Verifying your email…",
    detail: "Please wait while we complete verification.",
  });

  useEffect(() => {
    const run = async () => {
        try {
           if (auth.currentUser) {
             try { await auth.currentUser.reload(); } catch {}
           }    
           if (auth.currentUser?.emailVerified) {
             setState({
               status: "success",
               title: "Email verified",
               detail: "Your email address has been successfully verified. You can now continue using Gigin.",
             });
             if (continueUrl) setTimeout(() => navigate(continueUrl), 1500);
             return;
           }    
           // If user isn’t signed in or not verified yet, show a helpful state
           setState({
             status: "invalid",
             title: "Invalid verification link",
             detail: "We couldn’t confirm your verification. Please sign in and request a new link.",
           });

      } catch (err) {
        const code = (err && err.code) || "";
        if (code.includes("expired") || code === "auth/expired-action-code") {
          setState({
            status: "expired",
            title: "Link expired",
            detail:
              "This verification link has expired. Please request a new verification email.",
          });
        } else if (code.includes("invalid") || code === "auth/invalid-action-code") {
          setState({
            status: "invalid",
            title: "Invalid verification link",
            detail:
              "This verification link is invalid or has already been used.",
          });
        } else {
          setState({
            status: "error",
            title: "Couldn’t verify email",
            detail:
              "Something went wrong while verifying your email. Please try again or request a new link.",
          });
        }
      }
    };
    run();
  }, []);

  const goHome = () => {
    if (continueUrl) {
      navigate(continueUrl);
    }
  };

  const requestNew = async () => {
    if (!auth.currentUser) {
      toast.error("No user found.");
      return;
    }
    setState({
        status: "loading",
        title: "Resending Verification Email...",
        detail: "Please wait while we send a new verification email.",
      });
    try {
      await sendVerificationEmail({ actionUrl: window.location.origin });
      toast.success("Verification email sent.");
    } catch (e) {
      const msg = e?.message || "Failed to send verification email.";
      toast.error(msg);
    } finally {
        setState({
            status: "loading",
            title: "Resending Verification Email...",
            detail: "Please wait while we send a new verification email.",
          });
    }
  };

  if (state.status === "loading") {
    return (
      <div className="legals">
        <div className="legals-header">
          <h1 className="legals-title">{state.title}</h1>
          <p className="legals-updated">&nbsp;</p>
        </div>
        <div className="legals-section">
          <p>{state.detail}</p>
          <div style={{ marginTop: "1rem" }}>
            <LoadingSpinner />
          </div>
        </div>
      </div>
    );
  }

  const isSuccess = state.status === "success";

  return (
    <div className="legals">
      <div className="legals-header">
        <h1 className="legals-title">{state.title}</h1>
        <p className="legals-updated">
          {new Date().toLocaleDateString("en-GB")}
        </p>
      </div>

      <div className="legals-section">
        <p>{state.detail}</p>
      </div>

      <div className="legals-footer" style={{ marginTop: "1.5rem" }}>
        {isSuccess ? (
          <button className="btn primary" onClick={goHome}>
            Continue
          </button>
        ) : (
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button className="btn secondary" onClick={goHome}>
              Go back
            </button>
            <button className="btn primary" onClick={requestNew}>
              Send new verification email
            </button>
          </div>
        )}
      </div>
    </div>
  );
};