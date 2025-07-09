import { Request, Response } from "express";
import UserAnalyticsService from "../services/user-analytics";
import dispatcher from "../utils/dispatcher";
import logger from "../utils/logger";

export default class UserAnalyticsController {
  private userAnalyticsService: UserAnalyticsService;

  constructor() {
    this.userAnalyticsService = new UserAnalyticsService();
  }

  async getUserTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { id: userId } = req.params;
      const { type, limit } = req.query;

      const options: { type?: string; limit?: number } = {};
      
      if (type && typeof type === "string") {
        options.type = type;
      }
      
      if (limit && typeof limit === "string") {
        const limitNum = parseInt(limit, 10);
        if (!isNaN(limitNum) && limitNum > 0) {
          options.limit = limitNum;
        }
      }

      const result = await this.userAnalyticsService.getUserTransactions(userId, options);
      
      dispatcher.DispatchSuccessMessage(res, "User transactions retrieved successfully", result);
    } catch (error) {
      logger.error("Error getting user transactions:", error);
      
      if (error instanceof Error && error.message === "User not found") {
        dispatcher.DispatchCustomMessage(res, "User not found", 404, "error");
        return;
      }
      
      dispatcher.DispatchErrorMessage(res, "Failed to retrieve user transactions");
    }
  }

  async getUserSummary(req: Request, res: Response): Promise<void> {
    try {
      const { id: userId } = req.params;

      const summary = await this.userAnalyticsService.getUserMonthlySummary(userId);
      
      dispatcher.DispatchSuccessMessage(res, "User monthly summary retrieved successfully", summary);
    } catch (error) {
      logger.error("Error getting user summary:", error);
      
      if (error instanceof Error && error.message === "User not found") {
        dispatcher.DispatchCustomMessage(res, "User not found", 404, "error");
        return;
      }
      
      dispatcher.DispatchErrorMessage(res, "Failed to retrieve user summary");
    }
  }

  async getUserTopRecipients(req: Request, res: Response): Promise<void> {
    try {
      const { id: userId } = req.params;

      const recipients = await this.userAnalyticsService.getTopRecipients(userId);
      
      dispatcher.DispatchSuccessMessage(res, "Top recipients retrieved successfully", { recipients });
    } catch (error) {
      logger.error("Error getting top recipients:", error);
      
      if (error instanceof Error && error.message === "User not found") {
        dispatcher.DispatchCustomMessage(res, "User not found", 404, "error");
        return;
      }
      
      dispatcher.DispatchErrorMessage(res, "Failed to retrieve top recipients");
    }
  }
}
