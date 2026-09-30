import { languages, normalizeLanguage, resolveLanguage, createLocaleLoader, siteLanguage, englishUI } from './language.mjs';

const storageKey = 'allplayer-site-language';
const selector = document.querySelector('[data-language-select]');
const errorMessage = document.querySelector('[data-language-error]');
const loadLocale = createLocaleLoader();
const copyNodes = [...document.querySelectorAll('[data-copy], [data-i18n]')].map(node => ({
    node, key: node.dataset.copy || node.dataset.i18n,
    leading: node.textContent.match(/^\s*/)[0], trailing: node.textContent.match(/\s*$/)[0]
}));
const english = {...englishUI};
for (const {node, key} of copyNodes) english[key] = node.textContent.trim();
for (const [attribute, dataset] of [['aria-label', 'copyAria'], ['alt', 'copyAlt'], ['content', 'copyContent']]) {
    for (const node of document.querySelectorAll(`[data-${dataset.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}]`)) {
        english[node.dataset[dataset]] = node.getAttribute(attribute);
    }
}
let preference = 'auto';
try {
    const saved = localStorage.getItem(storageKey);
    preference = normalizeLanguage(saved) || 'auto';
} catch (_) { /* Language selection also works when storage is unavailable. */ }
let requestVersion = 0;

for (const [code, label] of languages) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = label;
    option.lang = code;
    selector.append(option);
}
selector.value = siteLanguage.language;
selector.hidden = false;

function applyLanguage(language, messages) {
    for (const {node, key, leading, trailing} of copyNodes) {
        node.textContent = leading + messages[key] + trailing;
    }
    for (const [attribute, dataName] of [['aria-label', 'copyAria'], ['alt', 'copyAlt'], ['content', 'copyContent']]) {
        const query = `[data-${dataName.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}]`;
        document.querySelectorAll(query).forEach(node => node.setAttribute(attribute, messages[node.dataset[dataName]]));
    }
    document.documentElement.lang = language;
    // The traditional Chinese and other translated pages keep their current section URLs.
    document.querySelectorAll('[data-features-link]').forEach(link => link.href = '#features');
    const country = language === 'zh-Hans' ? 'cn/' : '';
    document.querySelectorAll('a[href*="apps.apple.com"]').forEach(link => {
        link.href = `https://apps.apple.com/${country}app/allplayer-pro/id6761591864`;
    });
    const description = document.querySelector('meta[name="description"]')?.content;
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description || '');
    siteLanguage.language = language;
    siteLanguage.messages = messages;
    window.dispatchEvent(new CustomEvent('allplayer:languagechange', {detail: {language, messages}}));
}

async function chooseLanguage(choice, save) {
    const version = ++requestVersion;
    errorMessage.hidden = true;
    const requested = resolveLanguage(choice, navigator.languages?.length ? navigator.languages : [navigator.language]);
    try {
        const messages = requested === 'en' ? english : await loadLocale(requested);
        if (version !== requestVersion) return;
        for (const key of Object.keys(english)) {
            if (typeof messages[key] !== 'string') throw new Error(`Missing translation: ${key}`);
        }
        applyLanguage(requested, messages);
        preference = choice;
        selector.value = requested;
        if (save) {
            try { localStorage.setItem(storageKey, preference); } catch (_) { /* Keep the choice for this page. */ }
        }
    } catch (_) {
        if (version !== requestVersion) return;
        // Keep the current page readable and allow the same choice to be retried.
        selector.value = siteLanguage.language;
        errorMessage.textContent = siteLanguage.messages.language_error;
        errorMessage.hidden = false;
    }
}
selector.addEventListener('change', () => chooseLanguage(selector.value, true));
window.addEventListener('languagechange', () => {
    if (preference === 'auto') chooseLanguage('auto', false);
});
// Keep links to the previous Chinese feature section working.
if (location.hash === '#features-zh') location.replace('#features');
chooseLanguage(preference, false);
