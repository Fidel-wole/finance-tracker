import { Router } from "express";
import MiscController from "../controllers/misc";
import routeConf from "../configs/routes";
import webhookRoutes from "./webhook";

const testRouter = Router();
const invalidRoutes = Router();

testRouter.all(routeConf.home, MiscController.home);

const v1Router = Router();

// Webhook routes (important: these should come before JSON body parser)
v1Router.use('/webhook', webhookRoutes);

v1Router.use(testRouter);

// Catch-all route for invalid endpoints - must be last
//v1Router.all("*", MiscController.invalidRoute);

export default v1Router;
