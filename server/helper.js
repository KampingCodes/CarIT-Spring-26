
export function getFields(obj, feilds) {
  let fields = {};
  for (const field of feilds) {
    if (field in obj) fields[field] = obj[field];
  }
  return fields;
}
