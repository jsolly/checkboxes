import { SchemaType } from "@google/generative-ai";
import { FRAMEWORKS, type FrameworkId } from "../config/frameworks";
import { getModelResponse } from "./googleAI";

interface ComplexityResults {
	scores: Record<string, number>;
}

// Generate properties dynamically from FRAMEWORKS
const scoreProperties = Object.fromEntries(
	Object.keys(FRAMEWORKS).map((framework) => [
		framework,
		{
			type: SchemaType.NUMBER,
			minimum: 0,
			maximum: 100,
		},
	]),
) as Record<
	FrameworkId,
	{
		type: SchemaType.NUMBER;
		minimum: number;
		maximum: number;
	}
>;

export const complexitySchema = {
	type: SchemaType.OBJECT,
	properties: {
		scores: {
			type: SchemaType.OBJECT,
			description: "Framework complexity scores (0-100)",
			properties: scoreProperties,
			required: Object.keys(FRAMEWORKS) as FrameworkId[],
		},
	},
	required: ["scores"],
};

function formatImplementation([framework, code]: [string, string]): string {
	return `### ${framework}
\`\`\`${framework === "cssOnly" ? "css" : "typescript"}
${code}
\`\`\``;
}

const prompt = (
	implementations: Record<FrameworkId, string>,
) => `You are tasked with evaluating implementations of a checkbox tree component written in different frameworks based on their complexity.

The component requirements:
1. A parent checkbox that toggles all child checkboxes.
2. Three child checkboxes that can be toggled independently.
3. Parent checkbox becomes:
   - Checked when all children are checked.
   - Unchecked when all children are unchecked.
   - Indeterminate when some children are checked.

Evaluate each implementation based on its **complexity index** (0-100), with the following weighted criteria:

1. **State Management Complexity** (40% of score):
   - How is checkbox state stored and updated?
   - Is state management centralized or distributed?
   - How many state variables are needed?

2. **Event Handling Complexity** (35% of score):
   - How are parent-child checkbox interactions managed?
   - How many event listeners are needed?
   - How complex is the event propagation logic?

3. **Code Overhead** (25% of score):
   - Amount of boilerplate code required
   - Number of helper functions needed
   - Framework-specific abstractions used

Lower scores indicate simpler implementations. Respond with a JSON object containing only scores as whole numbers between 0 and 100:
{
  "scores": {
    "framework1": 78,
    "framework2": 64
  }
}

Here are the implementations:

${Object.entries(implementations).map(formatImplementation).join("\n\n")}`;

export async function evaluateFrameworkComplexity(
	implementations: Record<FrameworkId, string>,
): Promise<ComplexityResults> {
	const response = await getModelResponse(
		prompt(implementations),
		complexitySchema,
	);
	return JSON.parse(response) as ComplexityResults;
}
