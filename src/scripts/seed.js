import { z } from "zod";
import { connectDb, disconnectDb } from "../config/db.js";
import { formatIssues } from "../config/env.js";
import { MESSAGES } from "../constants/messages.js";
import { ROLES } from "../constants/roles.js";
import { User } from "../models/User.js";
import { hashPassword } from "../utils/password.js";
import { emailField, nameField, passwordField } from "../validators/fields.js";

const seedSchema = z.object({
  SEED_ADMIN_NAME: nameField,
  SEED_ADMIN_EMAIL: emailField,
  SEED_ADMIN_PASSWORD: passwordField,
});

async function seed() {
  const parsed = seedSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(`${MESSAGES.SEED.INVALID_ENV}\n${formatIssues(parsed.error)}`);
    process.exit(1);
  }
  const { SEED_ADMIN_NAME: name, SEED_ADMIN_EMAIL: email, SEED_ADMIN_PASSWORD: password } = parsed.data;

  await connectDb();
  try {
    if (await User.exists({ email })) {
      console.log(MESSAGES.SEED.EXISTS(email));
      return;
    }
    await User.create({ name, email, role: ROLES.ADMIN, passwordHash: await hashPassword(password) });
    console.log(MESSAGES.SEED.CREATED(email));
  } finally {
    await disconnectDb();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
