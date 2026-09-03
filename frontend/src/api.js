import { localApi } from './localApi.js'

async function request(path, options = {}) {
  const base = import.meta.env.VITE_API_BASE || ''
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.error || '请求失败')
  }
  return data
}

const remoteApi = {
  categories: () => request('/api/categories'),
  addCategory: (body) => request('/api/categories', { method: 'POST', body }),
  deleteCategory: (id) => request(`/api/categories/${id}`, { method: 'DELETE' }),
  dishes: (categoryId) =>
    request(categoryId ? `/api/dishes?categoryId=${categoryId}` : '/api/dishes'),
  addDish: (body) => request('/api/dishes', { method: 'POST', body }),
  deleteDish: (id) => request(`/api/dishes/${id}`, { method: 'DELETE' }),
  today: () => request('/api/today'),
  pickToday: (dish_id) => request('/api/today', { method: 'POST', body: { dish_id } }),
  randomToday: (category_id) =>
    request('/api/today/random', { method: 'POST', body: { category_id } }),
}

function useLocalStorage() {
  if (import.meta.env.VITE_API_BASE) return false
  if (import.meta.env.DEV) return false
  return true
}

export const api = new Proxy(
  {},
  {
    get(_target, key) {
      return (useLocalStorage() ? localApi : remoteApi)[key]
    },
  },
)
