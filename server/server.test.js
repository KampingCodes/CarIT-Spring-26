import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_RATE_LIMITS,
  AI_RATE_LIMIT_WINDOW_MS,
  createAiRateLimit,
  createOptionalValidateAuth,
  getRetryAfterSeconds
} from './aiMiddleware.js';
import { getBootstrapAdminSubjects, sortAuditEntriesByRelevance } from './admin.js';
import { normalizeAccessLevel, normalizeExperienceLevel, parsePagination } from './helper.js';
import { normalizeVehicleRecord } from './vehicleUtils.js';

function createReq({
  path = '/api/gen-flowchart',
  authorization,
  userid,
  ip = '127.0.0.1',
  userAgent = 'test-agent'
} = {}) {
  return {
    path,
    ip,
    headers: {
      ...(authorization ? { authorization } : {}),
      ...(userid ? { userid } : {})
    },
    get(headerName) {
      if (headerName.toLowerCase() === 'user-agent') {
        return userAgent;
      }

      return undefined;
    }
  };
}

function createRes() {
  return {
    headers: {},
    statusCode: 200,
    jsonBody: null,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.jsonBody = payload;
      return this;
    }
  };
}

test('createAiRateLimit allows guest requests under the limit and blocks over the limit', () => {
  const store = new Map();
  const middleware = createAiRateLimit({
    store,
    now: () => 1000
  });

  for (let index = 0; index < AI_RATE_LIMITS['/api/gen-flowchart'].guest; index += 1) {
    let nextCalled = false;
    middleware(createReq(), createRes(), () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  }

  const blockedRes = createRes();
  let blockedNextCalled = false;
  middleware(createReq(), blockedRes, () => {
    blockedNextCalled = true;
  });

  assert.equal(blockedNextCalled, false);
  assert.equal(blockedRes.statusCode, 429);
  assert.equal(blockedRes.jsonBody.retryAfterSeconds, 60);
  assert.match(blockedRes.jsonBody.message, /Too many guest AI requests/);
});

test('createAiRateLimit uses authenticated limits when auth headers exist', () => {
  const store = new Map();
  const middleware = createAiRateLimit({
    store,
    now: () => 5000
  });
  const req = createReq({
    authorization: 'Bearer token',
    userid: 'auth0|123'
  });

  for (let index = 0; index < AI_RATE_LIMITS['/api/gen-flowchart'].authenticated; index += 1) {
    let nextCalled = false;
    middleware(req, createRes(), () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  }

  const blockedRes = createRes();
  middleware(req, blockedRes, () => {});

  assert.equal(blockedRes.statusCode, 429);
  assert.match(blockedRes.jsonBody.message, /Too many authenticated AI requests/);
});

test('createAiRateLimit resets after the time window', () => {
  let currentTime = 10000;
  const middleware = createAiRateLimit({
    store: new Map(),
    windowMs: AI_RATE_LIMIT_WINDOW_MS,
    now: () => currentTime
  });
  const req = createReq();

  for (let index = 0; index < AI_RATE_LIMITS['/api/gen-flowchart'].guest; index += 1) {
    middleware(req, createRes(), () => {});
  }

  currentTime += AI_RATE_LIMIT_WINDOW_MS + 1;

  let nextCalled = false;
  middleware(req, createRes(), () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});

test('createOptionalValidateAuth bypasses validation when no auth header exists', () => {
  let validatorCalled = false;
  const middleware = createOptionalValidateAuth(() => {
    validatorCalled = true;
  });

  let nextCalled = false;
  middleware(createReq(), createRes(), () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(validatorCalled, false);
});

test('createOptionalValidateAuth returns 401 json when validator errors', () => {
  const middleware = createOptionalValidateAuth((_req, _res, next) => {
    next({ status: 401, message: 'Bad token' });
  });

  const res = createRes();
  let nextCalled = false;
  middleware(createReq({ authorization: 'Bearer token', userid: 'auth0|123' }), res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonBody, {
    success: false,
    message: 'Bad token'
  });
});

test('getRetryAfterSeconds parses valid retry info', () => {
  const err = {
    errorDetails: [
      {
        '@type': 'type.googleapis.com/google.rpc.RetryInfo',
        retryDelay: '2.2s'
      }
    ]
  };

  assert.equal(getRetryAfterSeconds(err), 3);
});

test('getRetryAfterSeconds returns null for invalid input', () => {
  assert.equal(getRetryAfterSeconds(null), null);
  assert.equal(getRetryAfterSeconds({ errorDetails: [] }), null);
  assert.equal(getRetryAfterSeconds({
    errorDetails: [
      {
        '@type': 'type.googleapis.com/google.rpc.RetryInfo',
        retryDelay: 'later'
      }
    ]
  }), null);
});

test('normalizeVehicleRecord normalizes valid input', () => {
  assert.deepEqual(normalizeVehicleRecord({
    year: '2016',
    make: '  Honda ',
    model: ' Civic ',
    trim: '  EX  '
  }), {
    year: 2016,
    make: 'Honda',
    model: 'Civic',
    trim: 'EX'
  });
});

test('normalizeVehicleRecord rejects invalid input', () => {
  assert.equal(normalizeVehicleRecord({ year: '1700', make: 'Honda', model: 'Civic' }), null);
  assert.equal(normalizeVehicleRecord({ year: '2016', make: '', model: 'Civic' }), null);
  assert.equal(normalizeVehicleRecord({ year: '2016', make: 'Honda', model: '' }), null);
});

test('getBootstrapAdminSubjects trims and de-duplicates configured subjects', () => {
  const previous = process.env.ADMIN_ALLOWLIST_SUBJECTS;
  process.env.ADMIN_ALLOWLIST_SUBJECTS = ' auth0|a , auth0|b,auth0|a ,, ';

  assert.deepEqual(getBootstrapAdminSubjects(), ['auth0|a', 'auth0|b']);

  process.env.ADMIN_ALLOWLIST_SUBJECTS = previous;
});

test('normalizeAccessLevel defaults unknown values to admin', () => {
  assert.equal(normalizeAccessLevel('superadmin'), 'superadmin');
  assert.equal(normalizeAccessLevel('ADMIN'), 'admin');
  assert.equal(normalizeAccessLevel('owner'), 'admin');
});

test('normalizeExperienceLevel accepts known profile levels only', () => {
  assert.equal(normalizeExperienceLevel('Beginner'), 'Beginner');
  assert.equal(normalizeExperienceLevel(' Advanced '), null);
  assert.equal(normalizeExperienceLevel(null), null);
});

test('parsePagination clamps invalid query values', () => {
  assert.deepEqual(parsePagination({ page: '-2', pageSize: '999' }, { pageSize: 12 }), {
    page: 1,
    pageSize: 100,
    skip: 0
  });
});

test('sortAuditEntriesByRelevance places exact audit matches first', () => {
  const entries = [
    {
      actorUserId: 'auth0|other-user',
      action: 'record.delete',
      targetType: 'vehicle',
      targetId: 'car-1',
      targetLabel: '2006 Eclipse',
      createdAt: '2026-04-01T12:00:00.000Z'
    },
    {
      actorUserId: 'auth0|target-user',
      action: 'record.restore',
      targetType: 'vehicle',
      targetId: 'car-2',
      targetLabel: 'Other Vehicle',
      createdAt: '2026-04-01T11:00:00.000Z'
    },
    {
      actorUserId: 'auth0|another-user',
      action: 'record.delete',
      targetType: 'flowchart',
      targetId: 'flow-1',
      targetLabel: 'target incident',
      createdAt: '2026-04-01T13:00:00.000Z'
    }
  ];

  const sorted = sortAuditEntriesByRelevance(entries, 'auth0|target-user');

  assert.equal(sorted[0].actorUserId, 'auth0|target-user');
});