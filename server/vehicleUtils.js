function normalizeText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeVehicleRecord(vehicle) {
  const year = Number(vehicle?.year);
  const make = normalizeText(vehicle?.make);
  const model = normalizeText(vehicle?.model);
  const trim = normalizeText(vehicle?.trim);

  if (!Number.isInteger(year) || year < 1886 || year > 2999 || !make || !model) {
    return null;
  }

  return {
    year,
    make,
    model,
    trim: trim || ''
  };
}