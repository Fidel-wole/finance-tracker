import { Router } from "express";
import express from "express";
import MiscController from "../controllers/misc";
import routeConf from "../configs/routes";
import webhookRoutes from "./webhook";

const testRouter = Router();

testRouter.all(routeConf.home, MiscController.home);

const v1Router = Router();

v1Router.use('/webhook', webhookRoutes);

v1Router.use(express.json());

v1Router.use(testRouter);



export default v1Router;
