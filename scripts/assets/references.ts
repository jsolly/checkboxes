const SITE = "https://www.checkboxes.xyz";
const PUBLIC_MEDIA = /^\/(?:favicon\.(?:ico|svg)|og-image\.jpg)$/u;
const MEDIA_TAG = /<(?:img|link|meta)\b[^>]*>/giu;
const URL_ATTRIBUTE =
	/(?:^|\s)(?:src|href|content)\s*=\s*["'](?<url>[^"']+)["']/giu;

/** The three existing published public media paths; source SVG imports are authoring inputs. */
export function documentReferences(
	text: string,
	kind: "html" | "json" | "css",
): Set<string> {
	const paths = new Set<string>();
	if (kind !== "html") return paths;
	for (const tag of text.matchAll(MEDIA_TAG)) {
		for (const attribute of tag[0].matchAll(URL_ATTRIBUTE)) {
			// biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket access for named regex groups.
			const value = attribute.groups?.["url"];
			if (!value || (!value.startsWith("/") && !value.startsWith(`${SITE}/`)))
				continue;
			const url = new URL(value, SITE);
			if (
				url.origin === SITE &&
				!url.search &&
				!url.hash &&
				PUBLIC_MEDIA.test(url.pathname)
			)
				paths.add(url.pathname);
		}
	}
	return paths;
}
