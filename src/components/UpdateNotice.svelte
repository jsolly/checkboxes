<script lang="ts">
import { onMount, tick } from "svelte";
import Button from "../lib/components/ui/button/button.svelte";

let { release }: { release: string } = $props();
let updateControl: HTMLElement | null = $state(null);
let reopenControl: HTMLElement | null = $state(null);
let available = $state("");
let dismissed = $state("");
let busy = $state(false);
let error = $state("");
let checking = false;
let stopped = false;
let epoch = 0;
let lastCheck = 0;
let failures = 0;
let timer: number | undefined;
const lifetime = new AbortController();
const attemptKey = "checkboxes:update-attempt";

async function dismiss() {
	dismissed = available;
	error = "";
	await tick();
	reopenControl?.focus();
}

async function reopen() {
	dismissed = "";
	await tick();
	updateControl?.focus();
}

async function latest() {
	const response = await fetch("/release.json", {
		cache: "no-store",
		redirect: "error",
		signal: AbortSignal.any([AbortSignal.timeout(8000), lifetime.signal]),
	});
	if (
		!response.ok ||
		!response.headers.get("content-type")?.includes("application/json") ||
		new URL(response.url).origin !== location.origin
	)
		throw new Error("Release unavailable");
	const data: unknown = await response.json();
	if (
		!data ||
		typeof data !== "object" ||
		!("release" in data) ||
		typeof data.release !== "string" ||
		!/^[A-Za-z0-9_-]{1,128}$/.test(data.release)
	)
		throw new Error("Invalid release");
	return data.release;
}

function schedule() {
	window.clearTimeout(timer);
	if (release && !stopped && !document.hidden && navigator.onLine) {
		timer = window.setTimeout(
			() => void check(),
			Math.min(300000 * 2 ** failures, 1800000) + Math.random() * 30000,
		);
	}
}

async function check() {
	if (
		!release ||
		stopped ||
		checking ||
		busy ||
		document.hidden ||
		!navigator.onLine ||
		Date.now() - lastCheck < 1000
	)
		return;
	checking = true;
	lastCheck = Date.now();
	const requestEpoch = ++epoch;
	try {
		const next = await latest();
		if (!stopped && requestEpoch === epoch) {
			available = next === release ? "" : next;
			failures = 0;
		}
	} catch {
		// Keep the confirmed notice and back off failed background checks.
		failures = Math.min(failures + 1, 3);
	} finally {
		checking = false;
		schedule();
	}
}

async function update() {
	if (busy) return;
	if (
		document.querySelector(
			"[data-framework] input:checked, [data-framework] input:indeterminate",
		) &&
		!window.confirm(
			"Updating will reset your demo checkbox selections. Reload this tab now?",
		)
	)
		return;
	epoch++;
	busy = true;
	error = "";
	try {
		const next = await latest();
		if (next === release) {
			available = "";
			return;
		}
		// Confirm this route and the release endpoint belong to the same deployment.
		const response = await fetch(location.href, {
			cache: "no-store",
			redirect: "error",
			signal: AbortSignal.any([AbortSignal.timeout(8000), lifetime.signal]),
		});
		if (!response.ok) throw new Error("Page unavailable");
		const page = new DOMParser().parseFromString(
			await response.text(),
			"text/html",
		);
		if (
			page
				.querySelector('meta[name="website-release"]')
				?.getAttribute("content") !== next
		) {
			throw new Error("Deployment changed during check");
		}
		sessionStorage.setItem(
			attemptKey,
			JSON.stringify({ from: release, target: next }),
		);
		location.reload();
	} catch {
		error =
			"Could not load the update. Your page is unchanged. Try again when online.";
	} finally {
		busy = false;
	}
}

onMount(() => {
	try {
		const saved = sessionStorage.getItem(attemptKey);
		sessionStorage.removeItem(attemptKey);
		if (saved) {
			const attempt: unknown = JSON.parse(saved);
			if (
				attempt &&
				typeof attempt === "object" &&
				"from" in attempt &&
				attempt.from === release &&
				"target" in attempt &&
				typeof attempt.target === "string" &&
				/^[A-Za-z0-9_-]{1,128}$/.test(attempt.target)
			) {
				available = attempt.target;
				error = "This tab still has the previous version. Try updating again.";
			}
		}
	} catch {
		// Storage can be blocked. Detection still works; applying reports a recoverable failure.
	}
	void check();
	schedule();
	return () => {
		stopped = true;
		lifetime.abort();
		window.clearTimeout(timer);
	};
});
</script>

<svelte:window onfocus={() => void check()} ononline={() => { schedule(); void check(); }} onoffline={schedule} />
<svelte:document onvisibilitychange={() => { schedule(); void check(); }} />

<div aria-live="polite" aria-atomic="true">
	{#if available && available === dismissed}
		<div class="reopen"><Button variant="outline" class="bg-white text-slate-900 border-slate-400" bind:ref={reopenControl} onclick={() => void reopen()}>Show available update</Button></div>
	{:else if available}
		<aside class="update-notice" aria-label="Website update">
			<div>
				<p><strong>Update available</strong></p>
				<p>Reload this tab when you're ready. Demo checkbox selections will reset.</p>
				{#if error}<p role="alert">{error}</p>{/if}
			</div>
			<div class="actions">
				<Button bind:ref={updateControl} onclick={() => void update()} disabled={busy}>{busy ? "Checking update…" : "Update and reload"}</Button>
				<Button class="bg-white text-slate-900 border-slate-400 hover:bg-slate-100" variant="outline" disabled={busy} onclick={() => void dismiss()}>Later</Button>
			</div>
		</aside>
	{/if}
</div>

<style>
@layer components {
.reopen { margin: .75rem; text-align: right; }
.update-notice { margin: 1rem auto; max-width: 72rem; padding: 1rem; border: 1px solid #6366f1; border-radius: .5rem; background: #eef2ff; color: #1e1b4b; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
p { margin: 0; font-size: .875rem; }
.actions { display: flex; flex-wrap: wrap; gap: .5rem; flex-shrink: 0; }
@media (max-width: 640px) { .update-notice { margin: .75rem; flex-direction: column; align-items: flex-start; } }
@media (prefers-color-scheme: dark) { .update-notice { background: #1e1b4b; color: #eef2ff; border-color: #a5b4fc; } }
}
</style>
