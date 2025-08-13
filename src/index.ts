import dispatcher from "./utils/dispatcher";
import appConfig from "./configs/app";
import v1Router from "./routes";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { PORT } from "./configs/env";
import logger from "./utils/logger";
import PartnerService from "./services/partner";

const app = express();

app.set("trust proxy", 1);

// CORS configuration for frontend
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(helmet());

PartnerService.initialize();

app.use(express.json());

app.use(appConfig.apiV1URL, v1Router);

app.get("/", (req, res) => {
  const message = "Welcome to Finance Tracker Backend Service";
  res.send(message);
  dispatcher.DispatchSuccessMessage(res, message);
});

async function startServer() {
  try {
    app.listen(PORT || process.env.PORT, () => {
      logger.info(`Server started on port ${PORT || process.env.PORT}`);
    });
  } catch (err) {
    logger.error("Error starting server", err);
  }
}
startServer();
