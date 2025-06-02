import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";

dotenv.config();

export const genAI = new GoogleGenAI({
	apiKey: process.env.GEMINI_API_KEY || "",
});

export async function getModelResponse(prompt: string, schema?: object) {
	const model = genAI.models.generateContent({
		model: "gemini-2.0-flash",
		contents: [
			{
				role: "user",
				parts: [{ text: prompt }],
			},
		],
		...(schema && {
			responseMimeType: "application/json",
			responseSchema: schema,
		}),
	});

	const result = await model;
	const response = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
	console.log("\n🔍 API Response:", response);
	return response;
}
