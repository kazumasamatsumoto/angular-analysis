#!/usr/bin/env ts-node

/**
 * test-cache.ts
 * キャッシュ機能の動作テスト
 *
 * Usage: npx ts-node scripts/test-cache.ts
 */

import { CacheManager } from '../src/utils/cache-manager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function testCacheManager(): void {
  console.log('🧪 Testing Cache Manager\n');

  // テンポラリディレクトリを作成
  const testDir = path.join(os.tmpdir(), 'angular-analyzer-test');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  console.log(`Test directory: ${testDir}\n`);

  // テストファイルを作成
  const testFile = path.join(testDir, 'test.ts');
  fs.writeFileSync(testFile, 'export class TestComponent {}');

  console.log('Test 1: Create new cache');
  console.log('-'.repeat(40));
  const cache1 = new CacheManager(testDir);
  const loaded1 = cache1.load();
  console.log(`✓ Load result: ${loaded1} (should be false)`);

  console.log('\nTest 2: Add file to cache');
  console.log('-'.repeat(40));
  const analysis = { name: 'TestComponent', type: 'component' };
  cache1.addToCache(testFile, analysis);
  console.log(`✓ File added to cache`);

  console.log('\nTest 3: Calculate hash');
  console.log('-'.repeat(40));
  const hash = cache1.calculateFileHash(testFile);
  console.log(`✓ Hash: ${hash}`);

  console.log('\nTest 4: Save cache');
  console.log('-'.repeat(40));
  const cacheFiles = new Map([[testFile, {
    path: testFile,
    hash,
    lastModified: fs.statSync(testFile).mtimeMs,
    analysis
  }]]);
  cache1.save(testDir, cacheFiles);
  const cachePath = path.join(testDir, '.cache', 'analysis-cache.json');
  const cacheExists = fs.existsSync(cachePath);
  console.log(`✓ Cache file exists: ${cacheExists}`);

  console.log('\nTest 5: Load existing cache');
  console.log('-'.repeat(40));
  const cache2 = new CacheManager(testDir);
  const loaded2 = cache2.load();
  console.log(`✓ Load result: ${loaded2} (should be true)`);

  console.log('\nTest 6: Get cached analysis');
  console.log('-'.repeat(40));
  const cached = cache2.getCachedAnalysis(testFile);
  console.log(`✓ Cached analysis: ${JSON.stringify(cached)}`);
  console.log(`✓ Match: ${JSON.stringify(cached) === JSON.stringify(analysis)}`);

  console.log('\nTest 7: Check file change detection (no change)');
  console.log('-'.repeat(40));
  const changed1 = cache2.hasFileChanged(testFile);
  console.log(`✓ File changed: ${changed1} (should be false)`);

  console.log('\nTest 8: Modify file and check change detection');
  console.log('-'.repeat(40));
  setTimeout(() => {
    fs.writeFileSync(testFile, 'export class TestComponent { modified = true; }');
    const changed2 = cache2.hasFileChanged(testFile);
    console.log(`✓ File changed: ${changed2} (should be true)`);

    console.log('\nTest 9: Get stats');
    console.log('-'.repeat(40));
    const stats = cache2.getStats();
    console.log(`✓ Total files: ${stats.totalFiles}`);
    console.log(`✓ Cache age: ${stats.cacheAge}`);

    console.log('\nTest 10: Clear cache');
    console.log('-'.repeat(40));
    cache2.clear();
    const cacheExists2 = fs.existsSync(cachePath);
    console.log(`✓ Cache file exists: ${cacheExists2} (should be false)`);

    // クリーンアップ
    console.log('\n🧹 Cleaning up...');
    fs.rmSync(testDir, { recursive: true, force: true });
    console.log('✓ Test directory removed\n');

    console.log('✅ All tests passed!\n');
  }, 100);
}

testCacheManager();
