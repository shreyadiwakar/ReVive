export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}

export function isValidPhone(phone) {
  return /^[\d\s+\-()]{10,15}$/.test(String(phone).trim())
}

export function validatePasswordMatch(password, confirm) {
  return password.length >= 6 && password === confirm
}

export function required(value) {
  return value !== undefined && value !== null && String(value).trim().length > 0
}
