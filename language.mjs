export const languages = [
    ['en', 'English'], ['zh-Hans', '简体中文'], ['zh-Hant', '繁體中文'],
    ['ja', '日本語'], ['ko', '한국어'], ['de', 'Deutsch'], ['fr', 'Français'],
    ['es', 'Español'], ['it', 'Italiano'], ['pt-BR', 'Português (Brasil)'],
    ['ru', 'Русский'], ['id', 'Bahasa Indonesia'], ['th', 'ไทย'], ['vi', 'Tiếng Việt']
];
const supported = new Set(languages.map(([code]) => code));

export function normalizeLanguage(value) {
    if (typeof value !== 'string') return null;
    const parts = value.toLowerCase().replaceAll('_', '-').split('-');
    if (parts[0] === 'zh') {
        if (parts.includes('hans')) return 'zh-Hans';
        if (parts.includes('hant') || parts.some(p => ['tw', 'hk', 'mo'].includes(p))) return 'zh-Hant';
        return 'zh-Hans';
    }
    if (parts[0] === 'pt') return 'pt-BR';
    return supported.has(parts[0]) ? parts[0] : null;
}

export function resolveLanguage(preference, browserLanguages = []) {
    const selected = normalizeLanguage(preference);
    if (selected) return selected;
    for (const candidate of browserLanguages) {
        const match = normalizeLanguage(candidate);
        if (match) return match;
    }
    return 'en';
}

export function createLocaleLoader(fetchImplementation = fetch, timeoutMilliseconds = 8000) {
    const cache = new Map();
    return async (language) => {
        const code = normalizeLanguage(language) || 'en';
        if (!cache.has(code)) {
            const request = (async () => {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);
                try {
                    const response = await fetchImplementation(new URL(`./locales/${code}.json`, import.meta.url), {
                        cache: 'no-cache', signal: controller.signal
                    });
                    if (!response.ok) throw new Error('Language download failed');
                    const messages = await response.json();
                    if (!messages || typeof messages !== 'object' || Array.isArray(messages) ||
                        Object.values(messages).some(value => typeof value !== 'string')) {
                        throw new Error('Invalid language file');
                    }
                    return messages;
                } finally {
                    clearTimeout(timeout);
                }
            })();
            cache.set(code, request);
            request.catch(() => cache.delete(code));
        }
        return cache.get(code);
    };
}

export const englishUI = {
    language_auto: 'Follow browser', language_label: 'Language',
    language_error: 'This language could not be loaded. Please try again.',
    release_trigger: "See what's new in {version}", release_badge: 'Version {version}',
    release_title: "What's new in version {version}", release_updated: 'Updated',
    release_store: 'Open in the App Store', release_close: 'Close release notes'
};
export const siteLanguage = {language: 'en', messages: englishUI};
