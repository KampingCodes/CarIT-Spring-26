const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Expert'];
const ACCESS_LEVELS = ['admin', 'superadmin'];

export function getFields(obj = {}, fields = []) {
  const result = {};
  for (const field of fields) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, field)) {
      result[field] = obj[field];
    }
  }
  return result;
}

export function normalizeText(value, maxLength = 250) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function normalizeOptionalText(value, maxLength = 250) {
  const normalized = normalizeText(value, maxLength);
  return normalized || null;
}

export function normalizeExperienceLevel(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalized = normalizeText(value, 32);
  return EXPERIENCE_LEVELS.includes(normalized) ? normalized : null;
}

export function normalizeAccessLevel(value) {
  const normalized = normalizeText(value, 32).toLowerCase();
  return ACCESS_LEVELS.includes(normalized) ? normalized : 'admin';
}

export function parsePagination(query = {}, defaults = {}) {
  const defaultPage = Number(defaults.page) || 1;
  const defaultPageSize = Number(defaults.pageSize) || 25;
  const page = Math.max(Number.parseInt(query.page, 10) || defaultPage, 1);
  const pageSize = Math.min(Math.max(Number.parseInt(query.pageSize, 10) || defaultPageSize, 1), 100);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize
  };
}

export function buildSearchRegex(search) {
  const normalized = normalizeText(search, 120);
  if (!normalized) {
    return null;
  }

  return new RegExp(escapeRegExp(normalized), 'i');
}

export function isValidObjectIdString(value) {
  return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
