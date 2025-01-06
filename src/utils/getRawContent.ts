export async function getRawContent(path: string) {
	const response = await fetch(path);
	return await response.text();
}
