import { DATABASE, USER_COLLECTION, CARS_COLLECTION } from './config.js';
import { client } from './mongo.js';
import { ObjectId } from 'mongodb';
import { randomUUID } from 'crypto';
import { normalizeVehicleRecord } from './vehicleUtils.js';

const VALID_EXPERIENCE_LEVELS = new Set(['Beginner', 'Intermediate', 'Expert']);

const MAX_FLOWCHARTS = 5;

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

export async function updateOwnUserProfile(userid, updates) {
  const sanitized = sanitizeUserUpdates(updates, { includeProfilePicture: false });
  if (Object.keys(sanitized).length === 0) {
    return 'No valid fields provided';
  }

  sanitized.updatedAt = new Date().toISOString();
  await updateUserDB(userid, sanitized);
  return { success: true };
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
  const timestamp = new Date().toISOString();
  const user = {
    _id: userid,
    name: name,
    flowcharts: [],
    email: email || "",
    attitude: "",
    garage: [],
    experienceLevel: null,
    profilePicture: null,
    crashOut: 0,
    adminAccess: {
      isAdmin: false,
      accessLevel: 'user',
      source: 'none',
      grantedAt: null,
      grantedBy: null,
      updatedAt: timestamp
    },
    createdAt: timestamp,
    updatedAt: timestamp
  };

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
    dbUser.updatedAt = timestamp;
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
export async function saveFlowchart(userid, flowchartData) {
  if (!userid || !flowchartData?.flowchart || !flowchartData?.vehicle || !flowchartData?.issues || !flowchartData?.responses) {
    console.log("saveFlowchart: Missing required fields");
    return "Missing required fields";
  }

  const collection = client.db(DATABASE).collection(USER_COLLECTION);

  const { user, flowcharts } = await getNormalizedUserFlowcharts(collection, userid);
  if (!user) {
    return "User not found";
  }

  const timestamp = new Date().toISOString();
  const newRecord = {
    flowchartId: randomUUID(),
    flowchart: flowchartData.flowchart,
    mermaidCode: extractMermaidCode(flowchartData.flowchart, flowchartData.mermaidCode),
    vehicle: flowchartData.vehicle,
    issues: flowchartData.issues,
    responses: normalizeResponses(flowchartData.responses),
    nodeContexts: normalizeNodeContexts(flowchartData.nodeContexts),
    createdAt: timestamp,
    updatedAt: timestamp,
    lastRefinedNodeId: '',
    lastRefinedNodeLabel: ''
  };

  flowcharts.push(newRecord);
  const nextFlowcharts = sortFlowchartsByUpdatedAt(flowcharts).slice(0, MAX_FLOWCHARTS);
  await collection.updateOne({ _id: userid }, { $set: { flowcharts: nextFlowcharts } });
  return newRecord;
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
  const { flowcharts } = await getNormalizedUserFlowcharts(collection, userid);
  return sortFlowchartsByUpdatedAt(flowcharts);
}

/**
 * Delete a flowchart by id for a given user
 * @param {string} userid
 * @param {string} flowchartId
 */
export async function deleteFlowchart(userid, flowchartId) {
  if (!userid || !flowchartId) {
    console.log("deleteFlowchart: Missing required fields");
    return "Missing required fields";
  }

  const collection = client.db(DATABASE).collection(USER_COLLECTION);
  const { user, flowcharts } = await getNormalizedUserFlowcharts(collection, userid);
  if (!user || !Array.isArray(flowcharts)) {
    console.log("deleteFlowchart: No flowcharts found for user", userid);
    return "No flowcharts";
  }

  const nextFlowcharts = flowcharts.filter((flowchart) => flowchart.flowchartId !== flowchartId);
  if (nextFlowcharts.length === flowcharts.length) {
    console.log("deleteFlowchart: Flowchart not found", flowchartId);
    return "Flowchart not found";
  }

  await collection.updateOne({ _id: userid }, { $set: { flowcharts: nextFlowcharts } });
  return { success: true };
}

export async function updateFlowchartNodeContext(userid, flowchartId, nodeId, nodeContext) {
  if (!userid || !flowchartId || !nodeId || !nodeContext) {
    console.log("updateFlowchartNodeContext: Missing required fields");
    return "Missing required fields";
  }

  const collection = client.db(DATABASE).collection(USER_COLLECTION);
  const { user, flowcharts } = await getNormalizedUserFlowcharts(collection, userid);
  if (!user) {
    return "User not found";
  }

  const flowchart = flowcharts.find((item) => item.flowchartId === flowchartId);
  if (!flowchart) {
    return "Flowchart not found";
  }

  const updatedAt = new Date().toISOString();

  flowchart.nodeContexts = {
    ...normalizeNodeContexts(flowchart.nodeContexts),
    [nodeId]: {
      ...(flowchart.nodeContexts?.[nodeId] || {}),
      ...nodeContext,
      nodeId,
      updatedAt: nodeContext.updatedAt || updatedAt
    }
  };

  flowchart.updatedAt = updatedAt;

  const sortedFlowcharts = sortFlowchartsByUpdatedAt(flowcharts);
  await collection.updateOne({ _id: userid }, { $set: { flowcharts: sortedFlowcharts } });
  return flowchart;
}

export async function overwriteFlowchart(userid, flowchartId, updates) {
  if (!userid || !flowchartId || !updates?.flowchart || !updates?.mermaidCode) {
    console.log("overwriteFlowchart: Missing required fields");
    return "Missing required fields";
  }

  const collection = client.db(DATABASE).collection(USER_COLLECTION);
  const { user, flowcharts } = await getNormalizedUserFlowcharts(collection, userid);
  if (!user) {
    return "User not found";
  }

  const targetIndex = flowcharts.findIndex((item) => item.flowchartId === flowchartId);
  if (targetIndex === -1) {
    return "Flowchart not found";
  }

  const existing = flowcharts[targetIndex];
  const updatedAt = new Date().toISOString();
  const mergedNodeContexts = normalizeNodeContexts({
    ...existing.nodeContexts,
    ...updates.nodeContexts
  });

  const nextRecord = {
    ...existing,
    vehicle: updates.vehicle || existing.vehicle,
    issues: updates.issues || existing.issues,
    responses: normalizeResponses(updates.responses || existing.responses),
    flowchart: updates.flowchart,
    mermaidCode: extractMermaidCode(updates.flowchart, updates.mermaidCode),
    nodeContexts: mergedNodeContexts,
    updatedAt,
    lastRefinedNodeId: updates.lastRefinedNodeId || existing.lastRefinedNodeId || '',
    lastRefinedNodeLabel: updates.lastRefinedNodeLabel || existing.lastRefinedNodeLabel || ''
  };

  flowcharts[targetIndex] = nextRecord;
  const sortedFlowcharts = sortFlowchartsByUpdatedAt(flowcharts);
  await collection.updateOne({ _id: userid }, { $set: { flowcharts: sortedFlowcharts } });
  return nextRecord;
}

async function getNormalizedUserFlowcharts(collection, userid) {
  const user = await collection.findOne({ _id: userid });
  if (!user) {
    return { user: null, flowcharts: [] };
  }

  const { flowcharts, mutated } = normalizeFlowchartList(user.flowcharts || []);
  if (mutated) {
    await collection.updateOne({ _id: userid }, { $set: { flowcharts } });
  }

  return { user, flowcharts };
}

function normalizeFlowchartList(flowcharts) {
  let mutated = false;
  const total = flowcharts.length;
  const normalized = flowcharts.map((flowchart, index) => {
    const result = normalizeFlowchartRecord(flowchart, index, total);
    if (result.didMutate) {
      mutated = true;
    }
    return result.record;
  });

  return { flowcharts: sortFlowchartsByUpdatedAt(normalized), mutated };
}

function normalizeFlowchartRecord(flowchart, index, total) {
  const fallbackDate = new Date(Date.now() - (total - index) * 1000).toISOString();
  const createdAt = isValidDate(flowchart?.createdAt) ? flowchart.createdAt : fallbackDate;
  const updatedAt = isValidDate(flowchart?.updatedAt) ? flowchart.updatedAt : createdAt;
  const flowchartId = typeof flowchart?.flowchartId === 'string' && flowchart.flowchartId.trim()
    ? flowchart.flowchartId
    : randomUUID();
  const record = {
    flowchartId,
    flowchart: typeof flowchart?.flowchart === 'string' ? flowchart.flowchart : '',
    mermaidCode: extractMermaidCode(flowchart?.flowchart, flowchart?.mermaidCode),
    vehicle: flowchart?.vehicle || {},
    issues: typeof flowchart?.issues === 'string' ? flowchart.issues : '',
    responses: normalizeResponses(flowchart?.responses),
    nodeContexts: normalizeNodeContexts(flowchart?.nodeContexts),
    createdAt,
    updatedAt,
    lastRefinedNodeId: typeof flowchart?.lastRefinedNodeId === 'string' ? flowchart.lastRefinedNodeId : '',
    lastRefinedNodeLabel: typeof flowchart?.lastRefinedNodeLabel === 'string' ? flowchart.lastRefinedNodeLabel : ''
  };

  const didMutate = !flowchart?.flowchartId
    || !isValidDate(flowchart?.createdAt)
    || !isValidDate(flowchart?.updatedAt)
    || !flowchart?.mermaidCode
    || !flowchart?.nodeContexts
    || normalizeResponses(flowchart?.responses).length !== (Array.isArray(flowchart?.responses) ? flowchart.responses.length : 0);

  return { record, didMutate };
}

function normalizeResponses(responses = []) {
  if (!Array.isArray(responses)) {
    return [];
  }

  return responses
    .map((response) => {
      const question = normalizeText(response?.question);
      const answer = normalizeText(response?.answer) || normalizeText(response?.option);
      return question && answer
        ? { question, answer, option: answer }
        : null;
    })
    .filter(Boolean);
}

function normalizeNodeContexts(nodeContexts = {}) {
  if (!nodeContexts || typeof nodeContexts !== 'object' || Array.isArray(nodeContexts)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(nodeContexts)
      .map(([nodeId, context]) => {
        if (!nodeId) {
          return null;
        }

        const guidedPromptKey = normalizeText(context?.guidedPromptKey);
        const guidedPromptLabel = normalizeText(context?.guidedPromptLabel);
        const freeText = normalizeText(context?.freeText);
        const nodeLabel = normalizeText(context?.nodeLabel);
        return [nodeId, {
          nodeId,
          nodeLabel,
          guidedPromptKey,
          guidedPromptLabel,
          freeText,
          lastMode: normalizeText(context?.lastMode) || (guidedPromptKey ? 'guided' : freeText ? 'freeText' : ''),
          updatedAt: isValidDate(context?.updatedAt) ? context.updatedAt : new Date().toISOString()
        }];
      })
      .filter(Boolean)
  );
}

function sortFlowchartsByUpdatedAt(flowcharts = []) {
  return [...flowcharts].sort((left, right) => {
    const leftTime = Date.parse(left?.updatedAt || left?.createdAt || 0);
    const rightTime = Date.parse(right?.updatedAt || right?.createdAt || 0);
    return rightTime - leftTime;
  });
}

function extractMermaidCode(flowchart = '', fallback = '') {
  if (typeof fallback === 'string' && fallback.trim()) {
    return fallback.trim();
  }

  if (typeof flowchart !== 'string') {
    return '';
  }

  const match = flowchart.match(/```mermaid\s*([\s\S]*?)```/i);
  if (match) {
    return match[1].trim();
  }

  return flowchart.trim().startsWith('graph TD') ? flowchart.trim() : '';
}

function normalizeText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim();
}

function isValidDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/**
 * Get all vehicles in the user's garage (with full car details)
 * @param {string} userid
 * @returns {Array<Object>} Array of car objects
 */
export async function getGarage(userid) {
  if (!userid) return [];
  const userCol = client.db(DATABASE).collection(USER_COLLECTION);
  const user = await userCol.findOne({ _id: userid });
  if (!user || !Array.isArray(user.garage) || user.garage.length === 0) return [];

  const carsCol = client.db(DATABASE).collection(CARS_COLLECTION);
  const cars = await carsCol.find({ _id: { $in: user.garage } }).toArray();
  return cars.map(c => ({ _id: c._id.toString(), year: c.year, make: c.make, model: c.model, trim: c.trim }));
}

/**
 * Add a vehicle to the user's garage
 * @param {string} userid
 * @param {Object} vehicle { year, make, model, body_style }
 * @returns {Object} The created car with its _id
 */
export async function addToGarage(userid, vehicle) {
  if (!userid || !vehicle) return "Missing required fields";

  const car = await upsertCar(vehicle);
  if (typeof car === 'string') {
    return car;
  }

  const carId = new ObjectId(car._id);

  // Check if car is already in user's garage (prevent duplicate garage entries)
  const userCol = client.db(DATABASE).collection(USER_COLLECTION);
  const user = await userCol.findOne({ _id: userid });
  const alreadyInGarage = user?.garage?.some(id => id.toString() === carId.toString());
  if (!alreadyInGarage) {
    await userCol.updateOne({ _id: userid }, { $push: { garage: carId } });
  }

  return car;
}

