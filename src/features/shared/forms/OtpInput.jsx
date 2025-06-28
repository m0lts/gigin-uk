import React, { useRef, useEffect } from 'react';

export const OtpInput = ({ value, valueLength, onChange }) => {
  const inputsRef = useRef([]);

  useEffect(() => {
    if (inputsRef.current[0]) {
      inputsRef.current[0].focus();
    }
  }, []);

  const handleChange = (e, index) => {
    const { value } = e.target;
    if (/[^0-9]/.test(value)) return;
  
    const newOtp = otp.split(''); // Convert the otp string into an array
    newOtp[index] = value.slice(-1); // Only take the last entered character
    const otpValue = newOtp.join(''); // Join back into a string
  
    onChange(otpValue);
  
    if (value && index < valueLength - 1) {
      inputsRef.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    const { key } = e;
    if (key === 'Backspace' && !value[index] && index > 0) {
      inputsRef.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').slice(0, valueLength);
    if (/[^0-9]/.test(pasteData)) return;

    onChange(pasteData);
    pasteData.split('').forEach((char, index) => {
      inputsRef.current[index].value = char;
    });
    if (pasteData.length < valueLength) {
      inputsRef.current[pasteData.length].focus();
    }
  };

  return (
    <div onPaste={handlePaste} style={{ display: 'flex', gap: '10px' }}>
      {Array.from({ length: valueLength }).map((_, index) => (
        <input
          key={index}
          ref={(el) => (inputsRef.current[index] = el)}
          type='text'
          maxLength='1'
          value={value[index] || ''}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          style={{ width: '40px', height: '40px', textAlign: 'center', fontSize: '20px' }}
        />
      ))}
    </div>
  );
};

