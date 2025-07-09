import { Router } from "express";
import UserAnalyticsController from "../controllers/user-analytics";

const userAnalyticsRouter = Router();
const userAnalyticsController = new UserAnalyticsController();

// GET /users/:id/transactions - Return recent transactions with optional filters
userAnalyticsRouter.get(
  "/:id/transactions",
  userAnalyticsController.getUserTransactions.bind(userAnalyticsController)
);

// GET /users/:id/summary - Return monthly summary
userAnalyticsRouter.get(
  "/:id/summary",
  userAnalyticsController.getUserSummary.bind(userAnalyticsController)
);

// GET /users/:id/recipients - Return top 5 recipients by amount
userAnalyticsRouter.get(
  "/:id/recipients",
  userAnalyticsController.getUserTopRecipients.bind(userAnalyticsController)
);

export default userAnalyticsRouter;
