export type WithElementRef<T, E extends HTMLElement = HTMLElement> = T & {
	ref?: E | null;
};
