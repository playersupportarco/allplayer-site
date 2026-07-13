(function () {
    const translations = {
        en: {
            nav_home: "Home",
            nav_features: "Features",
            nav_privacy: "Privacy",
            nav_support: "Support",
            footer_platform: "AllPlayer · Independent Developer · Built for Apple platforms",
            footer_home: "Back to Home",
            footer_privacy: "Privacy Policy"
        },
        zh: {
            nav_home: "首页",
            nav_features: "功能",
            nav_privacy: "隐私政策",
            nav_support: "技术支持",
            footer_platform: "AllPlayer · 独立开发者 · 为 Apple 全平台打造",
            footer_home: "返回首页",
            footer_privacy: "隐私政策"
        }
    };

    const blocks = document.querySelectorAll("[data-lang-block]");
    const toggle = document.querySelector("[data-lang-toggle]");
    const savedLanguage = readSavedLanguage();
    const browserLanguage = (navigator.languages && navigator.languages[0]) || navigator.language || "en";
    let current = savedLanguage || (browserLanguage.toLowerCase().startsWith("zh") ? "zh" : "en");

    function readSavedLanguage() {
        try {
            const value = window.localStorage.getItem("allplayer-site-language");
            return value === "zh" || value === "en" ? value : null;
        } catch (_) {
            return null;
        }
    }

    function saveLanguage(lang) {
        try {
            window.localStorage.setItem("allplayer-site-language", lang);
        } catch (_) {
            // Language switching still works when storage is unavailable.
        }
    }

    function applyLanguage(lang, shouldSave) {
        current = lang;
        document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
        blocks.forEach((block) => {
            block.hidden = block.dataset.langBlock !== lang;
        });
        document.querySelectorAll("[data-i18n]").forEach((node) => {
            const key = node.dataset.i18n;
            if (translations[lang][key]) {
                node.textContent = translations[lang][key];
            }
        });
        if (toggle) {
            toggle.textContent = lang === "zh" ? "English" : "中文";
            toggle.setAttribute("aria-label", lang === "zh" ? "Switch to English" : "切换到中文");
        }
        document.querySelectorAll("[data-features-link]").forEach((link) => {
            link.setAttribute("href", lang === "zh" ? "#features-zh" : "#features");
        });
        if (shouldSave) {
            saveLanguage(lang);
        }
    }

    if (toggle) {
        toggle.addEventListener("click", () => {
            applyLanguage(current === "zh" ? "en" : "zh", true);
        });
    }

    applyLanguage(current, false);
}());
