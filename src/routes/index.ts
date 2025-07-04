import { Router } from "express";
import MiscController from "../controllers/misc";
import routeConf from "../configs/routes";

const testRouter = Router();
const invalidRoutes = Router();

testRouter.all(routeConf.home, MiscController.home);

const v1Router = Router();

v1Router.use(testRouter);

// Catch-all route for invalid endpoints - must be last
//v1Router.all("*", MiscController.invalidRoute);

export default v1Router;
