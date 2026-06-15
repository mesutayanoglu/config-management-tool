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
  getMe: () => api.get('/auth/me'),
  createUser: (data) => api.post('/auth/users', data),
  listUsers: () => api.get('/auth/users'),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
  updateProfile: (id, data) => api.put(`/auth/users/${id}/profile`, data),
  updatePassword: (id, data) => api.put(`/auth/users/${id}/password`, data),
  updateRole: (id, data) => api.put(`/auth/users/${id}/role`, data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  mfaSetup: (temp_token) => api.post('/auth/mfa/setup', { temp_token }),
  mfaEnable: (temp_token, code) => api.post('/auth/mfa/enable', { temp_token, code }),
  mfaVerify: (temp_token, code) => api.post('/auth/mfa/verify', { temp_token, code }),
  mfaReset: (current_password) => api.post('/auth/mfa/reset', { current_password }),
  mfaStatus: () => api.get('/auth/mfa/status'),
  mfaResetUser: (id) => api.delete(`/auth/users/${id}/mfa`),
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

export const credentialProfilesApi = {
  list: () => api.get('/credential-profiles/'),
  create: (data) => api.post('/credential-profiles/', data),
  update: (id, data) => api.patch(`/credential-profiles/${id}`, data),
  remove: (id) => api.delete(`/credential-profiles/${id}`),
}

export const configletsApi = {
  list: () => api.get('/configlets/'),
  get: (id) => api.get(`/configlets/${id}`),
  create: (data) => api.post('/configlets/', data),
  update: (id, data) => api.patch(`/configlets/${id}`, data),
  remove: (id) => api.delete(`/configlets/${id}`),
  execute: (id, data) => api.post(`/configlets/${id}/execute`, data),
  listExecutions: () => api.get('/configlets/executions'),
}

export const settingsApi = {
  get: () => api.get('/settings/'),
  save: (data) => api.post('/settings/', data),
  testGithub: () => api.get('/settings/test-github'),
  getSmtp: () => api.get('/settings/smtp'),
  saveSmtp: (data) => api.post('/settings/smtp', data),
  testSmtp: () => api.post('/settings/test-smtp'),
  getNotifications: () => api.get('/settings/notifications'),
  saveNotifications: (data) => api.post('/settings/notifications', data),
}

export default api
