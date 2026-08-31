import json
import subprocess
import unittest
from pathlib import Path


SITE_ROOT = Path(__file__).resolve().parents[1]
RELEASE_MODULE = SITE_ROOT / "release-notes.mjs"


def evaluate_module(import_names, expression):
    if not RELEASE_MODULE.exists():
        raise AssertionError("release-notes.mjs is missing")
    source = (
        f'import {{ {", ".join(import_names)} }} from '
        f'{json.dumps(RELEASE_MODULE.as_uri())};'
        f"console.log(JSON.stringify(await ({expression})));"
    )
    result = subprocess.run(
        ["node", "--input-type=module", "--eval", source],
        cwd=SITE_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise AssertionError(result.stderr.strip() or "Node evaluation failed")
    return json.loads(result.stdout)


class ReleaseNotesModuleTests(unittest.TestCase):
    def test_lookup_url_uses_the_storefront_for_the_page_language(self):
        actual = evaluate_module(
            ["lookupURLForLanguage"],
            "[lookupURLForLanguage('zh-CN'), lookupURLForLanguage('en')]",
        )
        self.assertEqual(
            actual,
            [
                "https://itunes.apple.com/lookup?id=6761591864&country=cn",
                "https://itunes.apple.com/lookup?id=6761591864&country=us",
            ],
        )

    def test_complete_lookup_result_becomes_release_data(self):
        payload = {
            "resultCount": 1,
            "results": [
                {
                    "trackId": 6761591864,
                    "version": "1.2.3",
                    "releaseNotes": "  First improvement\nSecond improvement  ",
                    "currentVersionReleaseDate": "2026-08-26T19:55:16Z",
                }
            ],
        }
        actual = evaluate_module(
            ["parseLookupResponse"],
            f"parseLookupResponse({json.dumps(payload)})",
        )
        self.assertEqual(
            actual,
            {
                "version": "1.2.3",
                "releaseNotes": "First improvement\nSecond improvement",
                "releaseDate": "2026-08-26T19:55:16Z",
            },
        )

    def test_lookup_result_without_release_notes_is_ignored(self):
        payload = {
            "resultCount": 1,
            "results": [
                {
                    "trackId": 6761591864,
                    "version": "1.2.3",
                    "releaseNotes": "   ",
                }
            ],
        }
        actual = evaluate_module(
            ["parseLookupResponse"],
            f"parseLookupResponse({json.dumps(payload)})",
        )
        self.assertIsNone(actual)

    def test_failed_lookup_returns_no_release_instead_of_throwing(self):
        actual = evaluate_module(
            ["fetchReleaseForLanguage"],
            "fetchReleaseForLanguage('zh', async () => { throw new Error('offline'); })",
        )
        self.assertIsNone(actual)

    def test_release_copy_includes_the_live_version(self):
        actual = evaluate_module(
            ["releaseCopyForLanguage"],
            "[releaseCopyForLanguage('1.2.3', 'en'), releaseCopyForLanguage('1.2.3', 'zh')]",
        )
        self.assertEqual(
            actual,
            [
                {
                    "trigger": "See what's new in 1.2.3",
                    "badge": "Version 1.2.3",
                    "title": "What's new in version 1.2.3",
                    "updated": "Updated",
                    "store": "Open in the App Store",
                    "close": "Close release notes",
                    "availability": "AllPlayer 1.2.3 · ",
                },
                {
                    "trigger": "查看 1.2.3 新功能",
                    "badge": "版本 1.2.3",
                    "title": "1.2.3 版本新功能",
                    "updated": "更新于",
                    "store": "前往 App Store",
                    "close": "关闭更新说明",
                    "availability": "AllPlayer 1.2.3 · ",
                },
            ],
        )

    def test_release_data_reveals_the_previously_hidden_controls(self):
        expression = """
            (() => {
                const elements = {
                    trigger: { hidden: true, textContent: '' },
                    badge: { hidden: true, textContent: '' },
                    availability: { hidden: true, textContent: '' }
                };
                applyReleaseToElements(elements, { version: '1.2.3' }, 'zh');
                return elements;
            })()
        """
        actual = evaluate_module(["applyReleaseToElements"], expression)
        self.assertEqual(
            actual,
            {
                "trigger": {"hidden": False, "textContent": "查看 1.2.3 新功能"},
                "badge": {"hidden": False, "textContent": "版本 1.2.3"},
                "availability": {
                    "hidden": False,
                    "textContent": "AllPlayer 1.2.3 · ",
                },
            },
        )


if __name__ == "__main__":
    unittest.main()
