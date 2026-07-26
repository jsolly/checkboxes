import { next } from "@vercel/edge";

/**
 * Request-time release id. Astro middleware may not run for fully static routes;
 * Edge Middleware always runs and reads the deployment SHA.
 */
export default function middleware() {
	const response = next();
	const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "";
	const releaseId = sha ? sha.slice(0, 12) : "dev";
	response.headers.set("x-release-id", releaseId);
	return response;
}
