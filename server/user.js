import { DATABASE, USER_COLLECTION, CARS_COLLECTION } from './config.js';
import { client } from './mongo.js';
import { ObjectId } from 'mongodb';

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
  const user = { _id: userid, name: name, flowcharts: [], email: email || "", attitude: "", crashOut: 0, garage: [], experienceLevel: null };

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

  const carsCol = client.db(DATABASE).collection(CARS_COLLECTION);
  const carQuery = {
    year: Number(vehicle.year),
    make: vehicle.make,
    model: vehicle.model,
    trim: vehicle.trim || ""
  };

  // Find or create the car document (prevent duplicates in Cars collection)
  let existingCar = await carsCol.findOne(carQuery);
  let carId;
  if (existingCar) {
    carId = existingCar._id;
  } else {
    const result = await carsCol.insertOne({ ...carQuery });
    carId = result.insertedId;
  }

  // Check if car is already in user's garage (prevent duplicate garage entries)
  const userCol = client.db(DATABASE).collection(USER_COLLECTION);
  const user = await userCol.findOne({ _id: userid });
  const alreadyInGarage = user?.garage?.some(id => id.toString() === carId.toString());
  if (!alreadyInGarage) {
    await userCol.updateOne({ _id: userid }, { $push: { garage: carId } });
  }

  return { _id: carId.toString(), ...carQuery };
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
