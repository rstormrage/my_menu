const KEY = 'my-menu-token'

export function getToken() {
  try {
    return sessionStorage.getItem(KEY) || ''
  } catch {
    return ''
  }
}

export function isUnlocked() {
  return Boolean(getToken())
}

export function setToken(token) {
  sessionStorage.setItem(KEY, token)
}

export function clearToken() {
  sessionStorage.removeItem(KEY)
}
