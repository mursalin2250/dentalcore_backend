import mongoose from "mongoose";
import { env } from "./env.js";
import { MESSAGES } from "../constants/messages.js";

export async function connectDb() {
  await mongoose.connect(env.MONGO_URI);
  console.log(MESSAGES.SERVER.DB_CONNECTED);
}

export function disconnectDb() {
  return mongoose.disconnect();
}
