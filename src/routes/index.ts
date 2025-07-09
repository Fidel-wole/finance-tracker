import { Router } from "express";
import express from "express";
import MiscController from "../controllers/misc";
import routeConf from "../configs/routes";
import webhookRoutes from "./webhook";
import userAnalyticsRoutes from "./users";
import aiRoutes from "./ai";

const testRouter = Router();

testRouter.all(routeConf.home, MiscController.home);

const v1Router = Router();

v1Router.use('/webhook', webhookRoutes);

v1Router.use(express.json());

v1Router.use('/users', userAnalyticsRoutes);
v1Router.use('/ai', aiRoutes);

v1Router.use(testRouter);

export default v1Router;