/**
 * Edit a vehicle in the user's garage
 * @param {string} userid
 * @param {string} carId The car's _id
 * @param {Object} updates { year, make, model, body_style }
 * @returns {Object}
 */
export async function editGarageVehicle(userid, carId, updates) {
  if (!userid || !carId || !updates) return "Missing required fields";

  // Verify this car belongs to the user
  const userCol = client.db(DATABASE).collection(USER_COLLECTION);
  const user = await userCol.findOne({ _id: userid });
  if (!user || !Array.isArray(user.garage)) return "User not found";

  const objectId = new ObjectId(carId);
  const owns = user.garage.some(id => id.toString() === objectId.toString());
  if (!owns) return "Vehicle does not belong to this user";

  const carsCol = client.db(DATABASE).collection(CARS_COLLECTION);
  const setFields = {};
  if (updates.year !== undefined) setFields.year = Number(updates.year);
  if (updates.make !== undefined) setFields.make = updates.make;
  if (updates.model !== undefined) setFields.model = updates.model;
  if (updates.trim !== undefined) setFields.trim = updates.trim;

  await carsCol.updateOne({ _id: objectId }, { $set: setFields });
  return { success: true };
}

/**
 * Remove a vehicle from the user's garage
 * @param {string} userid
 * @param {string} carId The car's _id
 * @returns {Object}
 */
