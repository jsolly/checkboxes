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

Evaluate each implementation based on its **complexity index**, considering the following criteria:
1. **State Management Complexity:** How intricate is the handling of state transitions?
2. **Event Handling Complexity:** How complicated are the interactions between checkboxes?
3. **Code Overhead:** How much extra code or abstraction is needed to achieve the functionality?

Respond with a JSON object containing only scores (0-100) and a summary:
{
  "scores": {
    "framework1": 78,
    "framework2": 64
  },
  "summary": "Framework1 has a lower complexity index due to simpler state management and event handling, while Framework2 introduces additional abstractions that increase complexity."
}

Here are the implementations:

${Object.entries(implementations).map(formatImplementation).join("\n\n")}`;

export async function evaluateFrameworkComplexity(
	implementations: Record<FrameworkId, string>,
): Promise<ComplexityResults> {
	const response = await getModelResponse(prompt(implementations));
	return JSON.parse(response) as ComplexityResults;
}
