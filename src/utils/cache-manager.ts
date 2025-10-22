/**
 * cache-manager.ts
 * ファイル解析結果のキャッシュを管理
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ==================== Interfaces ====================

export interface AnalysisCache {
  version: string;
  projectPath: string;
  createdAt: string;
  lastModified: string;
  files: Map<string, CachedFileAnalysis>;
}

export interface CachedFileAnalysis {
  path: string;
  hash: string;
  lastModified: number;
  analysis: any; // FileAnalysis型だが、循環参照を避けるためany
}

// ==================== Cache Manager ====================

export class CacheManager {
  private cachePath: string;
  private cache: AnalysisCache | null = null;
  private version = '1.0.0';

  constructor(projectPath: string) {
    // .cache ディレクトリを作成
    const cacheDir = path.join(projectPath, '.cache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    this.cachePath = path.join(cacheDir, 'analysis-cache.json');
  }

  /**
   * キャッシュを読み込む
   */
  load(): boolean {
    try {
      if (!fs.existsSync(this.cachePath)) {
        return false;
      }

      const data = fs.readFileSync(this.cachePath, 'utf-8');
      const parsed = JSON.parse(data);

      // バージョンチェック
      if (parsed.version !== this.version) {
        console.log('Cache version mismatch, invalidating cache...');
        return false;
      }

      // Map型に変換
      this.cache = {
        ...parsed,
        files: new Map(Object.entries(parsed.files))
      };

      return true;
    } catch (error) {
      console.warn('Failed to load cache:', error);
      return false;
    }
  }

  /**
   * キャッシュを保存
   */
  save(projectPath: string, files: Map<string, CachedFileAnalysis>): void {
    try {
      const cache: AnalysisCache = {
        version: this.version,
        projectPath,
        createdAt: this.cache?.createdAt || new Date().toISOString(),
        lastModified: new Date().toISOString(),
        files
      };

      // Map型をオブジェクトに変換
      const serializable = {
        ...cache,
        files: Object.fromEntries(cache.files)
      };

      fs.writeFileSync(this.cachePath, JSON.stringify(serializable, null, 2));
      this.cache = cache;
    } catch (error) {
      console.warn('Failed to save cache:', error);
    }
  }

  /**
   * ファイルのハッシュ値を計算
   */
  calculateFileHash(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return crypto.createHash('md5').update(content).digest('hex');
    } catch (error) {
      return '';
    }
  }

  /**
   * ファイルが変更されたかチェック
   */
  hasFileChanged(filePath: string): boolean {
    if (!this.cache) {
      return true;
    }

    const cached = this.cache.files.get(filePath);
    if (!cached) {
      return true;
    }

    try {
      const stat = fs.statSync(filePath);
      const currentHash = this.calculateFileHash(filePath);

      // タイムスタンプとハッシュ値で判定
      return stat.mtimeMs > cached.lastModified || currentHash !== cached.hash;
    } catch (error) {
      return true;
    }
  }

  /**
   * キャッシュからファイル解析結果を取得
   */
  getCachedAnalysis(filePath: string): any | null {
    if (!this.cache) {
      return null;
    }

    const cached = this.cache.files.get(filePath);
    if (!cached) {
      return null;
    }

    if (this.hasFileChanged(filePath)) {
      return null;
    }

    return cached.analysis;
  }

  /**
   * 解析結果をキャッシュに追加
   */
  addToCache(filePath: string, analysis: any): void {
    if (!this.cache) {
      this.cache = {
        version: this.version,
        projectPath: '',
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        files: new Map()
      };
    }

    try {
      const stat = fs.statSync(filePath);
      const hash = this.calculateFileHash(filePath);

      this.cache.files.set(filePath, {
        path: filePath,
        hash,
        lastModified: stat.mtimeMs,
        analysis
      });
    } catch (error) {
      console.warn(`Failed to cache ${filePath}:`, error);
    }
  }

  /**
   * キャッシュをクリア
   */
  clear(): void {
    try {
      if (fs.existsSync(this.cachePath)) {
        fs.unlinkSync(this.cachePath);
      }
      this.cache = null;
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  /**
   * キャッシュ統計を取得
   */
  getStats(): { totalFiles: number; cacheHits: number; cacheMisses: number; cacheAge: string } {
    if (!this.cache) {
      return {
        totalFiles: 0,
        cacheHits: 0,
        cacheMisses: 0,
        cacheAge: 'N/A'
      };
    }

    const now = new Date();
    const created = new Date(this.cache.createdAt);
    const ageMs = now.getTime() - created.getTime();
    const ageMinutes = Math.floor(ageMs / 1000 / 60);

    let cacheAge = '';
    if (ageMinutes < 60) {
      cacheAge = `${ageMinutes} minute${ageMinutes !== 1 ? 's' : ''}`;
    } else {
      const ageHours = Math.floor(ageMinutes / 60);
      cacheAge = `${ageHours} hour${ageHours !== 1 ? 's' : ''}`;
    }

    return {
      totalFiles: this.cache.files.size,
      cacheHits: 0, // この値は外部で管理
      cacheMisses: 0, // この値は外部で管理
      cacheAge
    };
  }
}
