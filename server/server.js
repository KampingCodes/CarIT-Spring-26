import express from 'express';
// import https from 'https';
// import fs from 'fs';
import { auth } from 'express-oauth2-jwt-bearer';
import cors from 'cors';
import {
  createUser,
  getUserDB,
  updateUserDB,
  updateOwnUserProfile,
  getUserAuth0,
  getFlowcharts,
  deleteFlowchart,
  getGarage,
  addToGarage,
  editGarageVehicle,
  removeFromGarage,
  getCarOptions,
  incrementCrashOut,
  upsertCar,
  listUsersForAdmin,
  updateUserRecordForAdmin,
  deleteUserRecordForAdmin,
  listVehiclesForAdmin,
  updateVehicleRecordForAdmin,
  deleteVehicleRecordForAdmin,
  restoreVehicleRecordForAdmin,
  listFlowchartsForAdmin,
  restoreFlowchartRecordForAdmin,
  deleteFlowchartForAdmin,
  restoreUserRecordForAdmin
} from './user.js';
import { client } from './mongo.js';
import { getResponse, generateQuestionsPrompt } from './genai.js';
import { getFields as filterFields, normalizeAccessLevel, parsePagination } from './helper.js';
import { generateInitialFlowchartForUser } from './flowchartGeneration.js';
import { AI_RATE_LIMITS, AI_RATE_LIMIT_WINDOW_MS, createAiRateLimit, createOptionalValidateAuth, getRetryAfterSeconds } from './aiMiddleware.js';
import {
  createAdminError,
  getAuthenticatedUserId,
  grantAdminAccess,
  getAuditEventById,
  isSuperAdminStatus,
  listAdminAccounts,
  listAuditEvents,
  logAuditEvent,
  markAuditEventRestored,
  requireAdmin,
  requireSuperAdmin,
  revokeAdminAccess,
  syncUserAdminMirror
} from './admin.js';

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

const optionalValidateAuth = createOptionalValidateAuth(validateAuth);
const aiRateLimit = createAiRateLimit({
  store: new Map(),
  rateLimits: AI_RATE_LIMITS,
  windowMs: AI_RATE_LIMIT_WINDOW_MS
});

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

function sendJsonError(res, err, fallbackMessage = 'Request failed') {
  const status = Number(err?.status) || 500;
  return res.status(status).json({
    success: false,
    message: err?.message || fallbackMessage
  });
}

function getRequestUserId(req) {
  return getAuthenticatedUserId(req);
}

/**
 * Start the server
 */
