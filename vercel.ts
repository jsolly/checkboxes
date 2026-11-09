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
			source: "/release.json",
			headers: [
				{ key: "Cache-Control", value: "no-store" },
				{ key: "CDN-Cache-Control", value: "no-store" },
				{ key: "Vercel-CDN-Cache-Control", value: "no-store" },
			],
		},
	],
};
