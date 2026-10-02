const COMMON = new Set([
  'password', 'password1', '12345678', '123456789', '1234567890', 'qwerty123',
  'letmein', 'welcome', 'admin123', 'iloveyou', 'monkey123', 'abc12345',
  'password123', 'qwertyui', '11111111', '00000000', 'gigin123', 'changeme',
]);

function kinds(value) {
  let count = 0;
  if (/[a-z]/.test(value)) count += 1;
  if (/[A-Z]/.test(value)) count += 1;
  if (/\d/.test(value)) count += 1;
  if (/[^A-Za-z0-9]/.test(value)) count += 1;
  return count;
}

export function passwordStrength(value) {
  const password = String(value || '');
  if (!password) {
    return { level: 0, tone: '', title: '', body: 'Use 8 or more characters. A few words together is easy to remember and hard to guess.' };
  }
  if (password.length < 8) {
    const left = 8 - password.length;
    return { level: 1, tone: 'bad', title: 'Too short.', body: `Add ${left} more character${left === 1 ? '' : 's'}.` };
  }
  if (COMMON.has(password.toLowerCase())) {
    return { level: 1, tone: 'bad', title: 'Too common.', body: 'This is one of the most guessed passwords. Try a few words together.' };
  }
  if (password.length < 12 && kinds(password) < 3) {
    return { level: 2, tone: 'ok', title: 'Okay.', body: 'Longer is stronger. Add another word or a few numbers.' };
  }
  return { level: 4, tone: 'good', title: 'Strong.', body: 'Good to go.' };
}

export function passwordSubmitError(value) {
  const password = String(value || '');
  if (password.length < 8) return 'Use at least 8 characters.';
  if (COMMON.has(password.toLowerCase())) return 'Choose a less common password.';
  return '';
}
