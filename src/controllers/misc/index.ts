import { Request, Response, NextFunction } from "express";
import logger from "../../utils/logger";
import routeConf from "../../configs/routes";
import dispatcher from "../../utils/dispatcher";

export default class MiscController {
  static home(req: Request, res: Response, next: NextFunction): void {
    try {
      const message = "Welcome to Transzt Backend Service";
      logger.info(routeConf.home, message);
      dispatcher.DispatchSuccessMessage(res, message);
    } catch (error) {
      next(error);
    }
  }

  static async invalidRoute(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      logger.error(req.url, null);
      dispatcher.SendNotImplementedError(res);
    } catch (error) {
      next(error);
    }
  }
}