export async function removeFromGarage(userid, carId) {
  if (!userid || !carId) return "Missing required fields";

  const objectId = new ObjectId(carId);

  // Remove reference from user's garage
  const userCol = client.db(DATABASE).collection(USER_COLLECTION);
  const user = await userCol.findOne({ _id: userid });
  if (!user || !Array.isArray(user.garage)) return "User not found";

  const owns = user.garage.some(id => id.toString() === objectId.toString());
  if (!owns) return "Vehicle does not belong to this user";

  // Pull both ObjectId and string forms to handle legacy data
  await userCol.updateOne({ _id: userid }, { $pull: { garage: { $in: [objectId, carId] } } });

  // Delete the car document itself
  const carsCol = client.db(DATABASE).collection(CARS_COLLECTION);
  await carsCol.deleteOne({ _id: objectId });

  return { success: true };
}

/**
 * Get distinct values for car fields from the Cars collection
 * Supports optional filters to narrow results (e.g. makes for a given year)
 * @param {Object} filters Optional { year, make, model }
 * @returns {Object} { years, makes, models, trims }
 */
export async function getCarOptions(filters = {}) {
  const carsCol = client.db(DATABASE).collection(CARS_COLLECTION);
  
  // Build query objects for each level
  const yearQuery = {};
  const makeQuery = {};
  const modelQuery = {};
  const trimQuery = {};
  
  if (filters.year) {
    makeQuery.year = Number(filters.year);
    modelQuery.year = Number(filters.year);
    trimQuery.year = Number(filters.year);
  }
  if (filters.make) {
    modelQuery.make = filters.make;
    trimQuery.make = filters.make;
  }
  if (filters.model) {
    trimQuery.model = filters.model;
  }

  // Only fetch trims if year, make, and model are all specified
  const shouldFetchTrims = filters.year && filters.make && filters.model;

  const [years, makes, models, trims] = await Promise.all([
    carsCol.distinct('year', yearQuery),
    carsCol.distinct('make', makeQuery),
    carsCol.distinct('model', modelQuery),
    shouldFetchTrims ? carsCol.distinct('trim', trimQuery) : Promise.resolve([]),
  ]);

  return {
    years: years.filter(Boolean).sort((a, b) => b - a),
    makes: makes.filter(Boolean).sort(),
    models: models.filter(Boolean).sort(),
    trims: trims.filter(Boolean).sort(),
  };
}

