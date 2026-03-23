import express from 'express';
// import https from 'https';
// import fs from 'fs';
import { auth } from 'express-oauth2-jwt-bearer';
import cors from 'cors';
import { createUser, getUserDB, updateUserDB, getUserAuth0, getFlowcharts, deleteFlowchart, getGarage, addToGarage, editGarageVehicle, removeFromGarage, getCarOptions, incrementCrashOut, upsertCar } from './user.js';
import { client } from './mongo.js';
import { getResponse, generateQuestionsPrompt } from './genai.js';
import { getFields as filterFields } from './helper.js';
import { generateInitialFlowchartForUser } from './flowchartGeneration.js';

// const options = {
//   key: fs.readFileSync('CARIT_PRIVATEKEY.key'),
//   cert: fs.readFileSync('CARIT_CRT.crt'),
//   passphrase: 'carit'
// };

// Create an Express app
const app = express();

// Increase JSON payload limit to handle base64-encoded images (3.75MB image + encoding overhead up to 5MB)
app.use(express.json({ limit: '10mb' }));

// Enable CORS
app.use(cors({
  origin: 'https://localhost:5173', // Allow requests from your Vue dev server
  credentials: true // If you’re using cookies or Authorization headers
}));

// Middleware to validate access tokens
const validateAuth = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
});

const guestAiRateLimitStore = new Map();
const AI_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const AI_RATE_LIMITS = {
  '/api/gen-questions': { authenticated: 20, guest: 6 },
  '/api/gen-flowchart': { authenticated: 10, guest: 3 },
  '/api/generate': { authenticated: 20, guest: 4 }
};

function optionalValidateAuth(req, res, next) {
  if (!req.headers.authorization) {
    return next();
  }

  return validateAuth(req, res, (err) => {
    if (err) {
      return res.status(Number(err?.status) || 401).json({
        success: false,
        message: err?.message || 'Unauthorized'
      });
    }

    return next();
  });
}

function aiRateLimit(req, res, next) {
  const limitConfig = AI_RATE_LIMITS[req.path];
  if (!limitConfig) {
    return next();
  }

  const isAuthenticated = Boolean(req.headers.authorization && req.headers.userid);
  const limit = isAuthenticated ? limitConfig.authenticated : limitConfig.guest;
  const clientKey = isAuthenticated
    ? `user:${req.headers.userid}`
    : `guest:${req.ip}:${req.get('user-agent') || 'unknown'}`;
  const requestKey = `${req.path}:${clientKey}`;
  const now = Date.now();
  const windowStart = now - AI_RATE_LIMIT_WINDOW_MS;
  const previousHits = guestAiRateLimitStore.get(requestKey) || [];
  const recentHits = previousHits.filter((timestamp) => timestamp > windowStart);

  if (recentHits.length >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((recentHits[0] + AI_RATE_LIMIT_WINDOW_MS - now) / 1000));
    res.set('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      success: false,
      message: `Too many ${isAuthenticated ? 'authenticated' : 'guest'} AI requests. Please wait ${retryAfterSeconds} seconds and try again.`,
      retryAfterSeconds
    });
  }

  recentHits.push(now);
  guestAiRateLimitStore.set(requestKey, recentHits);

  if (guestAiRateLimitStore.size > 5000) {
    for (const [key, timestamps] of guestAiRateLimitStore.entries()) {
      const activeTimestamps = timestamps.filter((timestamp) => timestamp > windowStart);
      if (activeTimestamps.length === 0) {
        guestAiRateLimitStore.delete(key);
      } else {
        guestAiRateLimitStore.set(key, activeTimestamps);
      }
    }
  }

  return next();
}

