import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FRAMEWORKS, type FrameworkId } from "../../src/config/frameworks";
import { readImplementationSources } from "../../src/utils/implementationSources";

describe("A stats generation run reads the same source files shown on cards", () => {
	it("resolves every framework to a non-container implementation file", async () => {
		const sources = await readImplementationSources();
		const frameworkIds = Object.keys(FRAMEWORKS) as FrameworkId[];

		assert.deepEqual(Object.keys(sources).sort(), frameworkIds.sort());

		for (const id of frameworkIds) {
			const source = sources[id];
			assert.equal(source.framework, id);
			assert.ok(source.code.length > 0);
			assert.ok(!source.relativePath.toLowerCase().includes("container"));
			assert.ok(source.absolutePath.endsWith(source.relativePath));
		}
	});
});
