// Marks rows created by `npm run seed:demo` so re-running the seed only replaces demo data.
export const demoFlag = { isDemo: { type: Boolean, default: false } };