export async function upsertCar(vehicle) {
  const normalizedVehicle = normalizeVehicleRecord(vehicle);

  if (!normalizedVehicle) {
    return 'Missing required fields';
  }

  const carsCol = client.db(DATABASE).collection(CARS_COLLECTION);
  const existingCar = await carsCol.findOne(normalizedVehicle);

  if (existingCar) {
    return { _id: existingCar._id.toString(), ...normalizedVehicle };
  }

  const result = await carsCol.insertOne(normalizedVehicle);
  return { _id: result.insertedId.toString(), ...normalizedVehicle };
}

export async function listUsersForAdmin({ search = '', page = 1, pageSize = 25 } = {}) {
  const collection = client.db(DATABASE).collection(USER_COLLECTION);
  const regex = createSearchRegex(search);
  const filter = regex
    ? {
      $or: [
        { _id: regex },
        { name: regex },
        { email: regex },
        { attitude: regex },
        { experienceLevel: regex }
      ]
    }
    : {};

  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    collection.find(filter, {
      projection: {
        _id: 1,
        name: 1,
        email: 1,
        attitude: 1,
        experienceLevel: 1,
        crashOut: 1,
        profilePicture: 1,
        adminAccess: 1,
        createdAt: 1,
        updatedAt: 1,
        garage: 1,
        flowcharts: 1
      }
    }).skip(skip).limit(pageSize).toArray(),
    collection.countDocuments(filter)
  ]);

  return {
    items: items.map((user) => ({
      userId: user._id,
      username: user.name || '',
      email: user.email || '',
      attitude: user.attitude || '',
      experienceLevel: user.experienceLevel || null,
      crashOut: Number(user.crashOut) || 0,
      profilePicture: user.profilePicture || null,
      accessLevel: user.adminAccess?.accessLevel || 'user',
      isAdmin: Boolean(user.adminAccess?.isAdmin),
      createdAt: user.createdAt || null,
      updatedAt: user.updatedAt || null,
      garageCount: Array.isArray(user.garage) ? user.garage.length : 0,
      flowchartCount: Array.isArray(user.flowcharts) ? user.flowcharts.length : 0
    })),
    total,
    page,
    pageSize
  };
}

export async function updateUserRecordForAdmin(userid, updates) {
  if (!userid) {
    return 'A user id is required';
  }

  const existing = await getUserDB(userid);
  if (!existing || typeof existing === 'string') {
    return 'User not found';
  }

  const allowedFields = ['name'];
  const requestedFields = Object.keys(updates || {});
  const unsupportedFields = requestedFields.filter((field) => !allowedFields.includes(field));
  if (unsupportedFields.length > 0) {
    return `Unsupported admin user fields: ${unsupportedFields.join(', ')}`;
  }

  const sanitized = sanitizeUserUpdates(updates, { includeProfilePicture: true });
  if (Object.keys(sanitized).length === 0) {
    return 'No valid fields provided';
  }

  sanitized.updatedAt = new Date().toISOString();
  await updateUserDB(userid, sanitized);
  return { success: true, updates: sanitized };
}

