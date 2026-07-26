import { defineMiddleware } from "astro:middleware";

import { RELEASE_ID } from "./release-id";

export const onRequest = defineMiddleware(async (_context, next) => {
	const response = await next();
	try {
		response.headers.set("x-release-id", RELEASE_ID);
		return response;
	} catch {
		const headers = new Headers(response.headers);
		headers.set("x-release-id", RELEASE_ID);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}
});
