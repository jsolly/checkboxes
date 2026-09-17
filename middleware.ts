import { next } from "@vercel/edge";

/**
 * Request-time release id. Astro middleware may not run for fully static routes;
 * Edge Middleware always runs and reads the deployment SHA.
 */
function processEnv(name: string): string | undefined {
	return process.env[name];
}

export default function middleware() {
	const response = next();
	const sha =
		processEnv("VERCEL_GIT_COMMIT_SHA") ?? processEnv("GITHUB_SHA") ?? "";
	const releaseId = sha ? sha.slice(0, 12) : "dev";
	response.headers.set("x-release-id", releaseId);
	return response;
}
