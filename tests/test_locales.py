import json
import re
import unittest
from pathlib import Path
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]
LANGUAGES = {'en', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'de', 'fr', 'es', 'it', 'pt-BR', 'ru', 'id', 'th', 'vi'}

class CopyParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.keys = set()
        self.selects = 0
        self.duplicate_ids = set()
        self.ids = set()
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for name in ('data-copy','data-i18n','data-copy-aria','data-copy-alt','data-copy-content'):
            if name in attrs: self.keys.add(attrs[name])
        if tag == 'select' and 'data-language-select' in attrs: self.selects += 1
        if 'id' in attrs:
            if attrs['id'] in self.ids: self.duplicate_ids.add(attrs['id'])
            self.ids.add(attrs['id'])

class LocaleTests(unittest.TestCase):
    def test_languages_match_app_and_every_locale_has_complete_copy(self):
        paths = {p.stem:p for p in (ROOT/'locales').glob('*.json')}
        self.assertEqual(set(paths), LANGUAGES)
        english = json.loads(paths['en'].read_text())
        for lang, path in paths.items():
            with self.subTest(language=lang):
                values = json.loads(path.read_text())
                self.assertEqual(set(values), set(english))
                for key, value in values.items():
                    self.assertIsInstance(value,str)
                    self.assertTrue(value.strip(),key)
                    self.assertEqual(re.findall(r'\{\w+\}', value), re.findall(r'\{\w+\}', english[key]),key)
                    if '@gmail.com' in english[key]: self.assertEqual(value, english[key],key)
    def test_every_page_copy_key_resolves_and_uses_one_dropdown(self):
        english = json.loads((ROOT/'locales/en.json').read_text())
        for page in ('index','privacy','support'):
            with self.subTest(page=page):
                parser=CopyParser();parser.feed((ROOT/f'{page}.html').read_text())
                self.assertTrue(parser.keys.issubset(english),parser.keys-set(english))
                self.assertEqual(parser.selects,1)
                self.assertFalse(parser.duplicate_ids)
                self.assertEqual({k for k in parser.keys if k.startswith(page+'_')},
                                 {k for k in english if re.fullmatch(page+r'_\d+',k)} | ({page+'_title',page+'_description'} if page!='index' else set()))

if __name__ == '__main__': unittest.main()
