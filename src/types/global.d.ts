import type { Application } from "@hotwired/stimulus";
declare global {
	interface Window {
		frameworkReady: boolean;
		Stimulus: Application;
	}
}
