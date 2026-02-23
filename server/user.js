import { DATABASE, USER_COLLECTION } from './config.js';
import { client } from './mongo.js';

/**
 * Get user data from the database
 * @param {string} userid 
 * @returns {WithId<Document> | null} The user if it exists
 */
export async function getUserDB(userid) {
  if (!userid) {
    console.log("getUserDB: Missing required fields");
    return "Missing required fields";
  }

  // Check if a user exists using the MongoClient
  const collection = client.db(DATABASE).collection(USER_COLLECTION);
  const res = await collection.findOne({ _id: userid });
  return res;
}

/**
 * Get user data from auth0
 * @param {string} authorization The auth0 authorization Bearer + token
 * @returns User object
 */
export async function getUserAuth0(authorization) {
  const response = await fetch(`https://${process.env.AUTH0_DOMAIN}/userinfo`, {
    headers: { authorization },
  });
  return await response.json();
}

/**
 * Update user information in the database
 * @param {string} userid The user identifier
 * @param {Object} updates The updates
 */
export async function updateUserDB(userid, updates) {
  if (!userid || !updates) {
    console.log("updateUserDB: Missing required fields");
    return "Missing required fields";
  }

  const collection = client.db(DATABASE).collection(USER_COLLECTION);
  await collection.updateOne({ _id: userid }, { $set: updates });
}

/**
 * Attempt to create a user
 * @param {string} userid The user identifier
 * @param {string} name The users full name
 * @param {string} email The users email
 * @returns Whether the user account was created or not
 */
export async function createUser(userid, name, email) {
  if (!userid || !name || !email) {
    console.log("createUser: Missing required fields");
    return "Missing required fields";
  }

  const dbUser = await getUserDB(userid);
  const collection = client.db(DATABASE).collection(USER_COLLECTION);
  // Use the provided email when creating a new user
  const user = { _id: userid, name: name, flowcharts: [], email: email || "", attitude: "", crashOut: 0, experienceLevel: 1 };

  if (!dbUser) {
    // Create a user using the MongoClient
    await collection.insertOne(user);
    console.log("User created:", user);
    return "User created";
  }

  // Check for missing fields
  let updated = false;
  for (const field in user) {
    // If the user record is missing a field, or the field is empty (like email), set it
    if (!dbUser.hasOwnProperty(field) || dbUser[field] === undefined || dbUser[field] === null || (typeof dbUser[field] === 'string' && dbUser[field].trim() === '')) {
      dbUser[field] = user[field];
      updated = true;
    }
  }

  if (updated) {
    // Update the user using the MongoClient
    const collection = client.db(DATABASE).collection(USER_COLLECTION);
    await collection.updateOne({ _id: userid }, { $set: dbUser });
    console.log("User updated:", dbUser);
    return "User updated";
  } else {
    // User already exists
    console.log("User already exists:", userid);
    return "User already exists";
  }
}

/**
 * Save a flowchart for a user (up to 5)
 * @param {string} userid The user identifier
 * @param {string} flowchart The json string of the flowchart
 * @param {Object} vehicle Vehicle object
 * @param {string} issues Vehicle issue description
 * @param {Array<Object>} responses User responses
 */
export async function saveFlowchart(userid, flowchart, vehicle, issues, responses) {
  if (!userid || !flowchart || !vehicle || !issues || !responses) {
    console.log("saveFlowchart: Missing required fields");
    return "Missing required fields";
  }

  const collection = client.db(DATABASE).collection(USER_COLLECTION);
  const MAX_FLOWCHARTS = 5;

  const res = await collection.findOne({ _id: userid });
  if (res.flowcharts.length >= MAX_FLOWCHARTS) {
    res.flowcharts.shift();
  }
  res.flowcharts.push({
    flowchart, vehicle, issues, responses
  });
  await collection.updateOne({ _id: userid }, { $set: res });
}

/**
 * Get all flowcharts for a user
 * @param {string} userid The user identifier
 * @returns {Array<string>} The flowcharts
 */
export async function getFlowcharts(userid) {
  if (!userid) {
    console.log("getFlowcharts: Missing required fields");
    return "Missing required fields";
  }

  const collection = client.db(DATABASE).collection(USER_COLLECTION);
  const res = await collection.findOne({ _id: userid });
  return res.flowcharts;
}

/**
 * Delete a flowchart by index for a given user
 * @param {string} userid
 * @param {number} index
 */
export async function deleteFlowchart(userid, index) {
  if (!userid || index === undefined || index === null) {
    console.log("deleteFlowchart: Missing required fields");
    return "Missing required fields";
  }

  const collection = client.db(DATABASE).collection(USER_COLLECTION);
  const res = await collection.findOne({ _id: userid });
  if (!res || !Array.isArray(res.flowcharts)) {
    console.log("deleteFlowchart: No flowcharts found for user", userid);
    return "No flowcharts";
  }

  if (index < 0 || index >= res.flowcharts.length) {
    console.log("deleteFlowchart: Index out of range", index);
    return "Index out of range";
  }

  res.flowcharts.splice(index, 1);
  await collection.updateOne({ _id: userid }, { $set: { flowcharts: res.flowcharts } });
  return { success: true };
}
