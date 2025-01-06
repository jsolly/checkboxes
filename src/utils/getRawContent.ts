export async function getRawContent(path: string) {
	const response = await fetch(path);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch content from ${path}: ${response.statusText}`,
		);
	}
	return response.text();
}
