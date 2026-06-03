import { DECISION_POINT_SCORE_CAP } from "./types";

export function normalizeDecisionPointScore(decisionPoints: number): number {
	return Math.min(
		100,
		Math.round((decisionPoints / DECISION_POINT_SCORE_CAP) * 100),
	);
}
