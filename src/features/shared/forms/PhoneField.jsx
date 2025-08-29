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
          onChange={(e) => setLocal(e.target.value)}
          disabled={disabled}
          aria-label="Local phone number"
        />
      </div>
    </div>
  );
}