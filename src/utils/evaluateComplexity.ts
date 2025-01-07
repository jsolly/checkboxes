import { GoogleGenerativeAI } from "@google/generative-ai";
import type { FrameworkId } from "../config/frameworks";
import { getModelResponse } from "./googleAI";

interface ComplexityResults {
	scores: Record<string, number>;
}

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

Lower scores indicate simpler implementations. Respond with a JSON object containing only scores:
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
	const response = await getModelResponse(prompt(implementations));
	return JSON.parse(response) as ComplexityResults;
}
