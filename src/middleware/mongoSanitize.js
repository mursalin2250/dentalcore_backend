// Removes keys like "$gt" or "a.b" that could turn input into a MongoDB operator.
// (req.query is covered by validate(): zod only accepts plain strings there.)
function strip(value) {
  if (Array.isArray(value)) return value.forEach(strip);
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (key.startsWith("$") || key.includes(".")) delete value[key];
      else strip(value[key]);
    }
  }
}

export function mongoSanitize(req, _res, next) {
  strip(req.body);
  strip(req.params);
  next();
}