export async function deleteUserRecordForAdmin(userid) {
  if (!userid) {
    return 'A user id is required';
  }

  const collection = client.db(DATABASE).collection(USER_COLLECTION);
  const user = await collection.findOne({ _id: userid });
  if (!user) {
    return 'User not found';
  }

  await collection.deleteOne({ _id: userid });
  return {
    success: true,
    deleted: {
      ...user,
      userId: userid,
      username: user.name || '',
      email: user.email || ''
    }
  };
}

export async function restoreUserRecordForAdmin(snapshot) {
  const userId = snapshot?.userId || snapshot?._id;
  if (!userId) {
    return 'A valid user snapshot is required';
  }

  const collection = client.db(DATABASE).collection(USER_COLLECTION);
  const existing = await collection.findOne({ _id: userId });
  if (existing) {
    return 'User already exists';
  }

  const restoredUser = {
    ...snapshot,
    _id: userId
  };
  delete restoredUser.userId;
  delete restoredUser.username;

  await collection.insertOne(restoredUser);
  return { success: true, restored: { userId } };
}

export async function listVehiclesForAdmin({ search = '', page = 1, pageSize = 25 } = {}) {
  const collection = client.db(DATABASE).collection(CARS_COLLECTION);
  const filter = createVehicleSearchFilter(search);
  const skip = (page - 1) * pageSize;
  const [cars, total, userDocs] = await Promise.all([
    collection.find(filter).skip(skip).limit(pageSize).toArray(),
    collection.countDocuments(filter),
    client.db(DATABASE).collection(USER_COLLECTION).find({}, { projection: { _id: 1, garage: 1 } }).toArray()
  ]);
  const usageMap = new Map();
  for (const user of userDocs) {
    for (const garageId of Array.isArray(user.garage) ? user.garage : []) {
      const key = garageId?.toString();
      if (!key) {
        continue;
      }
      usageMap.set(key, (usageMap.get(key) || 0) + 1);
    }
  }

  return {
    items: cars.map((car) => ({
      carId: car._id.toString(),
      year: car.year,
      make: car.make,
      model: car.model,
      trim: car.trim || '',
      garageUsageCount: usageMap.get(car._id.toString()) || 0
    })),
    total,
    page,
    pageSize
  };
}

export async function updateVehicleRecordForAdmin(carId, updates) {
  if (!isValidObjectIdString(carId)) {
    return 'A valid vehicle id is required';
  }

  const normalizedVehicle = normalizeVehicleRecord(updates);
  if (!normalizedVehicle) {
    return 'Vehicle updates must include a valid year, make, and model';
  }

  const objectId = new ObjectId(carId);
  const carsCol = client.db(DATABASE).collection(CARS_COLLECTION);
  const existing = await carsCol.findOne({ _id: objectId });
  if (!existing) {
    return 'Vehicle not found';
  }

  await carsCol.updateOne({ _id: objectId }, { $set: normalizedVehicle });
  return { success: true, updates: normalizedVehicle };
}

export async function deleteVehicleRecordForAdmin(carId) {
  if (!isValidObjectIdString(carId)) {
    return 'A valid vehicle id is required';
  }

  const objectId = new ObjectId(carId);
  const carsCol = client.db(DATABASE).collection(CARS_COLLECTION);
  const existing = await carsCol.findOne({ _id: objectId });
  if (!existing) {
    return 'Vehicle not found';
  }

  await Promise.all([
    carsCol.deleteOne({ _id: objectId }),
    client.db(DATABASE).collection(USER_COLLECTION).updateMany({}, { $pull: { garage: objectId } })
  ]);

  return {
    success: true,
    deleted: {
      ...existing,
      carId,
      year: existing.year,
      make: existing.make,
      model: existing.model,
      trim: existing.trim || ''
    }
  };
}

