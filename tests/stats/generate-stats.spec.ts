import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FRAMEWORKS } from "../../src/config/frameworks";
import { STATS_CONFIG } from "../../src/config/stats";
import savedStats from "../../src/data/framework-stats.json" with {
	type: "json",
};

const evaluator = vi.hoisted(() =>
	vi.fn<(...args: unknown[]) => Promise<unknown>>(),
);
vi.mock("../../src/utils/evaluateVibeComplexity", () => ({
	evaluateVibeComplexity: evaluator,
}));

const repo = fileURLToPath(new URL("../../", import.meta.url));
const originalCwd = process.cwd();
let scratch = "";
let statsPath: string;
let generateStats: () => Promise<void>;

beforeEach(async () => {
	scratch = await fs.mkdtemp(path.join(os.tmpdir(), "stats-generation-"));
	await fs.cp(path.join(repo, "src"), path.join(scratch, "src"), {
		recursive: true,
	});
	const dist = path.join(scratch, "dist");
	await fs.mkdir(path.join(dist, "_astro"), { recursive: true });
	for (const id of ["baseline", ...Object.keys(FRAMEWORKS)]) {
		const route = path.join(dist, "test", id);
		await fs.mkdir(route, { recursive: true });
		await fs.writeFile(
			path.join(dist, "_astro", `${id}.js`),
			`export const framework = ${JSON.stringify(id)};`,
		);
		await fs.writeFile(
			path.join(route, "index.html"),
			`<script type="module" src="/_astro/${id}.js"></script>`,
		);
	}
	process.chdir(scratch);
	vi.stubEnv("GEMINI_API_KEY", "");
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	statsPath = path.join(scratch, STATS_CONFIG.STATS_FILE_PATH);
	evaluator.mockReset();
	// Import after changing cwd so dotenv can read only this credential-free fixture.
	({ generateStats } = await import("../../src/utils/generate-stats"));
});

afterEach(async () => {
	process.chdir(originalCwd);
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	if (scratch) await fs.rm(scratch, { recursive: true, force: true });
	scratch = "";
});

async function rejectsWithoutOverwrite(pattern: RegExp) {
	const before = await fs.readFile(statsPath, "utf8");
	await expect(generateStats()).rejects.toThrow(pattern);
	expect(await fs.readFile(statsPath, "utf8")).toBe(before);
}

function generatedScores(value: number) {
	return Object.fromEntries(
		Object.keys(savedStats.frameworks).map((id) => [
			id,
			id === "react" ? 0 : id === "vue" ? 100 : value,
		]),
	);
}

it("valid saved scores, including 0 and 100, survive generation without a model request", async () => {
	const existing = {
		...savedStats,
		frameworks: {
			...savedStats.frameworks,
			react: { ...savedStats.frameworks.react, vibeComplexity: 0 },
			vue: { ...savedStats.frameworks.vue, vibeComplexity: 100 },
		},
	};
	await fs.writeFile(statsPath, JSON.stringify(existing));
	await generateStats();
	const output: unknown = JSON.parse(await fs.readFile(statsPath, "utf8"));
	expect(output).toMatchObject({
		frameworks: Object.fromEntries(
			Object.entries(existing.frameworks).map(([id, row]) => [
				id,
				{ vibeComplexity: row.vibeComplexity },
			]),
		),
	});
	expect(evaluator).not.toHaveBeenCalled();
});

it("corrupt saved JSON fails without replacing its bytes", async () => {
	await fs.writeFile(statsPath, "{invalid-json");
	await rejectsWithoutOverwrite(/JSON|property name|Unexpected/i);
	expect(evaluator).not.toHaveBeenCalled();
});

it("a legacy-only saved score fails instead of becoming zero", async () => {
	const { vibeComplexity: omitted, ...legacy } = savedStats.frameworks.react;
	expect(omitted).toBeDefined();
	await fs.writeFile(
		statsPath,
		JSON.stringify({
			...savedStats,
			frameworks: {
				...savedStats.frameworks,
				react: { ...legacy, complexityScore: 76 },
			},
		}),
	);
	await rejectsWithoutOverwrite(
		/Missing or invalid saved vibe complexity for react/,
	);
	expect(evaluator).not.toHaveBeenCalled();
});

it("a missing saved file fails without creating a replacement", async () => {
	await fs.unlink(statsPath);
	await expect(generateStats()).rejects.toThrow(/ENOENT/);
	await expect(fs.access(statsPath)).rejects.toThrow(/ENOENT/);
	expect(evaluator).not.toHaveBeenCalled();
});

it.each([-1, 101, null, "32"])(
	"invalid saved score %s preserves the previous file",
	async (score) => {
		await fs.writeFile(
			statsPath,
			JSON.stringify({
				...savedStats,
				frameworks: {
					...savedStats.frameworks,
					react: { ...savedStats.frameworks.react, vibeComplexity: score },
				},
			}),
		);
		await rejectsWithoutOverwrite(
			/Missing or invalid saved vibe complexity for react/,
		);
		expect(evaluator).not.toHaveBeenCalled();
	},
);

it.each([-1, 101, NaN, Infinity, "32", null])(
	"invalid generated score %s cannot overwrite saved data",
	async (score) => {
		vi.stubEnv("GEMINI_API_KEY", "offline-stats-fixture");
		evaluator.mockResolvedValue({
			scores: { ...generatedScores(50), react: score },
		});
		await rejectsWithoutOverwrite(
			/Missing or invalid generated vibe complexity for react/,
		);
		expect(evaluator).toHaveBeenCalledTimes(1);
	},
);

it("a generated result missing frameworks cannot overwrite saved data", async () => {
	vi.stubEnv("GEMINI_API_KEY", "offline-stats-fixture");
	evaluator.mockResolvedValue({ scores: { vanillajs: 40 } });
	await rejectsWithoutOverwrite(/Missing or invalid generated vibe complexity/);
	expect(evaluator).toHaveBeenCalledTimes(1);
});

it("an API failure after a valid iteration never publishes partial measurements", async () => {
	vi.stubEnv("GEMINI_API_KEY", "offline-stats-fixture");
	evaluator
		.mockResolvedValueOnce({ scores: generatedScores(20) })
		.mockRejectedValue(new Error("429 RESOURCE_EXHAUSTED offline fixture"));
	await rejectsWithoutOverwrite(/429 RESOURCE_EXHAUSTED/);
	expect(evaluator).toHaveBeenCalledTimes(2);
});

it("complete model iterations publish each framework's median and accept boundary scores", async () => {
	vi.stubEnv("GEMINI_API_KEY", "offline-stats-fixture");
	const measurements = [20, 80, 40, 60, 50];
	expect(STATS_CONFIG.VIBE_COMPLEXITY_ITERATIONS).toBe(measurements.length);
	for (const value of measurements)
		evaluator.mockResolvedValueOnce({ scores: generatedScores(value) });
	await generateStats();
	const output: unknown = JSON.parse(await fs.readFile(statsPath, "utf8"));
	expect(output).toMatchObject({
		frameworks: Object.fromEntries(
			Object.entries(generatedScores(50)).map(([id, value]) => [
				id,
				{ vibeComplexity: value },
			]),
		),
	});
	expect(evaluator).toHaveBeenCalledTimes(measurements.length);
});
