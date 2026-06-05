import type { Application } from "@hotwired/stimulus";

declare global {
	interface Window {
		frameworkReady: boolean;
		Stimulus: Application;
	}

	/** Hyperscript's `_` behavior attribute on any HTML element. */
	namespace astroHTML.JSX {
		interface HTMLAttributes {
			_?: string;
		}

		interface InputHTMLAttributes {
			_?: string;
		}
	}
}
