/**
 * Strong password validator enforcing LGW MeritX student security requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one numeric digit (0-9)
 * - At least one special character (!@#$%^&* etc.)
 */
export function validatePasswordRequirements(password) {
  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      message: 'Password is required.',
      details: {
        minLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumber: false,
        hasSpecial: false
      }
    };
  }

  const details = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`^]/.test(password)
  };

  const isValid =
    details.minLength &&
    details.hasUppercase &&
    details.hasLowercase &&
    details.hasNumber &&
    details.hasSpecial;

  let message = 'Password meets all security criteria.';
  if (!details.minLength) {
    message = 'Password must be at least 8 characters long.';
  } else if (!details.hasUppercase) {
    message = 'Password must include at least one uppercase letter (A-Z).';
  } else if (!details.hasLowercase) {
    message = 'Password must include at least one lowercase letter (a-z).';
  } else if (!details.hasNumber) {
    message = 'Password must include at least one number (0-9).';
  } else if (!details.hasSpecial) {
    message = 'Password must include at least one special character (!@#$%^&* etc.).';
  }

  return { isValid, message, details };
}