export async function restoreVehicleRecordForAdmin(snapshot) {
  const carId = snapshot?.carId || snapshot?._id?.toString?.() || snapshot?._id;
  if (!isValidObjectIdString(carId)) {
    return 'A valid vehicle snapshot is required';
  }

  const objectId = new ObjectId(carId);
  const carsCol = client.db(DATABASE).collection(CARS_COLLECTION);
  const existing = await carsCol.findOne({ _id: objectId });
  if (existing) {
    return 'Vehicle already exists';
  }

  const restoredVehicle = {
    ...snapshot,
    _id: objectId
  };
  delete restoredVehicle.carId;

  await carsCol.insertOne(restoredVehicle);
  return { success: true, restored: { carId } };
}

export async function listFlowchartsForAdmin({ search = '', page = 1, pageSize = 25 } = {}) {
  const collection = client.db(DATABASE).collection(USER_COLLECTION);
  const regex = createSearchRegex(search);
  const users = await collection.find({}, {
    projection: {
      _id: 1,
      name: 1,
      email: 1,
      flowcharts: 1
    }
  }).toArray();

  const records = users.flatMap((user) => {
    const normalized = normalizeFlowchartList(user.flowcharts || []).flowcharts;
    return normalized.map((flowchart) => ({
      ownerUserId: user._id,
      ownerName: user.name || '',
      ownerEmail: user.email || '',
      flowchartId: flowchart.flowchartId,
      vehicle: flowchart.vehicle || {},
      issues: flowchart.issues || '',
      responses: flowchart.responses || [],
      nodeContexts: flowchart.nodeContexts || {},
      flowchart: flowchart.flowchart || '',
      mermaidCode: flowchart.mermaidCode || '',
      lastRefinedNodeId: flowchart.lastRefinedNodeId || '',
      lastRefinedNodeLabel: flowchart.lastRefinedNodeLabel || '',
      createdAt: flowchart.createdAt || null,
      updatedAt: flowchart.updatedAt || null
    }));
  });

  const filtered = regex
    ? records.filter((record) => regex.test([
      record.ownerUserId,
      record.ownerName,
      record.ownerEmail,
      record.vehicle?.year,
      record.vehicle?.make,
      record.vehicle?.model,
      record.vehicle?.trim,
      record.issues,
      record.lastRefinedNodeLabel
    ].filter(Boolean).join(' ')))
    : records;

  filtered.sort((left, right) => {
    const leftTime = Date.parse(left?.createdAt || 0);
    const rightTime = Date.parse(right?.createdAt || 0);
    return rightTime - leftTime;
  });

  const total = filtered.length;
  const startIndex = (page - 1) * pageSize;
  return {
    items: filtered.slice(startIndex, startIndex + pageSize),
    total,
    page,
    pageSize
  };
}

export async function deleteFlowchartForAdmin(ownerUserId, flowchartId) {
  if (!ownerUserId || !flowchartId) {
    return 'Owner id and flowchart id are required';
  }

  const collection = client.db(DATABASE).collection(USER_COLLECTION);
  const { user, flowcharts } = await getNormalizedUserFlowcharts(collection, ownerUserId);
  if (!user) {
    return 'User not found';
  }

  const existing = flowcharts.find((flowchart) => flowchart.flowchartId === flowchartId);
  if (!existing) {
    return 'Flowchart not found';
  }

  const result = await deleteFlowchart(ownerUserId, flowchartId);
  if (typeof result === 'string') {
    return result;
  }

  return {
    success: true,
    deleted: {
      ownerUserId,
      ownerName: user.name || '',
      ownerEmail: user.email || '',
      flowchart: existing
    }
  };
}

export async function restoreFlowchartRecordForAdmin(snapshot) {
  const ownerUserId = snapshot?.ownerUserId;
  const flowchart = snapshot?.flowchart;
  if (!ownerUserId || !flowchart?.flowchartId) {
    return 'A valid flowchart snapshot is required';
  }

  const collection = client.db(DATABASE).collection(USER_COLLECTION);
  const { user, flowcharts } = await getNormalizedUserFlowcharts(collection, ownerUserId);
  if (!user) {
    return 'User not found';
  }

  if (flowcharts.some((entry) => entry.flowchartId === flowchart.flowchartId)) {
    return 'Flowchart already exists';
  }

  const normalizedFlowchart = normalizeFlowchartRecord(flowchart, flowcharts.length, flowcharts.length + 1).record;
  const nextFlowcharts = sortFlowchartsByUpdatedAt([...flowcharts, normalizedFlowchart]);
  await collection.updateOne(
    { _id: ownerUserId },
    {
      $set: {
        flowcharts: nextFlowcharts,
        updatedAt: new Date().toISOString()
      }
    }
  );

  return {
    success: true,
    restored: {
      ownerUserId,
      flowchartId: normalizedFlowchart.flowchartId
    }
  };
}

