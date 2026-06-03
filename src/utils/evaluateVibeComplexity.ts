import { FRAMEWORKS, type FrameworkId } from "../config/frameworks";
import { getModelResponse } from "./googleAI";

interface VibeComplexityResults {
	scores: Record<string, number>;
}

const scoreProperties = Object.fromEntries(
	Object.keys(FRAMEWORKS).map((framework) => [
		framework,
		{
			type: "number",
			minimum: 0,
			maximum: 100,
		},
	]),
) as Record<
	FrameworkId,
	{
		type: "number";
		minimum: number;
		maximum: number;
	}
>;

export const vibeComplexitySchema = {
	type: "object",
	properties: {
		scores: {
			type: "object",
			description: "AI-judged framework vibe complexity scores (0-100)",
			properties: scoreProperties,
			required: Object.keys(FRAMEWORKS) as FrameworkId[],
		},
	},
	required: ["scores"],
};

function formatImplementation([framework, code]: [string, string]): string {
	return `### ${framework}
\`\`\`${framework === "cssOnly" ? "html" : "typescript"}
${code}
\`\`\``;
}

const prompt = (
	implementations: Record<FrameworkId, string>,
) => `You are evaluating implementations of a nested checkbox component written in different frontend frameworks.

This is a model-judged "Vibe Complexity" score, not deterministic cyclomatic complexity.

The component requirements:
1. A parent checkbox toggles all child checkboxes.
2. Three child checkboxes can be toggled independently.
3. The parent checkbox becomes checked, unchecked, or indeterminate based on child state.

Evaluate each implementation on a 0-100 scale based on:
1. State management clarity.
2. Event handling clarity.
3. Boilerplate and framework overhead.
4. Idiomatic style and surprise factor.

Lower scores indicate implementations that feel simpler to understand and maintain.
Respond with a JSON object containing only whole-number scores between 0 and 100:
{
  "scores": {
    "framework1": 42,
    "framework2": 64
  }
}

Here are the implementations:

${Object.entries(implementations).map(formatImplementation).join("\n\n")}`;

export async function evaluateVibeComplexity(
	implementations: Record<FrameworkId, string>,
): Promise<VibeComplexityResults> {
	const response = await getModelResponse(
		prompt(implementations),
		vibeComplexitySchema,
	);
	return JSON.parse(response) as VibeComplexityResults;
}
