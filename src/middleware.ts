import { defineMiddleware } from "astro/middleware";

import { RELEASE_ID } from "./release-id";
import { processEnv } from "./utils/processEnv";

function resolveReleaseId(): string {
	if (RELEASE_ID !== "dev") return RELEASE_ID;
	const sha =
		processEnv("VERCEL_GIT_COMMIT_SHA") ?? processEnv("GITHUB_SHA") ?? "";
	return sha ? sha.slice(0, 12) : "dev";
}

export const onRequest = defineMiddleware(async (_context, next) => {
	const response = await next();
	const releaseId = resolveReleaseId();
	try {
		response.headers.set("x-release-id", releaseId);
		return response;
	} catch {
		const headers = new Headers(response.headers);
		headers.set("x-release-id", releaseId);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}
});
