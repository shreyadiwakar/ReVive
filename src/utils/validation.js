export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}

export function isValidPhone(phone) {
  return /^[\d\s+\-()]{10,15}$/.test(String(phone).trim())
}

export function validatePasswordMatch(password, confirm, requireCognitoFormat = false) {
  const hasCognitoFormat = /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password)
  return password.length >= 8 && password === confirm && (!requireCognitoFormat || hasCognitoFormat)
}

export function required(value) {
  return value !== undefined && value !== null && String(value).trim().length > 0
}