(function startServer() {
  app.get('/', (req, res) => {
    res.send('Server is running!');
  });

  app.post('/api/create-user', validateAuth, async (req, res) => {
    try {
      const userId = getRequestUserId(req);
      const user = await getUserAuth0(req.headers.authorization);
      const msg = await createUser(userId, user.name, user.email);
      const adminAccess = await syncUserAdminMirror(userId);
      res.send({ message: msg, adminAccess });
    } catch (err) {
      console.error('Error creating user:', err);
      sendJsonError(res, err, 'Unable to create user.');
    }
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
      const userId = getRequestUserId(req);
      const flowchartRecord = await generateInitialFlowchartForUser({
        userid: userId,
        vehicle,
        issues,
        responses,
        persist: Boolean(req.headers.authorization && userId)
      });
      res.json(flowchartRecord);
    } catch (err) {
      console.error('Error generating flowchart:', err);
      sendApiError(res, err, 'Unable to generate flowchart');
    }
  });

  app.get('/api/get-flowcharts', validateAuth, async (req, res) => {
    const flowcharts = await getFlowcharts(getRequestUserId(req));
    res.send(flowcharts);
  });

  app.post('/api/delete-flowchart', validateAuth, async (req, res) => {
    try {
      const { flowchartId } = req.body;
      const result = await deleteFlowchart(getRequestUserId(req), flowchartId);
      if (result && result.success) return res.json({ success: true });
      return res.status(400).json({ success: false, message: result });
    } catch (err) {
      console.error('Error deleting flowchart:', err);
      return res.status(500).json({ success: false, message: err?.message || String(err) });
    }
  });

  app.get('/api/get-user-data', validateAuth, async (req, res) => {
    const dbUser = await getUserDB(getRequestUserId(req));
    let readData = filterFields(dbUser, ["name", "email", "experienceLevel", "profilePicture", "crashOut", "adminAccess"]);
    res.send(readData);
  });

  app.post('/api/set-user-data', validateAuth, async (req, res) => {
    try {
      const result = await updateOwnUserProfile(getRequestUserId(req), req.body || {});
      if (typeof result === 'string') {
        return res.status(400).json({ success: false, message: result });
      }

      res.send({ success: true });
    } catch (err) {
      sendJsonError(res, err, 'Unable to update user data.');
    }
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

      await updateUserDB(getRequestUserId(req), { profilePicture, updatedAt: new Date().toISOString() });
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
      const cars = await getGarage(getRequestUserId(req));
      res.json(cars);
    } catch (err) {
      console.error('Error fetching garage:', err);
      res.status(500).json({ success: false, message: err?.message || String(err) });
    }
  });

  app.post('/api/garage/add', validateAuth, async (req, res) => {
    try {
      const car = await addToGarage(getRequestUserId(req), req.body);
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
      const result = await editGarageVehicle(getRequestUserId(req), carId, updates);
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
      const result = await removeFromGarage(getRequestUserId(req), carId);
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
      const userId = getRequestUserId(req);
      console.log('Crash out endpoint called with userid:', userId);
      const result = await incrementCrashOut(userId);
      console.log('Crash out result:', result);
      if (typeof result === 'string') return res.status(400).json({ success: false, message: result });
      res.json(result);
    } catch (err) {
      console.error('Error incrementing crash out counter:', err);
      res.status(500).json({ success: false, message: err?.message || String(err) });
    }
  });

  app.get('/api/admin/status', validateAuth, async (req, res) => {
    try {
      const userId = getRequestUserId(req);
      const status = await syncUserAdminMirror(userId);
      res.json({
        success: true,
        userId,
        isAdmin: status.isAdmin,
        accessLevel: status.accessLevel,
        source: status.source
      });
    } catch (err) {
      sendJsonError(res, err, 'Unable to load admin status.');
    }
  });

  app.get('/api/admin/accounts', validateAuth, requireSuperAdmin, async (req, res) => {
    try {
      const result = await listAdminAccounts(req.query || {});
      res.json({ success: true, ...result });
    } catch (err) {
      sendJsonError(res, err, 'Unable to load admin accounts.');
    }
  });

  app.get('/api/admin/audit-logs', validateAuth, requireAdmin, async (req, res) => {
    try {
      const result = await listAuditEvents(req.query || {}, {
        includeSensitive: isSuperAdminStatus(req.userContext.adminStatus)
      });
      res.json({ success: true, ...result });
    } catch (err) {
      sendJsonError(res, err, 'Unable to load audit logs.');
    }
  });

  app.post('/api/admin/accounts/grant', validateAuth, requireSuperAdmin, async (req, res) => {
    try {
      const actorUserId = req.userContext.userId;
      const { targetUserId, accessLevel } = req.body || {};
      const targetUser = await getUserDB(targetUserId);
      if (!targetUser) {
        throw createAdminError(404, 'Grant admin access only to an existing user account.');
      }

      const status = await grantAdminAccess(targetUserId, actorUserId, normalizeAccessLevel(accessLevel));
      await logAuditEvent({
        actorUserId,
        action: 'admin.grant',
        targetType: 'user',
        targetId: targetUserId,
        targetLabel: targetUser.email || targetUser.name || targetUserId,
        changes: {
          accessLevel: status.accessLevel,
          isAdmin: true
        }
      });

      res.json({ success: true, adminAccess: status });
    } catch (err) {
      sendJsonError(res, err, 'Unable to grant admin access.');
    }
  });

  app.post('/api/admin/accounts/revoke', validateAuth, requireSuperAdmin, async (req, res) => {
    try {
      const actorUserId = req.userContext.userId;
      const { targetUserId } = req.body || {};
      const targetUser = await getUserDB(targetUserId);
      const result = await revokeAdminAccess(targetUserId, actorUserId);

      await logAuditEvent({
        actorUserId,
        action: 'admin.revoke',
        targetType: 'user',
        targetId: targetUserId,
        targetLabel: targetUser?.email || targetUser?.name || targetUserId,
        changes: {
          isAdmin: false
        }
      });

      res.json(result);
    } catch (err) {
      sendJsonError(res, err, 'Unable to revoke admin access.');
    }
  });

  app.get('/api/admin/users', validateAuth, requireAdmin, async (req, res) => {
    try {
      const pagination = parsePagination(req.query, { pageSize: 12 });
      const result = await listUsersForAdmin({
        search: req.query.search || '',
        page: pagination.page,
        pageSize: pagination.pageSize
      });
      res.json({ success: true, ...result });
    } catch (err) {
      sendJsonError(res, err, 'Unable to load users.');
    }
  });

  app.post('/api/admin/audit-logs/:auditId/restore', validateAuth, requireAdmin, async (req, res) => {
    try {
      const actorUserId = req.userContext.userId;
      const adminStatus = req.userContext.adminStatus;
      const { auditId } = req.params;
      const entry = await getAuditEventById(auditId);
      if (!entry) {
        throw createAdminError(404, 'Audit entry not found.');
      }

      if (entry.action !== 'record.delete') {
        throw createAdminError(400, 'Only deleted records can be restored from the audit log.');
      }

      if (entry.restoredAt) {
        throw createAdminError(400, 'This audit entry has already been restored.');
      }

      if (!entry.metadata) {
        throw createAdminError(400, 'This audit entry does not contain enough data to restore.');
      }

      if (entry.targetType === 'user' && !isSuperAdminStatus(adminStatus)) {
        throw createAdminError(403, 'Only superadmins can restore deleted user records.');
      }

      let result;
      if (entry.targetType === 'user') {
        result = await restoreUserRecordForAdmin(entry.metadata);
        if (typeof result === 'string') {
          throw createAdminError(400, result);
        }
        await syncUserAdminMirror(result.restored.userId);
      } else if (entry.targetType === 'vehicle') {
        result = await restoreVehicleRecordForAdmin(entry.metadata);
        if (typeof result === 'string') {
          throw createAdminError(400, result);
        }
      } else if (entry.targetType === 'flowchart') {
        result = await restoreFlowchartRecordForAdmin(entry.metadata);
        if (typeof result === 'string') {
          throw createAdminError(400, result);
        }
      } else {
        throw createAdminError(400, 'Restore is not supported for this audit entry type.');
      }

      await markAuditEventRestored(auditId, actorUserId, result.restored || null);
      await logAuditEvent({
        actorUserId,
        action: 'record.restore',
        targetType: entry.targetType,
        targetId: entry.targetId,
        targetLabel: entry.targetLabel || entry.targetId,
        metadata: {
          sourceAuditId: auditId,
          restored: result.restored || null
        }
      });

      res.json(result);
    } catch (err) {
      sendJsonError(res, err, 'Unable to restore the deleted record.');
    }
  });

  app.patch('/api/admin/users/:userId', validateAuth, requireAdmin, async (req, res) => {
    try {
      const actorUserId = req.userContext.userId;
      const { userId } = req.params;
      const result = await updateUserRecordForAdmin(userId, req.body || {});
      if (typeof result === 'string') {
        throw createAdminError(400, result);
      }

      await logAuditEvent({
        actorUserId,
        action: 'record.update',
        targetType: 'user',
        targetId: userId,
        targetLabel: userId,
        changes: result.updates
      });

      res.json(result);
    } catch (err) {
      sendJsonError(res, err, 'Unable to update the user record.');
    }
  });

  app.delete('/api/admin/users/:userId', validateAuth, requireAdmin, async (req, res) => {
    try {
      const actorUserId = req.userContext.userId;
      const { userId } = req.params;
      if (userId === actorUserId) {
        throw createAdminError(400, 'You cannot delete your own user record from the admin dashboard.');
      }

      const result = await deleteUserRecordForAdmin(userId);
      if (typeof result === 'string') {
        throw createAdminError(400, result);
      }

      await logAuditEvent({
        actorUserId,
        action: 'record.delete',
        targetType: 'user',
        targetId: userId,
        targetLabel: result.deleted.email || result.deleted.username || userId,
        metadata: result.deleted
      });

      res.json(result);
    } catch (err) {
      sendJsonError(res, err, 'Unable to delete the user record.');
    }
  });

  app.get('/api/admin/vehicles', validateAuth, requireAdmin, async (req, res) => {
    try {
      const pagination = parsePagination(req.query, { pageSize: 12 });
      const result = await listVehiclesForAdmin({
        search: req.query.search || '',
        page: pagination.page,
        pageSize: pagination.pageSize
      });
      res.json({ success: true, ...result });
    } catch (err) {
      sendJsonError(res, err, 'Unable to load vehicles.');
    }
  });

  app.patch('/api/admin/vehicles/:carId', validateAuth, requireAdmin, async (req, res) => {
    try {
      const actorUserId = req.userContext.userId;
      const { carId } = req.params;
      const result = await updateVehicleRecordForAdmin(carId, req.body || {});
      if (typeof result === 'string') {
        throw createAdminError(400, result);
      }

      await logAuditEvent({
        actorUserId,
        action: 'record.update',
        targetType: 'vehicle',
        targetId: carId,
        targetLabel: carId,
        changes: result.updates
      });

      res.json(result);
    } catch (err) {
      sendJsonError(res, err, 'Unable to update the vehicle record.');
    }
  });

  app.delete('/api/admin/vehicles/:carId', validateAuth, requireAdmin, async (req, res) => {
    try {
      const actorUserId = req.userContext.userId;
      const { carId } = req.params;
      const result = await deleteVehicleRecordForAdmin(carId);
      if (typeof result === 'string') {
        throw createAdminError(400, result);
      }

      await logAuditEvent({
        actorUserId,
        action: 'record.delete',
        targetType: 'vehicle',
        targetId: carId,
        targetLabel: `${result.deleted.year} ${result.deleted.make} ${result.deleted.model}`,
        metadata: result.deleted
      });

      res.json(result);
    } catch (err) {
      sendJsonError(res, err, 'Unable to delete the vehicle record.');
    }
  });

  app.get('/api/admin/flowcharts', validateAuth, requireAdmin, async (req, res) => {
    try {
      const pagination = parsePagination(req.query, { pageSize: 12 });
      const result = await listFlowchartsForAdmin({
        search: req.query.search || '',
        page: pagination.page,
        pageSize: pagination.pageSize
      });
      res.json({ success: true, ...result });
    } catch (err) {
      sendJsonError(res, err, 'Unable to load flowcharts.');
    }
  });

  app.delete('/api/admin/flowcharts/:ownerUserId/:flowchartId', validateAuth, requireAdmin, async (req, res) => {
    try {
      const actorUserId = req.userContext.userId;
      const { ownerUserId, flowchartId } = req.params;
      const result = await deleteFlowchartForAdmin(ownerUserId, flowchartId);
      if (typeof result === 'string') {
        throw createAdminError(400, result);
      }

      await logAuditEvent({
        actorUserId,
        action: 'record.delete',
        targetType: 'flowchart',
        targetId: flowchartId,
        targetLabel: `${ownerUserId}:${flowchartId}`,
        metadata: result.deleted
      });

      res.json(result);
    } catch (err) {
      sendJsonError(res, err, 'Unable to delete the flowchart record.');
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
