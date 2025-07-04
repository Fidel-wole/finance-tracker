import dispatcher from "./utils/dispatcher";
import appConfig from "./configs/app";
import v1Router from "./routes";
import express from "express";
import helmet from "helmet";
import { PORT } from "./configs/env";
import logger from "./utils/logger";
//import { corsConfig } from "./configs/cors";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(express.json());

//app.use(corsConfig);

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
