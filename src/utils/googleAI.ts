import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";
import { processEnv } from "./processEnv";

dotenv.config({ path: ".env.local" });
dotenv.config();

let genAI: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
	if (!genAI) {
		genAI = new GoogleGenAI({
			apiKey: processEnv("GEMINI_API_KEY") ?? "",
		});
	}
	return genAI;
}

export async function getModelResponse(prompt: string, schema?: object) {
	const result = await getClient().models.generateContent({
		model: "gemini-3.5-flash",
		contents: prompt,
		...(schema
			? {
					config: {
						responseMimeType: "application/json",
						responseSchema: schema,
					},
				}
			: {}),
	});

	const response = result.text ?? "";
	console.log("\n🔍 API Response:", response);
	return response;
}
