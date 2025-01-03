export async function getRawContent(path) {
	const response = await fetch(path);
	return await response.text();
}
