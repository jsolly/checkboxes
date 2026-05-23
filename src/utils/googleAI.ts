import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

export const genAI = new GoogleGenAI({
	apiKey: process.env.GEMINI_API_KEY || "",
});

export async function getModelResponse(prompt: string, schema?: object) {
	const result = await genAI.models.generateContent({
		model: "gemini-3.5-flash",
		contents: prompt,
		config: schema
			? {
					responseMimeType: "application/json",
					responseSchema: schema,
				}
			: undefined,
	});

	const response = result.text || "";
	console.log("\n🔍 API Response:", response);
	return response;
}
