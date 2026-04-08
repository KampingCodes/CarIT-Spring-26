import { ADMIN_ALLOWLIST_COLLECTION, AUDIT_LOG_COLLECTION, DATABASE, USER_COLLECTION } from './config.js';
import { client } from './mongo.js';
import { ObjectId } from 'mongodb';
import { normalizeAccessLevel, normalizeText, parsePagination } from './helper.js';
import { getUserDB, updateUserDB } from './user.js';

const ADMIN_ACCESS_NONE = Object.freeze({
  isAdmin: false,
  accessLevel: 'user',
  source: 'none',
  grantedAt: null,
  grantedBy: null,
  updatedAt: null
});

export function getAuthenticatedUserId(req) {
  return req?.auth?.payload?.sub || null;
}

export function getBootstrapAdminSubjects() {
  const raw = process.env.ADMIN_ALLOWLIST_SUBJECTS || '';
  return [...new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  )];
}

export async function resolveAdminStatus(subject) {
  if (!subject) {
    return { ...ADMIN_ACCESS_NONE };
  }

  if (getBootstrapAdminSubjects().includes(subject)) {
    return {
      isAdmin: true,
      accessLevel: 'superadmin',
      source: 'bootstrap',
      grantedAt: null,
      grantedBy: 'system',
      updatedAt: new Date().toISOString()
    };
  }

  const entry = await getAllowlistCollection().findOne({ _id: subject, isActive: true });
  if (!entry) {
    return { ...ADMIN_ACCESS_NONE };
  }

  return {
    isAdmin: true,
    accessLevel: normalizeAccessLevel(entry.accessLevel),
    source: 'allowlist',
    grantedAt: entry.grantedAt || null,
    grantedBy: entry.grantedBy || null,
    updatedAt: entry.updatedAt || entry.grantedAt || null
  };
}

export async function syncUserAdminMirror(subject) {
  if (!subject) {
    return { ...ADMIN_ACCESS_NONE };
  }

  const user = await getUserDB(subject);
  const status = await resolveAdminStatus(subject);
  if (!user) {
    return status;
  }

  const adminAccess = {
    isAdmin: status.isAdmin,
    accessLevel: status.accessLevel,
    source: status.source,
    grantedAt: status.grantedAt,
    grantedBy: status.grantedBy,
    updatedAt: new Date().toISOString()
  };

  await updateUserDB(subject, { adminAccess });
  return status;
}

export async function requireAdmin(req, res, next) {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const adminStatus = await resolveAdminStatus(userId);
    await syncUserAdminMirror(userId);

    if (!adminStatus.isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    req.userContext = {
      userId,
      adminStatus
    };

    return next();
  } catch (err) {
    console.error('Error checking admin access:', err);
    return res.status(500).json({ success: false, message: 'Unable to verify admin access.' });
  }
}

export function isSuperAdminStatus(adminStatus) {
  return adminStatus?.isAdmin === true && adminStatus?.accessLevel === 'superadmin';
}

export async function requireSuperAdmin(req, res, next) {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const adminStatus = await resolveAdminStatus(userId);
    await syncUserAdminMirror(userId);

    if (!adminStatus.isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    if (!isSuperAdminStatus(adminStatus)) {
      return res.status(403).json({ success: false, message: 'Superadmin access required.' });
    }

    req.userContext = {
      userId,
      adminStatus
    };

    return next();
  } catch (err) {
    console.error('Error checking superadmin access:', err);
    return res.status(500).json({ success: false, message: 'Unable to verify superadmin access.' });
  }
}

export async function grantAdminAccess(targetUserId, actorUserId, accessLevel = 'admin') {
  const normalizedTarget = normalizeText(targetUserId, 200);
  if (!normalizedTarget) {
    throw createAdminError(400, 'A target user is required.');
  }

  if (getBootstrapAdminSubjects().includes(normalizedTarget)) {
    return resolveAdminStatus(normalizedTarget);
  }

  const now = new Date().toISOString();
  const existing = await getAllowlistCollection().findOne({ _id: normalizedTarget });

  await getAllowlistCollection().updateOne(
    { _id: normalizedTarget },
    {
      $set: {
        isActive: true,
        accessLevel: normalizeAccessLevel(accessLevel),
        grantedBy: actorUserId,
        grantedAt: existing?.grantedAt || now,
        updatedAt: now,
        revokedAt: null,
        revokedBy: null
      }
    },
    { upsert: true }
  );

  await syncUserAdminMirror(normalizedTarget);
  return resolveAdminStatus(normalizedTarget);
}

