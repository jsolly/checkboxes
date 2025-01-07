import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Google AI client
export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Helper function to get model response as text
export async function getModelResponse(prompt: string) {
	const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
	const result = await model.generateContent(prompt);
	return result.response.text();
}
