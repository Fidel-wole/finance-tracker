import { Request, Response } from "express";
import AISuggestionsService from "../services/ai-suggestions";
import dispatcher from "../utils/dispatcher";
import logger from "../utils/logger";

export default class AISuggestionsController {
  private aiSuggestionsService: AISuggestionsService;

  constructor() {
    this.aiSuggestionsService = new AISuggestionsService();
  }

  async getSuggestions(req: Request, res: Response): Promise<void> {
    try {
      console.log("AI Controller: Starting getSuggestions");
      const { userId } = req.params;
      const { year, month } = req.query;

      console.log("AI Controller: userId =", userId);

      // Parse year and month if provided
      let targetYear: number | undefined;
      let targetMonth: number | undefined;

      if (year && typeof year === "string") {
        const parsedYear = parseInt(year, 10);
        if (!isNaN(parsedYear) && parsedYear >= 2000 && parsedYear <= 3000) {
          targetYear = parsedYear;
        }
      }

      if (month && typeof month === "string") {
        const parsedMonth = parseInt(month, 10);
        if (!isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12) {
          targetMonth = parsedMonth;
        }
      }

      console.log("AI Controller: About to call generateSuggestions");
      const result = await this.aiSuggestionsService.generateSuggestions({
        userId,
        year: targetYear,
        month: targetMonth
      });

      console.log("AI Controller: Successfully generated suggestions");
      dispatcher.DispatchSuccessMessage(
        res,
        "AI suggestions generated successfully",
        result
      );
    } catch (error) {
      console.log("AI Controller: Error occurred:", error);
      logger.error("Error generating AI suggestions:", error);

      if (error instanceof Error) {
        if (error.message === "User not found") {
          dispatcher.DispatchCustomMessage(res, "User not found", 404, "error");
          return;
        }
        
        if (error.message === "OpenAI API key not configured") {
          dispatcher.DispatchCustomMessage(res, "AI service not available", 503, "error");
          return;
        }
      }

      dispatcher.DispatchErrorMessage(res, "Failed to generate AI suggestions");
    }
  }
}
