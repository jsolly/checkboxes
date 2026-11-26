import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
	git: {
		deploymentEnabled: {
			main: true,
			"preview/**": true,
			"*": false,
			"*/*": false,
			"*/*/*": false,
			"*/*/*/*": false,
			"**": false,
		},
	},
	headers: [
		{
			source: "/(.*)",
			headers: [
				{ key: "X-Content-Type-Options", value: "nosniff" },
				{ key: "X-Frame-Options", value: "SAMEORIGIN" },
				{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
				{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
			],
		},
		{
			source: "/release.json",
			headers: [
				{ key: "Cache-Control", value: "no-store" },
				{ key: "CDN-Cache-Control", value: "no-store" },
				{ key: "Vercel-CDN-Cache-Control", value: "no-store" },
			],
		},
	],
};
