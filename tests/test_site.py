import re
import unittest
from html.parser import HTMLParser
from pathlib import Path


SITE_ROOT = Path(__file__).resolve().parents[1]
APP_VERSION_FILE = SITE_ROOT.parent / "allplayer" / "Config" / "Version.xcconfig"
APP_STORE_ID = "6761591864"


class DocumentParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.anchors = []
        self.feature_sections = {"en": set(), "zh": set()}
        self.release_triggers = {"en": [], "zh": []}
        self.release_badges = {"en": [], "zh": []}
        self.release_dialogs = []
        self.scripts = []
        self.metas = {}
        self.language_div_stack = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "div":
            inherited_language = (
                self.language_div_stack[-1] if self.language_div_stack else None
            )
            self.language_div_stack.append(
                attributes.get("data-lang-block", inherited_language)
            )
        if tag == "a":
            self.anchors.append(attributes)
        if (
            tag == "button"
            and "data-release-trigger" in attributes
            and self.current_language in self.release_triggers
        ):
            self.release_triggers[self.current_language].append(attributes)
        if (
            tag == "span"
            and "data-release-version-badge" in attributes
            and self.current_language in self.release_badges
        ):
            self.release_badges[self.current_language].append(attributes)
        if tag == "dialog" and "data-release-dialog" in attributes:
            self.release_dialogs.append(attributes)
        if tag == "script" and attributes.get("src"):
            self.scripts.append(attributes)
        if tag == "meta" and attributes.get("name"):
            self.metas[attributes["name"]] = attributes.get("content", "")
        if (
            tag == "section"
            and self.current_language in self.feature_sections
            and attributes.get("data-feature")
        ):
            self.feature_sections[self.current_language].add(attributes["data-feature"])

    def handle_endtag(self, tag):
        if tag == "div" and self.language_div_stack:
            self.language_div_stack.pop()

    @property
    def current_language(self):
        return self.language_div_stack[-1] if self.language_div_stack else None


def parse_document(name):
    parser = DocumentParser()
    parser.feed((SITE_ROOT / name).read_text(encoding="utf-8"))
    return parser


def app_marketing_version():
    contents = APP_VERSION_FILE.read_text(encoding="utf-8")
    match = re.search(r"^MARKETING_VERSION\s*=\s*(\S+)$", contents, re.MULTILINE)
    if not match:
        raise AssertionError("MARKETING_VERSION is missing from the app config")
    return match.group(1)


class SiteContractTests(unittest.TestCase):
    def test_every_page_offers_the_same_app_store_destination(self):
        for page in ("index.html", "support.html", "privacy.html"):
            with self.subTest(page=page):
                document = parse_document(page)
                store_links = [
                    anchor
                    for anchor in document.anchors
                    if "apps.apple.com" in anchor.get("href", "")
                ]
                self.assertGreaterEqual(len(store_links), 1)
                self.assertTrue(
                    all(APP_STORE_ID in anchor["href"] for anchor in store_links)
                )

    def test_home_page_exposes_the_ios_smart_app_banner(self):
        document = parse_document("index.html")
        self.assertEqual(
            document.metas.get("apple-itunes-app"),
            f"app-id={APP_STORE_ID}",
        )

    def test_published_site_version_matches_the_app_project(self):
        document = parse_document("index.html")
        self.assertEqual(
            document.metas.get("allplayer-version"),
            app_marketing_version(),
        )

    def test_home_page_feature_sections_have_language_parity(self):
        document = parse_document("index.html")
        expected = {
            "sources",
            "media-center",
            "connectivity",
            "cross-device",
            "pro",
        }
        self.assertEqual(document.feature_sections["en"], expected)
        self.assertEqual(document.feature_sections["zh"], expected)

    def test_release_notes_ui_stays_hidden_until_app_store_data_arrives(self):
        document = parse_document("index.html")
        for language in ("en", "zh"):
            with self.subTest(language=language):
                self.assertEqual(len(document.release_triggers[language]), 1)
                self.assertIn("hidden", document.release_triggers[language][0])
                self.assertEqual(len(document.release_badges[language]), 1)
                self.assertIn("hidden", document.release_badges[language][0])
        self.assertEqual(len(document.release_dialogs), 1)

    def test_home_page_loads_the_app_store_release_module(self):
        document = parse_document("index.html")
        release_scripts = [
            script
            for script in document.scripts
            if script.get("src") == "release-notes.mjs"
        ]
        self.assertEqual(
            release_scripts,
            [{"type": "module", "src": "release-notes.mjs"}],
        )


if __name__ == "__main__":
    unittest.main()
