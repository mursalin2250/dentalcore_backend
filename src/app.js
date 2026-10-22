import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { API_PREFIX, REQUEST_BODY_LIMIT } from "./constants/api.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { mongoSanitize } from "./middleware/mongoSanitize.js";
import { notFound } from "./middleware/notFound.js";
import apiRoutes from "./routes/index.js";
import { resolveCorsOrigin } from "./utils/corsOrigin.js";

const app = express();

if (env.TRUST_PROXY) app.set("trust proxy", env.TRUST_PROXY);

app.use(helmet());
app.use(
  cors({
    origin: resolveCorsOrigin,
    credentials: true,
  }),
);
app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
app.use(cookieParser());
app.use(mongoSanitize);

app.use(API_PREFIX, apiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