export async function revokeAdminAccess(targetUserId, actorUserId) {
  const normalizedTarget = normalizeText(targetUserId, 200);
  if (!normalizedTarget) {
    throw createAdminError(400, 'A target user is required.');
  }

  if (normalizedTarget === actorUserId) {
    throw createAdminError(400, 'You cannot revoke your own admin access.');
  }

  if (getBootstrapAdminSubjects().includes(normalizedTarget)) {
    throw createAdminError(400, 'Bootstrap admins must be removed from the backend allowlist configuration.');
  }

  const currentStatus = await resolveAdminStatus(normalizedTarget);
  if (!currentStatus.isAdmin) {
    throw createAdminError(404, 'The selected user is not an active admin.');
  }

  const effectiveAdmins = await getEffectiveAdminSubjects();
  if (effectiveAdmins.length <= 1) {
    throw createAdminError(400, 'At least one admin must remain active.');
  }

  if (currentStatus.accessLevel === 'superadmin') {
    const effectiveSuperAdmins = await getEffectiveSuperAdminSubjects();
    if (effectiveSuperAdmins.length <= 1) {
      throw createAdminError(400, 'At least one superadmin must remain active.');
    }
  }

  const now = new Date().toISOString();
  await getAllowlistCollection().updateOne(
    { _id: normalizedTarget, isActive: true },
    {
      $set: {
        isActive: false,
        updatedAt: now,
        revokedAt: now,
        revokedBy: actorUserId
      }
    }
  );

  await syncUserAdminMirror(normalizedTarget);
  return { success: true };
}

export async function listAdminAccounts(query = {}) {
  const { page, pageSize, skip } = parsePagination(query, { pageSize: 12 });
  const search = normalizeText(query.search, 120).toLowerCase();
  const bootstrapSubjects = getBootstrapAdminSubjects();
  const dbAdmins = await getAllowlistCollection().find({ isActive: true }).toArray();
  const subjectSet = new Set([
    ...bootstrapSubjects,
    ...dbAdmins.map((entry) => entry._id)
  ]);
  const subjects = [...subjectSet];

  const userDocs = subjects.length > 0
    ? await client.db(DATABASE).collection(USER_COLLECTION).find(
      { _id: { $in: subjects } },
      { projection: { name: 1, email: 1, adminAccess: 1 } }
    ).toArray()
    : [];
  const userMap = new Map(userDocs.map((user) => [user._id, user]));
  const allowlistMap = new Map(dbAdmins.map((entry) => [entry._id, entry]));

  const items = subjects
    .map((subject) => {
      const user = userMap.get(subject);
      const allowlistEntry = allowlistMap.get(subject);
      const isBootstrap = bootstrapSubjects.includes(subject);

      return {
        userId: subject,
        username: user?.name || 'Pending profile setup',
        email: user?.email || allowlistEntry?.email || '',
        accessLevel: isBootstrap ? 'superadmin' : normalizeAccessLevel(allowlistEntry?.accessLevel),
        source: isBootstrap ? 'bootstrap' : 'allowlist',
        grantedAt: allowlistEntry?.grantedAt || null,
        grantedBy: allowlistEntry?.grantedBy || null,
        isBootstrap
      };
    })
    .filter((entry) => {
      if (!search) {
        return true;
      }

      return [
        entry.userId,
        entry.username,
        entry.email,
        entry.accessLevel,
        entry.source
      ].some((value) => String(value || '').toLowerCase().includes(search));
    })
    .sort((left, right) => left.username.localeCompare(right.username));

  return {
    items: items.slice(skip, skip + pageSize),
    total: items.length,
    page,
    pageSize
  };
}

export async function logAuditEvent({
  actorUserId,
  action,
  targetType,
  targetId,
  targetLabel = '',
  changes = null,
  metadata = null
}) {
  await getAuditCollection().insertOne({
    actorUserId,
    action,
    targetType,
    targetId,
    targetLabel,
    changes,
    metadata,
    createdAt: new Date().toISOString()
  });
}

