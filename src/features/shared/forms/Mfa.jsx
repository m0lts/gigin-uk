import { useEffect, useState } from 'react';
import { useAuth } from '@hooks/useAuth';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { LoadingSpinner } from '../ui/loading/Loading';

export const Mfa = ({
  verificationId: initialVerificationId,
  phone,
  onClose,
  onBack,
  loading,
  setLoading,
  error,
  setError,
}) => {
  const { finalizeMfaEnrollment, resendMfaCode } = useAuth();
  const [verificationId, setVerificationId] = useState(initialVerificationId);
  const [code, setCode] = useState('');
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Keep local verificationId in sync if parent updates it
  useEffect(() => {
    setVerificationId(initialVerificationId);
  }, [initialVerificationId]);

  // simple resend cooldown (30s)
  useEffect(() => {
    if (!cooldown) return;
    const t = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleVerify = async (e) => {
    e?.preventDefault?.();
    if (!verificationId || code.length !== 6) return;

    try {
      setLoading(true);
      setError({ status: false, input: '', message: '' });
      await finalizeMfaEnrollment(verificationId, code);
      // success: user remains signed-in and MFA is enrolled
      onClose?.(); // close modal
    } catch (err) {
      setError({ status: true, input: '', message: 'Incorrect code. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending || cooldown > 0) return;
    try {
      setResending(true);
      setError({ status: false, input: '', message: '' });
      const newId = await resendMfaCode(phone);
      setVerificationId(newId);
      setCode('');
      setCooldown(30); // 30s cooldown
    } catch (err) {
      setError({ status: true, input: '', message: 'Failed to resend code. Try again.' });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="modal-padding auth" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: '1rem'}}>
      <div className="modal-content auth">
        <div className="head">
          <h1>Verify your phone</h1>
          <p>Enter the 6‑digit code we sent to <strong>{phone}</strong>.</p>
        </div>

        <form className="auth-form" onSubmit={handleVerify}>
          <div className="input-group">
            {/* Replace this input with your advanced multi-box entry if you have it */}
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              autoFocus
            />
          </div>

          {error?.status && (
            <div className="error-box">
              <p className="error-msg">{error.message}</p>
            </div>
          )}

          {loading ? (
            <LoadingSpinner />
          ) : (
            <>
              <button
                type="submit"
                className="btn primary"
                disabled={!verificationId || code.length !== 6}
              >
                Verify
              </button>

              <button
                type="button"
                className="btn text re-send"
                onClick={handleResend}
                disabled={resending || cooldown > 0}
              >
                {resending ? 'Resending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>

              <button type="button" className="btn tertiary" onClick={onBack}>
                Go back
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
};


// import React, { useRef, useEffect, useState } from 'react';

// export const Mfa = ({ value, valueLength, onChange }) => {
//   const inputsRef = useRef([]);

//   useEffect(() => {
//     if (inputsRef.current[0]) {
//       inputsRef.current[0].focus();
//     }
//   }, []);

//   const handleChange = (e, index) => {
//     const { value } = e.target;
//     if (/[^0-9]/.test(value)) return;
  
//     const newOtp = otp.split(''); // Convert the otp string into an array
//     newOtp[index] = value.slice(-1); // Only take the last entered character
//     const otpValue = newOtp.join(''); // Join back into a string
  
//     onChange(otpValue);
  
//     if (value && index < valueLength - 1) {
//       inputsRef.current[index + 1].focus();
//     }
//   };

//   const handleKeyDown = (e, index) => {
//     const { key } = e;
//     if (key === 'Backspace' && !value[index] && index > 0) {
//       inputsRef.current[index - 1].focus();
//     }
//   };

//   const handlePaste = (e) => {
//     e.preventDefault();
//     const pasteData = e.clipboardData.getData('text').slice(0, valueLength);
//     if (/[^0-9]/.test(pasteData)) return;

//     onChange(pasteData);
//     pasteData.split('').forEach((char, index) => {
//       inputsRef.current[index].value = char;
//     });
//     if (pasteData.length < valueLength) {
//       inputsRef.current[pasteData.length].focus();
//     }
//   };

//   return (
//     <div onPaste={handlePaste} style={{ display: 'flex', gap: '10px' }}>
//       {Array.from({ length: valueLength }).map((_, index) => (
//         <input
//           key={index}
//           ref={(el) => (inputsRef.current[index] = el)}
//           type='text'
//           maxLength='1'
//           value={value[index] || ''}
//           onChange={(e) => handleChange(e, index)}
//           onKeyDown={(e) => handleKeyDown(e, index)}
//           style={{ width: '40px', height: '40px', textAlign: 'center', fontSize: '20px' }}
//         />
//       ))}
//     </div>
//   );
// };

// export const Mfa = ({ verificationId, setAuthModal, setAuthType, credentials, setError, setLoading }) => {
//   const [code, setCode] = useState("");

//   const handleVerify = async (e) => {
//     e.preventDefault();
//     setLoading(true);
//     try {
//       const cred = PhoneAuthProvider.credential(verificationId, code);
//       // now actually sign the user in
//       await signInWithCredential(auth, cred);
//       setAuthModal(false);
//     } catch (err) {
//       setError({ status: true, input: "mfa", message: "Invalid code, please try again." });
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <form className="auth-form" onSubmit={handleVerify}>
//       <label>Enter the code sent to {credentials.phoneNumber}</label>
//       <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} required />
//       <button type="submit" className="btn primary">Verify</button>
//     </form>
//   );
// };