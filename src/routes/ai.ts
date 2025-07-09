import { Router } from "express";
import AISuggestionsController from "../controllers/ai-suggestions";

console.log("AI Routes: Loading AI routes");

const aiRouter = Router();
const aiSuggestionsController = new AISuggestionsController();

console.log("AI Routes: Controller created");

aiRouter.get(
  "/suggestions/:userId",
  aiSuggestionsController.getSuggestions.bind(aiSuggestionsController)
);

console.log("AI Routes: Route registered");

export default aiRouter;
