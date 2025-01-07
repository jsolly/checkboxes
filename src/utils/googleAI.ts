import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function getModelResponse(prompt: string, schema?: object) {
	const model = genAI.getGenerativeModel({
		model: "gemini-1.5-pro",
		generationConfig: schema
			? {
					responseMimeType: "application/json",
					responseSchema: schema,
				}
			: undefined,
	});

	const result = await model.generateContent(prompt);
	const response = result.response.text();
	console.log("\n🔍 API Response:", response);
	return response;
}
