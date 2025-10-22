#!/usr/bin/env ts-node

/**
 * analyze-project.ts
 * プロジェクト全体を1回のパスで統合解析
 *
 * Usage: npx ts-node src/analyze-project.ts <project-dir> [options]
 * Options:
 *   --output <format>  Output format: json, md, html (default: json)
 *   --cache           Use cache for incremental analysis
 *   --no-cache        Disable cache (default: cache enabled)
 *   --clear-cache     Clear cache and exit
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse as parseTs } from '@typescript-eslint/typescript-estree';
import { CacheManager } from './utils/cache-manager';

// ==================== Interfaces ====================

interface ProjectAnalysis {
  summary: ProjectSummary;
  files: FileAnalysis[];
  modules: ModuleAnalysis[];
  components: ComponentAnalysis[];
  services: ServiceAnalysis[];
  dependencies: DependencyGraph;
  warnings: Warning[];
  metrics: CodeMetrics;
  analyzedAt: string;
}

interface ProjectSummary {
  projectPath: string;
  totalFiles: number;
  totalLines: number;
  fileTypes: {
    typescript: number;
    html: number;
    css: number;
  };
}

interface FileAnalysis {
  path: string;
  relativePath: string;
  type: FileType;
  role: string;
  confidence: 'high' | 'medium' | 'low';
  imports: ImportInfo[];
  exports: ExportInfo[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
  decorators: string[];
  linesOfCode: number;
}

type FileType = 'component' | 'service' | 'module' | 'pipe' | 'directive' | 'guard' | 'interceptor' | 'interface' | 'enum' | 'other';

interface ImportInfo {
  source: string;
  importType: 'named' | 'default' | 'namespace' | 'side-effect';
  imports: string[];
  line: number;
  category: 'angular' | 'third-party' | 'relative';
}

interface ExportInfo {
  name: string;
  type: 'class' | 'function' | 'variable' | 'interface' | 'type' | 'enum';
}

interface FunctionInfo {
  name: string;
  type: 'function' | 'method' | 'arrow' | 'constructor';
  parameters: number;
  line: number;
  isAsync: boolean;
}

interface ClassInfo {
  name: string;
  implements: string[];
  extends?: string;
}

interface ModuleAnalysis {
  name: string;
  path: string;
  imports: string[];
  exports: string[];
  declarations: string[];
  providers: string[];
}

interface ComponentAnalysis {
  name: string;
  path: string;
  selector?: string;
  templateUrl?: string;
  styleUrls: string[];
  standalone: boolean;
  imports: string[];
}

interface ServiceAnalysis {
  name: string;
  path: string;
  providedIn?: string;
}

interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

interface DependencyNode {
  id: string;
  label: string;
  type: FileType;
}

interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'external';
}

interface Warning {
  type: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
}

interface CodeMetrics {
  totalFunctions: number;
  totalClasses: number;
  averageFunctionsPerFile: number;
  averageLinesPerFile: number;
  largestFiles: { path: string; lines: number }[];
}

// ==================== Main Analysis Logic ====================

class ProjectAnalyzer {
  private projectPath: string;
  private baseDir: string;
  private files: FileAnalysis[] = [];
  private modules: ModuleAnalysis[] = [];
  private components: ComponentAnalysis[] = [];
  private services: ServiceAnalysis[] = [];
  private warnings: Warning[] = [];
  private cacheManager: CacheManager | null = null;
  private useCache: boolean = true;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  constructor(projectPath: string, useCache: boolean = true) {
    this.projectPath = projectPath;
    this.baseDir = projectPath;
    this.useCache = useCache;

    if (this.useCache) {
      this.cacheManager = new CacheManager(projectPath);
    }
  }

  async analyze(): Promise<ProjectAnalysis> {
    console.log(`Analyzing project: ${this.projectPath}\n`);

    // キャッシュをロード
    if (this.useCache && this.cacheManager) {
      const loaded = this.cacheManager.load();
      if (loaded) {
        console.log('✓ Cache loaded\n');
      }
    }

    // ファイル収集
    const tsFiles = this.getAllTypeScriptFiles(this.projectPath);
    console.log(`Found ${tsFiles.length} TypeScript files`);

    // 各ファイルを解析
    let processed = 0;
    for (const file of tsFiles) {
      try {
        let analysis: FileAnalysis;

        // キャッシュから取得を試みる
        if (this.useCache && this.cacheManager) {
          const cached = this.cacheManager.getCachedAnalysis(file);
          if (cached) {
            analysis = cached;
            this.cacheHits++;
          } else {
            analysis = this.analyzeTypeScriptFile(file);
            this.cacheManager.addToCache(file, analysis);
            this.cacheMisses++;
          }
        } else {
          analysis = this.analyzeTypeScriptFile(file);
        }

        this.files.push(analysis);

        // 種別ごとに分類
        if (analysis.role === 'Module') {
          this.extractModuleInfo(file, analysis);
        } else if (analysis.role === 'Angular Component') {
          this.extractComponentInfo(file, analysis);
        } else if (analysis.role.includes('Service') || analysis.role === 'Injectable Service') {
          this.extractServiceInfo(file, analysis);
        }

        processed++;
        if (processed % 10 === 0) {
          console.log(`Processed ${processed}/${tsFiles.length} files...`);
        }
      } catch (error) {
        this.warnings.push({
          type: 'error',
          message: `Failed to analyze ${file}: ${error}`,
          file
        });
      }
    }

    console.log(`✓ Analyzed ${this.files.length} files`);

    // キャッシュ統計を表示
    if (this.useCache && this.cacheManager) {
      console.log(`  Cache hits: ${this.cacheHits}, Cache misses: ${this.cacheMisses}`);
      if (this.cacheHits > 0) {
        const hitRate = ((this.cacheHits / tsFiles.length) * 100).toFixed(1);
        console.log(`  Cache hit rate: ${hitRate}%`);
      }
    }
    console.log('');

    // 依存関係グラフ構築
    const dependencies = this.buildDependencyGraph();

    // メトリクス計算
    const metrics = this.calculateMetrics();

    // サマリ作成
    const summary = this.createSummary();

    // キャッシュを保存
    if (this.useCache && this.cacheManager) {
      this.files.forEach(file => {
        const fullPath = path.resolve(this.baseDir, file.path);
        const cached = this.cacheManager!.getCachedAnalysis(fullPath);
        if (cached || this.cacheMisses > 0) {
          // 新規解析したファイルのみキャッシュに追加
          this.cacheManager!.addToCache(fullPath, file);
        }
      });
      this.cacheManager.save(this.projectPath, this.cacheManager['cache']?.files || new Map());
    }

    return {
      summary,
      files: this.files,
      modules: this.modules,
      components: this.components,
      services: this.services,
      dependencies,
      warnings: this.warnings,
      metrics,
      analyzedAt: new Date().toISOString()
    };
  }

  private getAllTypeScriptFiles(dir: string): string[] {
    const files: string[] = [];

    const traverse = (currentPath: string): void => {
      try {
        const items = fs.readdirSync(currentPath);

        for (const item of items) {
          const fullPath = path.join(currentPath, item);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            if (!item.startsWith('.') && item !== 'node_modules' && item !== 'dist' && item !== 'coverage') {
              traverse(fullPath);
            }
          } else if (stat.isFile() && item.endsWith('.ts') && !item.endsWith('.spec.ts')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${currentPath}:`, error);
      }
    };

    traverse(dir);
    return files;
  }

  private analyzeTypeScriptFile(filePath: string): FileAnalysis {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;

    const analysis: FileAnalysis = {
      path: filePath,
      relativePath: path.relative(this.baseDir, filePath),
      type: 'other',
      role: 'Unknown',
      confidence: 'low',
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      decorators: [],
      linesOfCode: lines
    };

    try {
      const ast = parseTs(content, {
        loc: true,
        range: true,
        comment: false
      });

      this.extractFromAST(ast, analysis);
      this.determineRole(analysis, filePath);
    } catch (error) {
      this.warnings.push({
        type: 'warning',
        message: `Parse error in ${filePath}: ${error}`,
        file: filePath
      });
    }

    return analysis;
  }

  private extractFromAST(ast: any, analysis: FileAnalysis): void {
    const traverse = (node: any): void => {
      if (!node) return;

      // Decorators
      if (node.decorators && Array.isArray(node.decorators)) {
        node.decorators.forEach((dec: any) => {
          let decoratorName = '';
          if (dec.expression?.callee?.name) {
            decoratorName = dec.expression.callee.name;
          } else if (dec.expression?.name) {
            decoratorName = dec.expression.name;
          }
          if (decoratorName && !analysis.decorators.includes(decoratorName)) {
            analysis.decorators.push(decoratorName);
          }
        });
      }

      // Imports
      if (node.type === 'ImportDeclaration') {
        const source = node.source.value;
        const importedItems: string[] = [];
        let importType: ImportInfo['importType'] = 'side-effect';
        let category: ImportInfo['category'] = 'relative';

        if (source.startsWith('@angular/')) {
          category = 'angular';
        } else if (!source.startsWith('.') && !source.startsWith('/')) {
          category = 'third-party';
        }

        if (node.specifiers && node.specifiers.length > 0) {
          node.specifiers.forEach((spec: any) => {
            if (spec.type === 'ImportDefaultSpecifier') {
              importType = 'default';
              importedItems.push(spec.local.name);
            } else if (spec.type === 'ImportNamespaceSpecifier') {
              importType = 'namespace';
              importedItems.push(`* as ${spec.local.name}`);
            } else if (spec.type === 'ImportSpecifier') {
              importType = 'named';
              importedItems.push(spec.local.name);
            }
          });
        }

        analysis.imports.push({
          source,
          importType,
          imports: importedItems,
          line: node.loc.start.line,
          category
        });
      }

      // Exports
      if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
        if (node.declaration) {
          const decl = node.declaration;
          if (decl.type === 'ClassDeclaration' && decl.id) {
            analysis.exports.push({ name: decl.id.name, type: 'class' });
          } else if (decl.type === 'FunctionDeclaration' && decl.id) {
            analysis.exports.push({ name: decl.id.name, type: 'function' });
          } else if (decl.type === 'TSInterfaceDeclaration' && decl.id) {
            analysis.exports.push({ name: decl.id.name, type: 'interface' });
          } else if (decl.type === 'TSTypeAliasDeclaration' && decl.id) {
            analysis.exports.push({ name: decl.id.name, type: 'type' });
          } else if (decl.type === 'TSEnumDeclaration' && decl.id) {
            analysis.exports.push({ name: decl.id.name, type: 'enum' });
          }
        }
      }

      // Classes
      if (node.type === 'ClassDeclaration' && node.id) {
        const implementsList: string[] = [];
        if (node.implements && Array.isArray(node.implements)) {
          node.implements.forEach((impl: any) => {
            if (impl.expression?.name) {
              implementsList.push(impl.expression.name);
            }
          });
        }

        analysis.classes.push({
          name: node.id.name,
          implements: implementsList,
          extends: node.superClass?.name
        });
      }

      // Functions
      if (node.type === 'FunctionDeclaration' && node.id) {
        analysis.functions.push({
          name: node.id.name,
          type: 'function',
          parameters: node.params.length,
          line: node.loc.start.line,
          isAsync: node.async || false
        });
      }

      if (node.type === 'MethodDefinition' && node.key) {
        analysis.functions.push({
          name: node.key.name || 'unknown',
          type: node.kind === 'constructor' ? 'constructor' : 'method',
          parameters: node.value.params.length,
          line: node.loc.start.line,
          isAsync: node.value.async || false
        });
      }

      // Traverse children
      for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
          if (Array.isArray(node[key])) {
            node[key].forEach((child: any) => traverse(child));
          } else {
            traverse(node[key]);
          }
        }
      }
    };

    traverse(ast);
  }

  private determineRole(analysis: FileAnalysis, filePath: string): void {
    const fileName = filePath.toLowerCase();

    if (analysis.decorators.includes('Component')) {
      analysis.role = 'Angular Component';
      analysis.type = 'component';
      analysis.confidence = 'high';
    } else if (analysis.decorators.includes('Injectable')) {
      if (fileName.includes('.service.')) {
        analysis.role = 'Angular Service';
        analysis.type = 'service';
        analysis.confidence = 'high';
      } else if (fileName.includes('.guard.')) {
        analysis.role = 'Angular Guard';
        analysis.type = 'guard';
        analysis.confidence = 'high';
      } else if (fileName.includes('.interceptor.')) {
        analysis.role = 'HTTP Interceptor';
        analysis.type = 'interceptor';
        analysis.confidence = 'high';
      } else {
        analysis.role = 'Injectable Service';
        analysis.type = 'service';
        analysis.confidence = 'medium';
      }
    } else if (analysis.decorators.includes('NgModule')) {
      analysis.role = 'Module';
      analysis.type = 'module';
      analysis.confidence = 'high';
    } else if (analysis.decorators.includes('Pipe')) {
      analysis.role = 'Angular Pipe';
      analysis.type = 'pipe';
      analysis.confidence = 'high';
    } else if (analysis.decorators.includes('Directive')) {
      analysis.role = 'Angular Directive';
      analysis.type = 'directive';
      analysis.confidence = 'high';
    } else if (fileName.includes('.interface.') || analysis.exports.some(e => e.type === 'interface')) {
      analysis.role = 'Interface Definition';
      analysis.type = 'interface';
      analysis.confidence = 'medium';
    } else if (fileName.includes('.enum.') || analysis.exports.some(e => e.type === 'enum')) {
      analysis.role = 'Enum Definition';
      analysis.type = 'enum';
      analysis.confidence = 'medium';
    } else {
      analysis.role = 'Utility/Helper';
      analysis.type = 'other';
      analysis.confidence = 'low';
    }
  }

  private extractModuleInfo(filePath: string, analysis: FileAnalysis): void {
    // NgModuleデコレータからメタデータを抽出（簡易版）
    const module: ModuleAnalysis = {
      name: analysis.classes[0]?.name || 'Unknown',
      path: path.relative(this.baseDir, filePath),
      imports: [],
      exports: [],
      declarations: [],
      providers: []
    };

    this.modules.push(module);
  }

  private extractComponentInfo(filePath: string, analysis: FileAnalysis): void {
    const component: ComponentAnalysis = {
      name: analysis.classes[0]?.name || 'Unknown',
      path: path.relative(this.baseDir, filePath),
      standalone: false,
      styleUrls: [],
      imports: analysis.imports.filter(i => i.category === 'angular').map(i => i.source)
    };

    this.components.push(component);
  }

  private extractServiceInfo(filePath: string, analysis: FileAnalysis): void {
    const service: ServiceAnalysis = {
      name: analysis.classes[0]?.name || 'Unknown',
      path: path.relative(this.baseDir, filePath)
    };

    this.services.push(service);
  }

  private buildDependencyGraph(): DependencyGraph {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];
    const nodeMap = new Map<string, DependencyNode>();

    // ノード作成
    this.files.forEach(file => {
      const node: DependencyNode = {
        id: file.relativePath,
        label: path.basename(file.path),
        type: file.type
      };
      nodes.push(node);
      nodeMap.set(file.path, node);
    });

    // エッジ作成
    this.files.forEach(file => {
      file.imports.forEach(imp => {
        if (imp.category === 'relative') {
          const dir = path.dirname(file.path);
          let resolvedPath = path.resolve(dir, imp.source);

          if (!resolvedPath.endsWith('.ts')) {
            if (fs.existsSync(resolvedPath + '.ts')) {
              resolvedPath += '.ts';
            }
          }

          const targetNode = nodeMap.get(resolvedPath);
          if (targetNode) {
            edges.push({
              from: file.relativePath,
              to: targetNode.id,
              type: 'import'
            });
          }
        }
      });
    });

    return { nodes, edges };
  }

  private calculateMetrics(): CodeMetrics {
    const totalFunctions = this.files.reduce((sum, f) => sum + f.functions.length, 0);
    const totalClasses = this.files.reduce((sum, f) => sum + f.classes.length, 0);
    const totalLines = this.files.reduce((sum, f) => sum + f.linesOfCode, 0);

    const largestFiles = [...this.files]
      .sort((a, b) => b.linesOfCode - a.linesOfCode)
      .slice(0, 10)
      .map(f => ({ path: f.relativePath, lines: f.linesOfCode }));

    return {
      totalFunctions,
      totalClasses,
      averageFunctionsPerFile: totalFunctions / this.files.length || 0,
      averageLinesPerFile: totalLines / this.files.length || 0,
      largestFiles
    };
  }

  private createSummary(): ProjectSummary {
    const tsFiles = this.files.length;
    const htmlFiles = 0; // TODO: HTML解析を追加
    const cssFiles = 0; // TODO: CSS解析を追加

    return {
      projectPath: this.projectPath,
      totalFiles: tsFiles,
      totalLines: this.files.reduce((sum, f) => sum + f.linesOfCode, 0),
      fileTypes: {
        typescript: tsFiles,
        html: htmlFiles,
        css: cssFiles
      }
    };
  }
}

// ==================== Output Formatters ====================

function formatJSON(analysis: ProjectAnalysis): string {
  return JSON.stringify(analysis, null, 2);
}

function formatMarkdown(analysis: ProjectAnalysis): string {
  let md = `# Project Analysis Report\n\n`;
  md += `**Analyzed At**: ${analysis.analyzedAt}\n\n`;

  md += `## Summary\n\n`;
  md += `- **Project Path**: ${analysis.summary.projectPath}\n`;
  md += `- **Total Files**: ${analysis.summary.totalFiles}\n`;
  md += `- **Total Lines**: ${analysis.summary.totalLines}\n`;
  md += `- **TypeScript Files**: ${analysis.summary.fileTypes.typescript}\n\n`;

  md += `## Metrics\n\n`;
  md += `- **Total Functions**: ${analysis.metrics.totalFunctions}\n`;
  md += `- **Total Classes**: ${analysis.metrics.totalClasses}\n`;
  md += `- **Average Functions/File**: ${analysis.metrics.averageFunctionsPerFile.toFixed(2)}\n`;
  md += `- **Average Lines/File**: ${analysis.metrics.averageLinesPerFile.toFixed(2)}\n\n`;

  md += `## File Types\n\n`;
  const typeCounts = new Map<FileType, number>();
  analysis.files.forEach(f => {
    typeCounts.set(f.type, (typeCounts.get(f.type) || 0) + 1);
  });

  md += `| Type | Count |\n`;
  md += `|------|-------|\n`;
  typeCounts.forEach((count, type) => {
    md += `| ${type} | ${count} |\n`;
  });
  md += `\n`;

  md += `## Components (${analysis.components.length})\n\n`;
  analysis.components.forEach(c => {
    md += `- **${c.name}** (${c.path})\n`;
  });
  md += `\n`;

  md += `## Services (${analysis.services.length})\n\n`;
  analysis.services.forEach(s => {
    md += `- **${s.name}** (${s.path})\n`;
  });
  md += `\n`;

  md += `## Modules (${analysis.modules.length})\n\n`;
  analysis.modules.forEach(m => {
    md += `- **${m.name}** (${m.path})\n`;
  });
  md += `\n`;

  if (analysis.warnings.length > 0) {
    md += `## Warnings (${analysis.warnings.length})\n\n`;
    analysis.warnings.forEach(w => {
      md += `- [${w.type.toUpperCase()}] ${w.message}\n`;
    });
    md += `\n`;
  }

  md += `## Largest Files\n\n`;
  md += `| File | Lines |\n`;
  md += `|------|-------|\n`;
  analysis.metrics.largestFiles.forEach(f => {
    md += `| ${f.path} | ${f.lines} |\n`;
  });

  return md;
}

// ==================== Main ====================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Usage: npx ts-node src/analyze-project.ts <project-dir> [options]

Options:
  --output <format>  Output format: json, md (default: json)
  --save <path>      Save output to file
  --no-cache         Disable cache (default: cache enabled)
  --clear-cache      Clear cache and exit
  --help             Show this help message

Examples:
  npx ts-node src/analyze-project.ts ./my-project
  npx ts-node src/analyze-project.ts ./my-project --output md
  npx ts-node src/analyze-project.ts ./my-project --output json --save analysis.json
  npx ts-node src/analyze-project.ts ./my-project --no-cache
  npx ts-node src/analyze-project.ts ./my-project --clear-cache
`);
    process.exit(0);
  }

  const projectPath = args[0];

  if (!fs.existsSync(projectPath)) {
    console.error(`Error: Project directory "${projectPath}" does not exist`);
    process.exit(1);
  }

  // --clear-cache オプション
  if (args.includes('--clear-cache')) {
    const cacheManager = new CacheManager(projectPath);
    cacheManager.clear();
    console.log('✓ Cache cleared');
    process.exit(0);
  }

  const outputFormat = args.includes('--output') ? args[args.indexOf('--output') + 1] : 'json';
  const savePath = args.includes('--save') ? args[args.indexOf('--save') + 1] : null;
  const useCache = !args.includes('--no-cache');

  const startTime = Date.now();

  const analyzer = new ProjectAnalyzer(projectPath, useCache);
  const analysis = await analyzer.analyze();

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log(`\n✓ Analysis completed in ${duration}s\n`);

  // Format output
  let output: string;
  if (outputFormat === 'md') {
    output = formatMarkdown(analysis);
  } else {
    output = formatJSON(analysis);
  }

  // Save or print
  if (savePath) {
    fs.writeFileSync(savePath, output);
    console.log(`✓ Saved to ${savePath}`);
  } else {
    console.log(output);
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
