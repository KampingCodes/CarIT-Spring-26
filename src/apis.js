import { getToken, getUserID } from './auth.js';
import axios from 'axios'

async function serverGet(endpoint, params) {
  const url = `http://localhost:3000/api/${endpoint}`;
  const token = await getToken();
  const userid = getUserID();
  const config = { headers: { Authorization: `bearer ${token}`, userid } };
  if (params) config.params = params;
  const response = await axios.get(url, config);
  return response.data;
}

async function serverPost(endpoint, data) {
  const url = `http://localhost:3000/api/${endpoint}`;
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
