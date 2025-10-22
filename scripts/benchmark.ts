#!/usr/bin/env ts-node

/**
 * benchmark.ts
 * キャッシュ機能のベンチマーク
 *
 * Usage: npx ts-node scripts/benchmark.ts <project-dir>
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface BenchmarkResult {
  run: number;
  duration: number;
  cacheHits?: number;
  cacheMisses?: number;
  hitRate?: number;
}

function runBenchmark(projectPath: string, iterations: number = 3): void {
  console.log('🚀 Angular Analyzer - Cache Benchmark\n');
  console.log(`Project: ${projectPath}`);
  console.log(`Iterations: ${iterations}\n`);
  console.log('=' .repeat(60));

  const results: BenchmarkResult[] = [];

  // キャッシュをクリア
  console.log('\n📦 Clearing cache...');
  try {
    execSync(`npx ts-node src/analyze-project.ts ${projectPath} --clear-cache`, {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe'
    });
    console.log('✓ Cache cleared\n');
  } catch (error) {
    // Ignore
  }

  // 各イテレーション
  for (let i = 1; i <= iterations; i++) {
    console.log(`\n--- Run ${i}/${iterations} ${i === 1 ? '(no cache)' : '(with cache)'} ---\n`);

    const startTime = Date.now();

    try {
      const output = execSync(
        `npx ts-node src/analyze-project.ts ${projectPath} --output json`,
        {
          cwd: path.join(__dirname, '..'),
          encoding: 'utf-8',
          stdio: 'pipe',
          maxBuffer: 10 * 1024 * 1024
        }
      );

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      // キャッシュ統計を抽出
      const cacheHitsMatch = output.match(/Cache hits: (\d+)/);
      const cacheMissesMatch = output.match(/Cache misses: (\d+)/);
      const hitRateMatch = output.match(/Cache hit rate: ([\d.]+)%/);

      const result: BenchmarkResult = {
        run: i,
        duration: parseFloat(duration.toFixed(2))
      };

      if (cacheHitsMatch) result.cacheHits = parseInt(cacheHitsMatch[1]);
      if (cacheMissesMatch) result.cacheMisses = parseInt(cacheMissesMatch[1]);
      if (hitRateMatch) result.hitRate = parseFloat(hitRateMatch[1]);

      results.push(result);

      console.log(`✓ Completed in ${duration.toFixed(2)}s`);
      if (result.cacheHits !== undefined) {
        console.log(`  Cache hits: ${result.cacheHits}`);
        console.log(`  Cache misses: ${result.cacheMisses}`);
        if (result.hitRate !== undefined) {
          console.log(`  Hit rate: ${result.hitRate}%`);
        }
      }
    } catch (error: any) {
      console.error(`✗ Failed: ${error.message}`);
      const endTime = Date.now();
      results.push({
        run: i,
        duration: (endTime - startTime) / 1000
      });
    }
  }

  // 結果サマリ
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Benchmark Results\n');

  console.log('| Run | Duration (s) | Cache Hits | Cache Misses | Hit Rate |');
  console.log('|-----|--------------|------------|--------------|----------|');
  results.forEach(r => {
    const hits = r.cacheHits !== undefined ? r.cacheHits : '-';
    const misses = r.cacheMisses !== undefined ? r.cacheMisses : '-';
    const rate = r.hitRate !== undefined ? `${r.hitRate}%` : '-';
    console.log(`| ${r.run}   | ${r.duration.toFixed(2).padEnd(12)} | ${String(hits).padEnd(10)} | ${String(misses).padEnd(12)} | ${rate.padEnd(8)} |`);
  });

  if (results.length >= 2) {
    const firstRun = results[0].duration;
    const avgCachedRuns = results.slice(1).reduce((sum, r) => sum + r.duration, 0) / (results.length - 1);
    const speedup = firstRun / avgCachedRuns;

    console.log('\n📈 Performance Summary\n');
    console.log(`First run (no cache):     ${firstRun.toFixed(2)}s`);
    console.log(`Avg cached runs:          ${avgCachedRuns.toFixed(2)}s`);
    console.log(`Speedup:                  ${speedup.toFixed(2)}x`);
    console.log(`Time saved:               ${(firstRun - avgCachedRuns).toFixed(2)}s (${((1 - avgCachedRuns / firstRun) * 100).toFixed(1)}%)`);
  }

  console.log('');
}

// Main
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help')) {
  console.log(`
Usage: npx ts-node scripts/benchmark.ts <project-dir> [iterations]

Arguments:
  project-dir    Path to the Angular project to benchmark
  iterations     Number of iterations (default: 3)

Examples:
  npx ts-node scripts/benchmark.ts ./src
  npx ts-node scripts/benchmark.ts ./my-angular-project 5
`);
  process.exit(0);
}

const projectPath = args[0];
const iterations = args[1] ? parseInt(args[1]) : 3;

if (!fs.existsSync(projectPath)) {
  console.error(`Error: Project directory "${projectPath}" does not exist`);
  process.exit(1);
}

runBenchmark(projectPath, iterations);
