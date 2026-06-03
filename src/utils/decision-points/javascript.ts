import { parse } from "@typescript-eslint/typescript-estree";

type AstNode = {
	type?: string;
	operator?: string;
	cases?: AstNode[];
	[key: string]: unknown;
};

const countedNodeTypes = new Set([
	"IfStatement",
	"ConditionalExpression",
	"ForStatement",
	"ForInStatement",
	"ForOfStatement",
	"WhileStatement",
	"DoWhileStatement",
	"CatchClause",
]);

const countedLogicalOperators = new Set(["&&", "||", "??"]);

export function countJavaScriptDecisionPoints(code: string): number {
	if (code.trim().length === 0) return 0;

	const ast = parse(code, {
		comment: false,
		errorOnUnknownASTType: true,
		jsx: true,
		loc: false,
		range: false,
		tokens: false,
	});

	return countNode(ast as unknown as AstNode);
}

function countNode(node: AstNode | AstNode[] | unknown): number {
	if (Array.isArray(node)) {
		return node.reduce((sum, child) => sum + countNode(child), 0);
	}

	if (!isAstNode(node)) return 0;

	let total = 0;

	if (node.type && countedNodeTypes.has(node.type)) {
		total += 1;
	}

	if (
		node.type === "LogicalExpression" &&
		typeof node.operator === "string" &&
		countedLogicalOperators.has(node.operator)
	) {
		total += 1;
	}

	if (node.type === "SwitchCase" && node.test !== null) {
		total += 1;
	}

	for (const [key, value] of Object.entries(node)) {
		if (key === "parent") continue;
		if (isAstNode(value) || Array.isArray(value)) {
			total += countNode(value);
		}
	}

	return total;
}

function isAstNode(value: unknown): value is AstNode {
	return typeof value === "object" && value !== null && "type" in value;
}
