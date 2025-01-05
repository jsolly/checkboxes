export const FRAMEWORKS = [
	"vanilla-js",
	"alpine",
	"vue",
	"react",
	"svelte",
	"hyperscript",
	"css-only",
	"jquery",
];

export const CONFIG = {
	server: {
		port: 4321,
		startupTimeout: 30000,
		initializationDelay: 1000,
	},
	measurement: {
		maxRetries: 3,
		maxRenderTime: 10000,
		waitTimeout: 1000,
	},
	paths: {
		statsOutput: "src/data/framework-stats.json",
		dataDir: "src/data",
		vanillaComponent: "src/components/vanilla-js/vanilla.astro",
		scripts: {
			jquery: "src/scripts/jquery.min.js",
			hyperscript: "src/scripts/hyperscript.min.js",
		},
	},
};
