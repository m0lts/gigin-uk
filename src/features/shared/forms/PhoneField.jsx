import { useEffect, useMemo, useState } from "react";

const COUNTRIES = [
  { code: "GB", name: "United Kingdom", dial: "44", example: "7700 900000" },
  { code: "US", name: "United States", dial: "1",  example: "415 555 2671" },
  { code: "IE", name: "Ireland",        dial: "353",example: "85 123 4567" },
  { code: "DE", name: "Germany",        dial: "49", example: "1512 3456789" },
  { code: "FR", name: "France",         dial: "33", example: "6 12 34 56 78" },
  { code: "ES", name: "Spain",          dial: "34", example: "612 34 56 78" },
  { code: "NL", name: "Netherlands",    dial: "31", example: "6 12345678" },
  { code: "AU", name: "Australia",      dial: "61", example: "412 345 678" },
  { code: "CA", name: "Canada",         dial: "1",  example: "604 555 0199" },
];

export function toE164(dial, localRaw) {
  let local = (localRaw || "").replace(/\D+/g, "");
  local = local.replace(/^0+/, "");
  if (!dial) return "";
  return `+${dial}${local}`;
}

export const isValidE164 = (value) => /^\+[1-9]\d{7,14}$/.test(value || "");

const byDialLen = (list) => [...list].sort((a, b) => b.dial.length - a.dial.length);

const parseInternational = (raw) => {
  let s = (raw || '').trim();
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (!s.startsWith('+')) return null;
  const digits = s.slice(1).replace(/\D+/g, '');
  const found = byDialLen(COUNTRIES).find(c => digits.startsWith(c.dial));
  if (!found) return null;
  const local = digits.slice(found.dial.length);
  return { country: found.code, dial: found.dial, local };
};

const normalizeLocalInput = (raw, selectedDial) => {
  let s = (raw || '').replace(/[^\d+]/g, '');
  const intl = parseInternational(s);
  if (intl) return intl;
  if (selectedDial && s.startsWith(selectedDial)) {
    s = s.slice(selectedDial.length);
  }
  return { country: null, dial: selectedDial, local: s.replace(/\D+/g, '') };
};

export const PhoneField = ({ 
  initialCountry = "GB",
  value,
  disabled,
  onChange,
  error,
  loading
}) => {
  const initial = useMemo(() => {
    if (!value || !value.startsWith("+")) return { country: initialCountry, local: "" };
    const digits = value.slice(1);
    const byLen = [...COUNTRIES].sort((a,b)=>b.dial.length - a.dial.length);
    const found = byLen.find(c => digits.startsWith(c.dial));
    if (!found) return { country: initialCountry, local: "" };
    const local = digits.slice(found.dial.length);
    return { country: found.code, local };
  }, [value, initialCountry]);

  const [country, setCountry] = useState(initial.country);
  const [local, setLocal]     = useState(initial.local);

  const selected = COUNTRIES.find(c => c.code === country) || COUNTRIES[0];
  const e164 = toE164(selected.dial, local);

  useEffect(() => {
    onChange?.(e164, { country, local, dial: selected.dial });
  }, [e164, country, local, selected?.dial]);

  return (
    <div className={`input-group ${disabled ? "disabled" : ""}`}>
      <label className="label">Phone Number</label>
      <div className="phone-row">
        <select
          className={`phone-country ${error.input.includes('phoneNumber') && 'error'} ${loading ? 'disabled' : ''}`}
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          disabled={disabled}
          aria-label="Country"
        >
          {COUNTRIES.map(c => (
            <option key={c.code} value={c.code}>
              {c.name} (+{c.dial})
            </option>
          ))}
        </select>
        <input
          className={`phone-local input ${error.input.includes('phoneNumber') && 'error'} ${loading ? 'disabled' : ''}`}
          type="tel"
          inputMode="tel"
          placeholder={selected.example}
          value={local}
          onChange={(e) => {
            const { country: parsedCountry, local: cleanLocal } = normalizeLocalInput(e.target.value, selected.dial);
            if (parsedCountry) setCountry(parsedCountry);
            setLocal(cleanLocal);
          }}
          disabled={disabled}
          aria-label="Local phone number"
        />
      </div>
    </div>
  );
}