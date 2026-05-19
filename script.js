(function () {
    const translations = {
        en: {
            nav_home: "Home",
            nav_privacy: "Privacy",
            nav_support: "Support",
            footer_platform: "AllPlayer · Independent Developer · Available exclusively on Apple platforms",
            footer_home: "Back to Home",
            footer_privacy: "Privacy Policy"
        },
        zh: {
            nav_home: "首页",
            nav_privacy: "隐私政策",
            nav_support: "技术支持",
            footer_platform: "AllPlayer · 独立开发者 · 仅在 Apple 平台提供",
            footer_home: "返回首页",
            footer_privacy: "隐私政策"
        }
    };

    const blocks = document.querySelectorAll("[data-lang-block]");
    const toggle = document.querySelector("[data-lang-toggle]");
    let current = "en";

    function applyLanguage(lang) {
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
    }

    if (toggle) {
        toggle.addEventListener("click", () => {
            applyLanguage(current === "zh" ? "en" : "zh");
        });
    }

    applyLanguage(current);
}());