function sendApiError(res, err, fallbackMessage) {
  const status = Number(err?.status) || 500;
  const retryAfterSeconds = getRetryAfterSeconds(err);
  const isQuotaError = status === 429;
  const message = isQuotaError
    ? `AI request limit reached. Please wait ${retryAfterSeconds ? `${retryAfterSeconds} seconds` : 'a bit'} and try again.`
    : err?.message || fallbackMessage;

  if (retryAfterSeconds) {
    res.set('Retry-After', String(retryAfterSeconds));
  }

  return res.status(isQuotaError ? 429 : status).json({
    success: false,
    message,
    retryAfterSeconds: retryAfterSeconds || null
  });
}

function getRetryAfterSeconds(err) {
  const retryDelay = err?.errorDetails
    ?.find((detail) => detail?.['@type'] === 'type.googleapis.com/google.rpc.RetryInfo')
    ?.retryDelay;

  if (typeof retryDelay !== 'string') {
    return null;
  }

  const match = retryDelay.match(/(\d+(?:\.\d+)?)s/i);
  if (!match) {
    return null;
  }

  return Math.max(1, Math.ceil(Number(match[1])));
}

/**
 * Start the server
 */
(function startServer() {
  app.get('/', (req, res) => {
    res.send('Server is running!');
  });


  app.post('/api/create-user', validateAuth, async (req, res) => {
    const user = await getUserAuth0(req.headers.authorization);
    const msg = await createUser(user.sub, user.name, user.email);
    res.send(msg);
  });

  app.post('/api/generate', optionalValidateAuth, aiRateLimit, async (req, res) => {
    const msg = req.body.contents;
    const response = await getResponse(msg);
    res.send(response);
  });
  
  app.post('/api/gen-questions', optionalValidateAuth, aiRateLimit, async (req, res) => {
    const { vehicle, issues } = req.body;

    const msg = generateQuestionsPrompt(vehicle, issues);
    const response = await getResponse(msg);
    res.send(response);
  });

  app.post('/api/gen-flowchart', optionalValidateAuth, aiRateLimit, async (req, res) => {
    try {
      const { vehicle, issues, responses } = req.body;
      const flowchartRecord = await generateInitialFlowchartForUser({
        userid: req.headers.userid,
        vehicle,
        issues,
        responses,
        persist: Boolean(req.headers.authorization && req.headers.userid)
      });
      res.json(flowchartRecord);
    } catch (err) {
      console.error('Error generating flowchart:', err);
      sendApiError(res, err, 'Unable to generate flowchart');
    }
  });

  app.get('/api/get-flowcharts', validateAuth, async (req, res) => {
    const flowcharts = await getFlowcharts(req.headers.userid);
    res.send(flowcharts);
  });

  app.post('/api/delete-flowchart', validateAuth, async (req, res) => {
    try {
      const { flowchartId } = req.body;
      const result = await deleteFlowchart(req.headers.userid, flowchartId);
      if (result && result.success) return res.json({ success: true });
      return res.status(400).json({ success: false, message: result });
    } catch (err) {
      console.error('Error deleting flowchart:', err);
      return res.status(500).json({ success: false, message: err?.message || String(err) });
    }
  });

  app.get('/api/get-user-data', validateAuth, async (req, res) => {
    const dbUser = await getUserDB(req.headers.userid);
    let readData = filterFields(dbUser, ["name", "email", "experienceLevel", "profilePicture", "crashOut"]);
    res.send(readData);
  });

  app.post('/api/set-user-data', validateAuth, async (req, res) => {
    let setData = filterFields(req.body, ["name", "email", "experienceLevel"]);
    await updateUserDB(req.headers.userid, setData);
    res.send({ success: true });
  })

  app.post('/api/upload-profile-picture', validateAuth, async (req, res) => {
    try {
      const { profilePicture } = req.body;
      
      if (!profilePicture || typeof profilePicture !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid profile picture data' });
      }

      // Validate that it's a valid data URL
      if (!profilePicture.startsWith('data:image/')) {
        return res.status(400).json({ success: false, message: 'Invalid image format' });
      }

      // Validate size (base64 encoded)
      const sizeInBytes = Buffer.byteLength(profilePicture, 'utf8');
      const maxSizeBytes = 10 * 1024 * 1024; // 10MB after encoding
      if (sizeInBytes > maxSizeBytes) {
        return res.status(400).json({ success: false, message: 'Image too large' });
      }

      await updateUserDB(req.headers.userid, { profilePicture });
      res.json({ success: true });
    } catch (err) {
      console.error('Error uploading profile picture:', err);
      res.status(500).json({ success: false, message: err?.message || String(err) });
    }
  })

  // ---- Car options endpoint ----
  app.get('/api/car-options', optionalValidateAuth, async (req, res) => {
    try {
      const filters = {};
      if (req.query.year) filters.year = req.query.year;
      if (req.query.make) filters.make = req.query.make;
      if (req.query.model) filters.model = req.query.model;
      const options = await getCarOptions(filters);
      res.json(options);
    } catch (err) {
      console.error('Error fetching car options:', err);
      res.status(500).json({ success: false, message: err?.message || String(err) });
    }
  });

  app.post('/api/cars/add', async (req, res) => {
    try {
      const car = await upsertCar(req.body);
      if (typeof car === 'string') {
        return res.status(400).json({ success: false, message: car });
      }

      return res.json({ success: true, car });
    } catch (err) {
      console.error('Error adding car to Cars collection:', err);
      return res.status(500).json({ success: false, message: err?.message || String(err) });
    }
  });

  // ---- Garage endpoints ----
  app.get('/api/garage', validateAuth, async (req, res) => {
    try {
      const cars = await getGarage(req.headers.userid);
      res.json(cars);
    } catch (err) {
      console.error('Error fetching garage:', err);
      res.status(500).json({ success: false, message: err?.message || String(err) });
    }
  });

  app.post('/api/garage/add', validateAuth, async (req, res) => {
    try {
      const car = await addToGarage(req.headers.userid, req.body);
      if (typeof car === 'string') return res.status(400).json({ success: false, message: car });
      res.json({ success: true, car });
    } catch (err) {
      console.error('Error adding to garage:', err);
      res.status(500).json({ success: false, message: err?.message || String(err) });
    }
  });

  app.post('/api/garage/edit', validateAuth, async (req, res) => {
    try {
      const { carId, updates } = req.body;
      const result = await editGarageVehicle(req.headers.userid, carId, updates);
      if (typeof result === 'string') return res.status(400).json({ success: false, message: result });
      res.json(result);
    } catch (err) {
      console.error('Error editing garage vehicle:', err);
      res.status(500).json({ success: false, message: err?.message || String(err) });
    }
  });

  app.post('/api/garage/remove', validateAuth, async (req, res) => {
    try {
      const { carId } = req.body;
      const result = await removeFromGarage(req.headers.userid, carId);
      if (typeof result === 'string') return res.status(400).json({ success: false, message: result });
      res.json(result);
    } catch (err) {
      console.error('Error removing from garage:', err);
      res.status(500).json({ success: false, message: err?.message || String(err) });
    }
  });

  // ---- Crash Out endpoint ----
  app.post('/api/crash-out', validateAuth, async (req, res) => {
    try {
      console.log('Crash out endpoint called with userid:', req.headers.userid);
      const result = await incrementCrashOut(req.headers.userid);
      console.log('Crash out result:', result);
      if (typeof result === 'string') return res.status(400).json({ success: false, message: result });
      res.json(result);
    } catch (err) {
      console.error('Error incrementing crash out counter:', err);
      res.status(500).json({ success: false, message: err?.message || String(err) });
    }
  });

  app.listen(3000, () => {
    console.log('Server is running on port 3000');
  });

  // https.createServer(options, app).listen(3000, () => {
  //   console.log('Server is running on port 3000');
  // });

  process.on('SIGINT', () => {
    console.log('Server is shutting down...');
    client.close();
    process.exit(0);
  });
})();
