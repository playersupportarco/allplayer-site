const APP_STORE_ID = 6761591864;
const LOOKUP_ENDPOINT = "https://itunes.apple.com/lookup";

export function lookupURLForLanguage(language) {
    const country = language.toLowerCase().startsWith("zh") ? "cn" : "us";
    return `${LOOKUP_ENDPOINT}?id=${APP_STORE_ID}&country=${country}`;
}

export function parseLookupResponse(payload) {
    if (!payload || payload.resultCount < 1 || !Array.isArray(payload.results)) {
        return null;
    }

    const result = payload.results.find((item) => item.trackId === APP_STORE_ID);
    const version = typeof result?.version === "string" ? result.version.trim() : "";
    const releaseNotes = typeof result?.releaseNotes === "string"
        ? result.releaseNotes.trim()
        : "";

    if (!version || !releaseNotes) {
        return null;
    }

    return {
        version,
        releaseNotes,
        releaseDate: typeof result.currentVersionReleaseDate === "string"
            ? result.currentVersionReleaseDate
            : ""
    };
}

export async function fetchReleaseForLanguage(
    language,
    fetchImplementation = fetch,
    timeoutMilliseconds = 5000
) {
    if (typeof fetchImplementation !== "function") {
        return null;
    }

    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeout = controller
        ? setTimeout(() => controller.abort(), timeoutMilliseconds)
        : null;

    try {
        const response = await fetchImplementation(
            lookupURLForLanguage(language),
            controller ? { signal: controller.signal } : undefined
        );
        if (!response?.ok || typeof response.json !== "function") {
            return null;
        }
        return parseLookupResponse(await response.json());
    } catch (_) {
        return null;
    } finally {
        if (timeout) {
            clearTimeout(timeout);
        }
    }
}

export function releaseCopyForLanguage(version, language) {
    if (language.toLowerCase().startsWith("zh")) {
        return {
            trigger: `查看 ${version} 新功能`,
            badge: `版本 ${version}`,
            title: `${version} 版本新功能`,
            updated: "更新于",
            store: "前往 App Store",
            close: "关闭更新说明",
            availability: `AllPlayer ${version} · `
        };
    }

    return {
        trigger: `See what's new in ${version}`,
        badge: `Version ${version}`,
        title: `What's new in version ${version}`,
        updated: "Updated",
        store: "Open in the App Store",
        close: "Close release notes",
        availability: `AllPlayer ${version} · `
    };
}

export function applyReleaseToElements(elements, release, language) {
    const copy = releaseCopyForLanguage(release.version, language);
    elements.trigger.textContent = copy.trigger;
    elements.trigger.hidden = false;
    elements.badge.textContent = copy.badge;
    elements.badge.hidden = false;
    elements.availability.textContent = copy.availability;
    elements.availability.hidden = false;
}

function normalizedLanguage(language) {
    return language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function storeURLForLanguage(language) {
    return normalizedLanguage(language) === "zh"
        ? "https://apps.apple.com/cn/app/allplayer-pro/id6761591864"
        : "https://apps.apple.com/app/allplayer-pro/id6761591864";
}

function releaseElementsForLanguage(documentReference, language) {
    const block = documentReference.querySelector(
        `[data-lang-block="${normalizedLanguage(language)}"]`
    );
    if (!block) {
        return null;
    }
    const trigger = block.querySelector("[data-release-trigger]");
    const badge = block.querySelector("[data-release-version-badge]");
    const availability = block.querySelector("[data-release-availability]");
    return trigger && badge && availability
        ? { trigger, badge, availability }
        : null;
}

function formattedReleaseDate(value, language) {
    if (!value) {
        return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    const locale = normalizedLanguage(language) === "zh" ? "zh-CN" : "en-US";
    return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(date);
}

export function initializeReleaseNotes(
    documentReference = document,
    windowReference = window,
    fetchImplementation = fetch
) {
    const dialog = documentReference.querySelector("[data-release-dialog]");
    if (!dialog) {
        return;
    }

    const releases = new Map();
    const requests = new Map();
    let currentLanguage = normalizedLanguage(documentReference.documentElement.lang || "en");
    let triggerToRestore = null;

    const openDialog = (language) => {
        const normalized = normalizedLanguage(language);
        const release = releases.get(normalized);
        if (!release) {
            return;
        }

        const copy = releaseCopyForLanguage(release.version, normalized);
        dialog.querySelector("[data-release-dialog-title]").textContent = copy.title;
        dialog.querySelector("[data-release-dialog-notes]").textContent = release.releaseNotes;

        const dateNode = dialog.querySelector("[data-release-dialog-date]");
        const releaseDate = formattedReleaseDate(release.releaseDate, normalized);
        dateNode.textContent = releaseDate ? `${copy.updated} ${releaseDate}` : "";
        dateNode.hidden = !releaseDate;

        const storeLink = dialog.querySelector("[data-release-dialog-store]");
        storeLink.textContent = copy.store;
        storeLink.href = storeURLForLanguage(normalized);

        const closeButton = dialog.querySelector("[data-release-close]");
        closeButton.setAttribute("aria-label", copy.close);

        if (typeof dialog.showModal === "function") {
            dialog.showModal();
        } else {
            dialog.setAttribute("open", "");
        }
        closeButton.focus();
    };

    const closeDialog = () => {
        if (typeof dialog.close === "function") {
            dialog.close();
        } else {
            dialog.removeAttribute("open");
        }
        triggerToRestore?.focus();
    };

    documentReference.querySelectorAll("[data-release-trigger]").forEach((trigger) => {
        trigger.addEventListener("click", () => {
            triggerToRestore = trigger;
            openDialog(trigger.closest("[data-lang-block]")?.dataset.langBlock || currentLanguage);
        });
    });

    dialog.querySelector("[data-release-close]").addEventListener("click", closeDialog);
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) {
            closeDialog();
        }
    });

    const load = async (language) => {
        const normalized = normalizedLanguage(language);
        currentLanguage = normalized;

        if (releases.has(normalized)) {
            const elements = releaseElementsForLanguage(documentReference, normalized);
            if (elements) {
                applyReleaseToElements(elements, releases.get(normalized), normalized);
            }
            return;
        }

        if (!requests.has(normalized)) {
            requests.set(
                normalized,
                fetchReleaseForLanguage(normalized, fetchImplementation)
            );
        }
        const release = await requests.get(normalized);
        requests.delete(normalized);
        if (!release) {
            return;
        }
        releases.set(normalized, release);

        const elements = releaseElementsForLanguage(documentReference, normalized);
        if (elements) {
            applyReleaseToElements(elements, release, normalized);
        }
    };

    windowReference.addEventListener("allplayer:languagechange", (event) => {
        load(event.detail?.language || documentReference.documentElement.lang);
    });

    load(currentLanguage);
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
    initializeReleaseNotes();
}
