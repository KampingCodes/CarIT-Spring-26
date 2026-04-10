import { getToken } from './auth.js';
import axios from 'axios'

async function buildHeaders() {
  const token = await getToken();
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function serverGet(endpoint, params) {
  const url = `http://localhost:3000/api/${endpoint}`;
  const config = { headers: await buildHeaders() };
  if (params) config.params = params;
  try {
    const response = await axios.get(url, config);
    return response.data;
  } catch (err) {
    throw normalizeApiError(err);
  }
}

async function serverPost(endpoint, data) {
  const url = `http://localhost:3000/api/${endpoint}`;
  try {
    const response = await axios.post(url, data, { headers: await buildHeaders() });
    return response.data;
  } catch (err) {
    throw normalizeApiError(err);
  }
}

async function serverPatch(endpoint, data) {
  const url = `http://localhost:3000/api/${endpoint}`;
  try {
    const response = await axios.patch(url, data, { headers: await buildHeaders() });
    return response.data;
  } catch (err) {
    throw normalizeApiError(err);
  }
}

async function serverDelete(endpoint) {
  const url = `http://localhost:3000/api/${endpoint}`;
  try {
    const response = await axios.delete(url, { headers: await buildHeaders() });
    return response.data;
  } catch (err) {
    throw normalizeApiError(err);
  }
}

function normalizeApiError(err) {
  const message = err?.response?.data?.message || err?.message || 'Request failed';
  const normalizedError = new Error(message);
  normalizedError.status = err?.response?.status || err?.status || 500;
  normalizedError.retryAfterSeconds = err?.response?.data?.retryAfterSeconds || null;
  normalizedError.cause = err;
  return normalizedError;
}

export async function getResponse(contents) {
  return serverPost('generate', { contents });
}

export async function getQuestions(vehicle, issues) {
  return serverPost('gen-questions', { vehicle, issues });
}

export async function getFlowchart(vehicle, issues, responses) {
  return serverPost('gen-flowchart', { vehicle, issues, responses });
}

export async function getSavedFlowcharts() {
  return serverGet('get-flowcharts');
}

export async function saveFlowchartInstruction(flowchartId, payload) {
  if (!flowchartId) throw new Error('flowchartId is required');
  return serverPost(`flowcharts/${encodeURIComponent(flowchartId)}/instructions`, payload);
}

export async function getUserData() {
  return serverGet('get-user-data');
}

export async function deleteFlowchart(flowchartId) {
  return serverPost('delete-flowchart', { flowchartId });
}

/**
 * Update user data
 * Ex: { name: "John Doe" }
 * @param {Object} params The attributes you want to change
 * @returns Success
 */
export async function setUserData(params) {
  return serverPost('set-user-data', params);
}

/**
 * Upload profile picture
 * @param {string} base64Image The base64 encoded image data
 * @returns Success
 */
export async function uploadProfilePicture(base64Image) {
  return serverPost('upload-profile-picture', { profilePicture: base64Image });
}

/**
 * Get car options (years, makes, models, trims) from database
 * @param {Object} filters - Optional filters like { year: '2020', make: 'Toyota' }
 * @returns {Object} Object containing arrays: { years, makes, models, trims }
 */
export async function getCarOptions(filters) {
  return serverGet('car-options', filters);
}

export async function addCarRecord(vehicle) {
  return serverPost('cars/add', vehicle);
}

/**
 * Get user's garage (all saved vehicles)
 * @returns {Array} Array of vehicles in the user's garage
 */
export async function getGarage() {
  return serverGet('garage');
}

/**
 * Increment crash out counter
 * @returns {Object} Contains the updated crashOut value
 */
export async function crashOut() {
  return serverPost('crash-out', {});
}

/**
 * Add a vehicle to the user's garage
 * @param {Object} vehicle - Vehicle data (year, make, model, trim, nickname, etc.)
 * @returns {Object} Result with success status and car data
 */
export async function addGarageVehicle(vehicle) {
  return serverPost('garage/add', vehicle);
}

/**
 * Edit a vehicle in the user's garage
 * @param {String} carId - The ID of the car to edit
 * @param {Object} updates - Updated vehicle data
 * @returns {Object} Result with success status
 */
export async function editGarageVehicle(carId, updates) {
  return serverPost('garage/edit', { carId, updates });
}

/**
 * Remove a vehicle from the user's garage
 * @param {String} carId - The ID of the car to remove
 * @returns {Object} Result with success status
 */
export async function removeGarageVehicle(carId) {
  return serverPost('garage/remove', { carId });
}

export async function getAdminStatus() {
  return serverGet('admin/status');
}

export async function getAdminAccounts(params) {
  return serverGet('admin/accounts', params);
}

export async function grantAdminAccess(targetUserId, accessLevel = 'admin') {
  return serverPost('admin/accounts/grant', { targetUserId, accessLevel });
}

export async function revokeAdminAccess(targetUserId) {
  return serverPost('admin/accounts/revoke', { targetUserId });
}

export async function getAdminUsers(params) {
  return serverGet('admin/users', params);
}

export async function updateAdminUser(userId, updates) {
  return serverPatch(`admin/users/${encodeURIComponent(userId)}`, updates);
}

export async function deleteAdminUser(userId) {
  return serverDelete(`admin/users/${encodeURIComponent(userId)}`);
}

export async function getAdminVehicles(params) {
  return serverGet('admin/vehicles', params);
}

export async function updateAdminVehicle(carId, updates) {
  return serverPatch(`admin/vehicles/${encodeURIComponent(carId)}`, updates);
}

export async function deleteAdminVehicle(carId) {
  return serverDelete(`admin/vehicles/${encodeURIComponent(carId)}`);
}

export async function getAdminFlowcharts(params) {
  return serverGet('admin/flowcharts', params);
}

export async function deleteAdminFlowchart(ownerUserId, flowchartId) {
  return serverDelete(`admin/flowcharts/${encodeURIComponent(ownerUserId)}/${encodeURIComponent(flowchartId)}`);
}

export async function getAdminAuditLogs(params) {
  return serverGet('admin/audit-logs', params);
}

export async function restoreAdminAuditRecord(auditId) {
  return serverPost(`admin/audit-logs/${encodeURIComponent(auditId)}/restore`, {});
}


