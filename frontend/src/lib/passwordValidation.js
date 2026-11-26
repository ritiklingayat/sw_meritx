const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) {
  return EMAIL_REGEX.test(String(email || '').trim());
}

export function evaluatePasswordCriteria(password = '', confirmPassword = '') {
  const pw = String(password || '');
  const cpw = String(confirmPassword || '');

  const criteria = {
    minLength: pw.length >= 8,
    hasUppercase: /[A-Z]/.test(pw),
    hasLowercase: /[a-z]/.test(pw),
    hasNumber: /[0-9]/.test(pw),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`^]/.test(pw),
    passwordsMatch: Boolean(pw && cpw && pw === cpw)
  };

  const isPasswordValid =
    criteria.minLength &&
    criteria.hasUppercase &&
    criteria.hasLowercase &&
    criteria.hasNumber &&
    criteria.hasSpecial;

  return { criteria, isPasswordValid };
}

export function maskEmailAddress(email = '') {
  const clean = String(email || '').trim();
  if (!clean.includes('@')) return clean;
  const [local, domain] = clean.split('@');
  if (local.length <= 2) {
    return `${local[0] || '*'}***@${domain}`;
  }
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}
