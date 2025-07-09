export interface RecipientAnalysis {
  name: string;
  totalAmount: number;
  transactionCount: number;
  classification: "restaurant" | "organization" | "individual";
}

export interface AISuggestionRequest {
  userId: string;
  year?: number;
  month?: number;
}

export interface AISuggestionResponse {
  suggestions: string[];
  totalAnalyzed: number;
  monthYear: string;
}
