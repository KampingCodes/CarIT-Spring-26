import express from 'express';
// import https from 'https';
// import fs from 'fs';
import { auth } from 'express-oauth2-jwt-bearer';
import cors from 'cors';
import { createUser, getUserDB, updateUserDB, getUserAuth0, getFlowcharts, saveFlowchart, deleteFlowchart, getGarage, addToGarage, editGarageVehicle, removeFromGarage, getCarOptions } from './user.js';
import { client } from './mongo.js';
import { getResponse, generateQuestionsPrompt, generateFlowchartPrompt } from './genai.js';
import { getFields as filterFields } from './helper.js';

// const options = {
//   key: fs.readFileSync('CARIT_PRIVATEKEY.key'),
//   cert: fs.readFileSync('CARIT_CRT.crt'),
//   passphrase: 'carit'
// };

// Create an Express app
const app = express();

app.use(express.json());

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

  app.post('/api/generate', validateAuth, async (req, res) => {
    const msg = req.body.contents;
    const response = await getResponse(msg);
    res.send(response);
  });
  
  app.post('/api/gen-questions', validateAuth, async (req, res) => {
    const { vehicle, issues } = req.body;
    const msg = generateQuestionsPrompt(vehicle, issues);
    const response = await getResponse(msg);
    res.send(response);
  });

  app.post('/api/gen-flowchart', validateAuth, async (req, res) => {
    const { vehicle, issues, responses } = req.body;
    const msg = generateFlowchartPrompt(vehicle, issues, responses);
    const response = await getResponse(msg);
    await saveFlowchart(req.headers.userid, response, vehicle, issues, responses);
    res.send(response);
  });

  app.get('/api/get-flowcharts', validateAuth, async (req, res) => {
    const flowcharts = await getFlowcharts(req.headers.userid);
    res.send(flowcharts);
  });

  app.post('/api/delete-flowchart', validateAuth, async (req, res) => {
    try {
      const { index } = req.body;
      const result = await deleteFlowchart(req.headers.userid, index);
      if (result && result.success) return res.json({ success: true });
      return res.status(400).json({ success: false, message: result });
    } catch (err) {
      console.error('Error deleting flowchart:', err);
      return res.status(500).json({ success: false, message: err?.message || String(err) });
    }
  });

  app.get('/api/get-user-data', validateAuth, async (req, res) => {
    const dbUser = await getUserDB(req.headers.userid);
    let readData = filterFields(dbUser, ["name", "email", "experienceLevel"]);
    res.send(readData);
  });

  app.post('/api/set-user-data', validateAuth, async (req, res) => {
    let setData = filterFields(req.body, ["name", "email", "experienceLevel"]);
    await updateUserDB(req.headers.userid, setData);
    res.send({ success: true });
  })

  // ---- Car options endpoint ----
  app.get('/api/car-options', validateAuth, async (req, res) => {
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