/**
 * Increment the crashOut counter for a user
 * Uses atomic $inc operator to avoid race conditions
 * @param {string} userid The user identifier
 * @returns {Object} The updated user document with the new crashOut value
 */
export async function incrementCrashOut(userid) {
  if (!userid) {
    console.log("incrementCrashOut: Missing userid");
    return "Missing required fields";
  }

  const collection = client.db(DATABASE).collection(USER_COLLECTION);
  
  // Use atomic $inc operator to increment
  const result = await collection.findOneAndUpdate(
    { _id: userid },
    { 
      $inc: { crashOut: 1 }
    },
    { returnDocument: 'after' }
  );

  console.log("incrementCrashOut result:", result);

  // findOneAndUpdate returns the document directly or in result.value depending on driver version
  const userDoc = result && result.value ? result.value : result;

  if (!userDoc) {
    console.log("incrementCrashOut: User not found", userid);
    return "User not found";
  }

  const newValue = userDoc.crashOut || 1;
  console.log("incrementCrashOut: Updated crashOut to", newValue);
  return { success: true, crashOut: newValue };
}

function sanitizeUserUpdates(updates, { includeProfilePicture }) {
  const sanitized = {};

  if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
    const name = normalizeText(updates.name).slice(0, 120);
    if (!name) {
      throw new Error('Name is required.');
    }
    sanitized.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'attitude')) {
    sanitized.attitude = normalizeText(updates.attitude, 300);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'experienceLevel')) {
    const experienceLevel = normalizeExperienceLevelValue(updates.experienceLevel);
    if (updates.experienceLevel !== null && !experienceLevel) {
      throw new Error('Experience level must be Beginner, Intermediate, or Expert.');
    }
    sanitized.experienceLevel = experienceLevel;
  }

  if (includeProfilePicture && Object.prototype.hasOwnProperty.call(updates, 'profilePicture')) {
    if (updates.profilePicture === null || updates.profilePicture === '') {
      sanitized.profilePicture = null;
    } else if (typeof updates.profilePicture === 'string' && updates.profilePicture.startsWith('data:image/')) {
      sanitized.profilePicture = updates.profilePicture;
    } else {
      throw new Error('Profile picture must be a valid image data URL.');
    }
  }

  return sanitized;
}

function createSearchRegex(value) {
  const normalized = normalizeText(value, 120);
  if (!normalized) {
    return null;
  }

  return new RegExp(normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

function createSearchTokens(value) {
  const normalized = normalizeText(value, 120);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function createVehicleSearchFilter(search) {
  const tokens = createSearchTokens(search);
  if (tokens.length === 0) {
    return {};
  }

  return {
    $and: tokens.map((token) => {
      const numericToken = Number.parseInt(token, 10);
      const isYearToken = /^\d{4}$/.test(token) && Number.isInteger(numericToken);

      if (isYearToken) {
        return {
          $or: [
            { year: numericToken },
            { make: createSearchRegex(token) },
            { model: createSearchRegex(token) },
            { trim: createSearchRegex(token) }
          ]
        };
      }

      const regex = createSearchRegex(token);
      return {
        $or: [
          { make: regex },
          { model: regex },
          { trim: regex }
        ]
      };
    })
  };
}

function normalizeExperienceLevelValue(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalized = normalizeText(value, 40);
  return VALID_EXPERIENCE_LEVELS.has(normalized) ? normalized : null;
}

function isValidObjectIdString(value) {
  return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
}

