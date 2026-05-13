import axios from 'axios'
import useAuthStore from '../store/authStore'

const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
  listUsers: () => api.get('/auth/users'),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
}

export const devicesApi = {
  list: () => api.get('/devices/'),
  get: (id) => api.get(`/devices/${id}`),
  create: (data) => api.post('/devices/', data),
  update: (id, data) => api.patch(`/devices/${id}`, data),
  remove: (id) => api.delete(`/devices/${id}`),
  ping: (id) => api.post(`/devices/${id}/ping`),
  collect: (id) => api.post(`/devices/${id}/collect`),
}

export const configsApi = {
  list: (deviceUid) => api.get('/configs/', { params: { device_uid: deviceUid } }),
  latest: (deviceUid) => api.get(`/configs/${deviceUid}/latest`),
  atSha: (deviceUid, sha) => api.get(`/configs/${deviceUid}/at`, { params: { sha } }),
  compare: (deviceUid, shaA, shaB) =>
    api.get(`/configs/${deviceUid}/compare`, { params: { sha_a: shaA, sha_b: shaB } }),
}

export const schedulersApi = {
  list: () => api.get('/schedulers/'),
  create: (data) => api.post('/schedulers/', data),
  update: (id, data) => api.patch(`/schedulers/${id}`, data),
  remove: (id) => api.delete(`/schedulers/${id}`),
}

export const organizationsApi = {
  list: () => api.get('/organizations/'),
  create: (data) => api.post('/organizations/', data),
  remove: (id) => api.delete(`/organizations/${id}`),
  listSites: (orgId) => api.get(`/organizations/${orgId}/sites`),
  createSite: (orgId, data) => api.post(`/organizations/${orgId}/sites`, data),
  removeSite: (orgId, siteId) => api.delete(`/organizations/${orgId}/sites/${siteId}`),
}

export const settingsApi = {
  get: () => api.get('/settings/'),
  save: (data) => api.post('/settings/', data),
  testGithub: () => api.get('/settings/test-github'),
}

export default api
