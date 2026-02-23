import { getToken, getUserID } from './auth.js';
import axios from 'axios'

async function serverGet(endpoint, params) {
  const url = `http://localhost:3001/api/${endpoint}`;
  const token = await getToken();
  const userid = getUserID();
  const config = { headers: { Authorization: `bearer ${token}`, userid } };
  if (params) config.params = params;
  const response = await axios.get(url, config);
  return response.data;
}

async function serverPost(endpoint, data) {
  const url = `http://localhost:3001/api/${endpoint}`;
  const token = await getToken();
  const userid = getUserID();
  const response = await axios.post(url, data, { headers: { Authorization: `Bearer ${token}`, userid } });
  return response.data;
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

export async function getUserData() {
  return serverGet('get-user-data');
}

export async function deleteFlowchart(index) {
  return serverPost('delete-flowchart', { index });
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
 * Get car options (years, makes, models, trims) from database
 * @param {Object} filters - Optional filters like { year: '2020', make: 'Toyota' }
 * @returns {Object} Object containing arrays: { years, makes, models, trims }
 */
export async function getCarOptions(filters) {
  return serverGet('car-options', filters);
}

/**
 * Get user's garage (all saved vehicles)
 * @returns {Array} Array of vehicles in the user's garage
 */
export async function getGarage() {
  return serverGet('garage');
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


