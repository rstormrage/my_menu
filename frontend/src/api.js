import { clearToken, getToken } from './auth.js'

async function request(path, options = {}) {
  const base = import.meta.env.VITE_API_BASE || ''
  const token = getToken()
  const res = await fetch(`${base}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (res.status === 401 && path !== '/api/login') {
    clearToken()
  }
  if (!res.ok) {
    throw new Error(data?.error || '请求失败')
  }
  return data
}

export const api = {
  login: (password) => request('/api/login', { method: 'POST', body: { password } }),
  categories: (kind = 'home') => request(`/api/categories?kind=${kind}`),
  addCategory: (body) => request('/api/categories', { method: 'POST', body }),
  deleteCategory: (id) => request(`/api/categories/${id}`, { method: 'DELETE' }),
  dishes: (categoryId) =>
    request(categoryId ? `/api/dishes?categoryId=${categoryId}` : '/api/dishes'),
  addDish: (body) => request('/api/dishes', { method: 'POST', body }),
  deleteDish: (id) => request(`/api/dishes/${id}`, { method: 'DELETE' }),
  restaurants: (categoryId) =>
    request(categoryId ? `/api/restaurants?categoryId=${categoryId}` : '/api/restaurants'),
  addRestaurant: (body) => request('/api/restaurants', { method: 'POST', body }),
  deleteRestaurant: (id) => request(`/api/restaurants/${id}`, { method: 'DELETE' }),
  today: (mode = 'home') => request(`/api/today?mode=${mode}`),
  pickToday: (body) => request('/api/today', { method: 'POST', body }),
  randomToday: (body) => request('/api/today/random', { method: 'POST', body }),
}