export async function listAuditEvents(query = {}, options = {}) {
  const { includeSensitive = false } = options;
  const normalizedSearch = normalizeAuditSearchValue(query.search);
  const { page, pageSize, skip } = parsePagination(query, { pageSize: 10 });
  const baseFilters = [];

  if (!includeSensitive) {
    baseFilters.push({ action: { $not: /^admin\./ } });
  }

  const baseFilter = baseFilters.length === 0 ? {} : baseFilters.length === 1 ? baseFilters[0] : { $and: baseFilters };

  if (!normalizedSearch) {
    const [items, total] = await Promise.all([
      getAuditCollection()
        .find(baseFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .toArray(),
      getAuditCollection().countDocuments(baseFilter)
    ]);

    return {
      items,
      total,
      page,
      pageSize
    };
  }

  const matchedItems = sortAuditEntriesByRelevance(
    await getAuditCollection().find(baseFilter).sort({ createdAt: -1 }).toArray(),
    normalizedSearch
  );

  return {
    items: matchedItems.slice(skip, skip + pageSize),
    total: matchedItems.length,
    page,
    pageSize
  };
}

export async function getAuditEventById(auditId) {
  if (!ObjectId.isValid(auditId)) {
    return null;
  }

  return getAuditCollection().findOne({ _id: new ObjectId(auditId) });
}

export async function markAuditEventRestored(auditId, actorUserId, restoredMetadata = null) {
  if (!ObjectId.isValid(auditId)) {
    throw createAdminError(400, 'A valid audit entry id is required.');
  }

  await getAuditCollection().updateOne(
    { _id: new ObjectId(auditId) },
    {
      $set: {
        restoredAt: new Date().toISOString(),
        restoredBy: actorUserId,
        restoreMetadata: restoredMetadata || null
      }
    }
  );
}

export function createAdminError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function getEffectiveAdminSubjects() {
  const bootstrap = getBootstrapAdminSubjects();
  const dbAdmins = await getAllowlistCollection().find({ isActive: true }, { projection: { _id: 1 } }).toArray();
  return [...new Set([...bootstrap, ...dbAdmins.map((entry) => entry._id)])];
}

async function getEffectiveSuperAdminSubjects() {
  const bootstrap = getBootstrapAdminSubjects();
  const dbSuperAdmins = await getAllowlistCollection().find(
    { isActive: true, accessLevel: 'superadmin' },
    { projection: { _id: 1 } }
  ).toArray();
  return [...new Set([...bootstrap, ...dbSuperAdmins.map((entry) => entry._id)])];
}

function createSearchRegex(value, maxLength = 120) {
  const normalized = normalizeText(value, maxLength);
  if (!normalized) {
    return null;
  }

  return new RegExp(normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

function normalizeAuditSearchValue(value = '') {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function getAuditSearchFields(entry = {}) {
  return [
    entry.actorUserId,
    entry.action,
    entry.targetType,
    entry.targetId,
    entry.targetLabel,
    entry.restoredBy
  ]
    .filter(Boolean)
    .map((value) => normalizeAuditSearchValue(value));
}

function getAuditEntrySearchScore(entry, search) {
  const normalizedSearch = normalizeAuditSearchValue(search);
  if (!normalizedSearch) {
    return 0;
  }

  const tokens = normalizedSearch.split(' ').filter(Boolean);
  const fields = getAuditSearchFields(entry);
  let score = 0;

  for (const token of tokens) {
    let matched = false;

    for (const field of fields) {
      if (field === token) {
        score += 120;
        matched = true;
        break;
      }

      if (field.startsWith(token)) {
        score += 80;
        matched = true;
        break;
      }

      if (field.includes(token)) {
        score += 45;
        matched = true;
        break;
      }
    }

    if (!matched) {
      return -1;
    }
  }

  for (const field of fields) {
    if (field === normalizedSearch) {
      score += 300;
    } else if (field.startsWith(normalizedSearch)) {
      score += 180;
    } else if (field.includes(normalizedSearch)) {
      score += 90;
    }
  }

  return score;
}

export function sortAuditEntriesByRelevance(entries = [], search = '') {
  const normalizedSearch = normalizeAuditSearchValue(search);
  if (!normalizedSearch) {
    return [...entries].sort((left, right) => Date.parse(right?.createdAt || 0) - Date.parse(left?.createdAt || 0));
  }

  return entries
    .map((entry) => ({
      entry,
      score: getAuditEntrySearchScore(entry, normalizedSearch)
    }))
    .filter(({ score }) => score >= 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return Date.parse(right.entry?.createdAt || 0) - Date.parse(left.entry?.createdAt || 0);
    })
    .map(({ entry }) => entry);
}

function getAllowlistCollection() {
  return client.db(DATABASE).collection(ADMIN_ALLOWLIST_COLLECTION);
}

function getAuditCollection() {
  return client.db(DATABASE).collection(AUDIT_LOG_COLLECTION);
}