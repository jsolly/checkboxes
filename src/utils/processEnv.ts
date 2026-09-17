/** Read a process env var without colliding TS index-signature access and Biome useLiteralKeys. */
export function processEnv(name: string): string | undefined {
	return process.env[name];
}
