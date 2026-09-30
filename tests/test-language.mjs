import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLanguage, normalizeLanguage, createLocaleLoader } from '../language.mjs';

test('browser priority, unsupported locales and regional variants', () => {
  assert.equal(resolveLanguage('auto', ['nl-NL', 'fr-CA', 'en']), 'fr');
  assert.equal(resolveLanguage(null, ['zh-TW']), 'zh-Hant');
  assert.equal(resolveLanguage(null, ['zh-Hant-HK']), 'zh-Hant');
  assert.equal(resolveLanguage(null, ['zh-SG']), 'zh-Hans');
  assert.equal(resolveLanguage(null, ['pt-PT']), 'pt-BR');
  assert.equal(resolveLanguage(null, ['ar']), 'en');
  assert.equal(resolveLanguage(null, []), 'en');
});
test('explicit preference overrides browser; legacy Chinese is preserved', () => {
  assert.equal(resolveLanguage('ja', ['de']), 'ja');
  assert.equal(resolveLanguage('zh', ['en']), 'zh-Hans');
  assert.equal(resolveLanguage('bogus', ['ko']), 'ko');
  assert.equal(normalizeLanguage('zh-Hans-TW'), 'zh-Hans');
});
test('locale loader caches successes and lets failed downloads retry', async () => {
  let attempts = 0;
  const load = createLocaleLoader(async () => {
    if (++attempts === 1) throw new Error('offline');
    return {ok:true,json:async () => ({nav_home:'Accueil'})};
  });
  await assert.rejects(load('fr'));
  const result = await load('fr');
  assert.equal(result.nav_home, 'Accueil');
  assert.deepEqual(await load('fr'), result);
  assert.equal(attempts, 2);
});

test('stalled locale requests time out so the selector can recover', async () => {
  const load = createLocaleLoader((_url, {signal}) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('timeout')));
  }), 10);
  await assert.rejects(load('ja'), /timeout/);
});
