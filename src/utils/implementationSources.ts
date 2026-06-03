import fs from "node:fs/promises";
import path from "node:path";
import { FRAMEWORKS, type FrameworkId } from "../config/frameworks";

export interface ImplementationSource {
	framework: FrameworkId;
	absolutePath: string;
	relativePath: string;
	extension: string;
	code: string;
}

export async function readImplementationSource(
	framework: FrameworkId,
): Promise<ImplementationSource> {
	const relativePath = FRAMEWORKS[framework].implementationFile;
	const absolutePath = path.join(process.cwd(), relativePath);
	const code = await fs.readFile(absolutePath, "utf-8");

	return {
		framework,
		absolutePath,
		relativePath,
		extension: path.extname(relativePath),
		code,
	};
}

export async function readImplementationSources(): Promise<
	Record<FrameworkId, ImplementationSource>
> {
	const entries = await Promise.all(
		(Object.keys(FRAMEWORKS) as FrameworkId[]).map(async (framework) => [
			framework,
			await readImplementationSource(framework),
		]),
	);

	return Object.fromEntries(entries) as Record<
		FrameworkId,
		ImplementationSource
	>;
}
