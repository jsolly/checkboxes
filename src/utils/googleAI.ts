import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

let genAI: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
	if (!genAI) {
		genAI = new GoogleGenAI({
			apiKey: process.env.GEMINI_API_KEY || "",
		});
	}
	return genAI;
}

export async function getModelResponse(prompt: string, schema?: object) {
	const result = await getClient().models.generateContent({
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
