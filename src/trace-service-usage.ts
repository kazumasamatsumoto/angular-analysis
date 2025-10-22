#!/usr/bin/env ts-node

/**
 * trace-service-usage.ts
 * サービスがどこで注入・使用されているか追跡
 *
 * Usage: npx ts-node src/trace-service-usage.ts <service-file> <project-dir>
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@typescript-eslint/typescript-estree';

// ==================== Interfaces ====================

interface ServiceUsage {
  serviceName: string;
  servicePath: string;
  providedIn: string;
  injectedIn: InjectionSite[];
  methods: MethodUsage[];
  totalInjections: number;
}

interface InjectionSite {
  file: string;
  className: string;
  injectionType: 'constructor' | 'inject-function' | 'property';
  line: number;
}

interface MethodUsage {
  method: string;
  usedIn: UsageSite[];
  totalCalls: number;
}

interface UsageSite {
  file: string;
  className: string;
  methodName: string;
  line: number;
}

// ==================== Service Usage Tracer ====================

class ServiceUsageTracer {
  private servicePath: string;
  private projectPath: string;
  private serviceName: string = '';
  private serviceClassName: string = '';
  private injectionSites: InjectionSite[] = [];
  private methodUsages = new Map<string, UsageSite[]>();

  constructor(servicePath: string, projectPath: string) {
    this.servicePath = servicePath;
    this.projectPath = projectPath;
  }

  trace(): ServiceUsage {
    console.log(`Tracing service usage: ${this.servicePath}\n`);

    // サービス自体を解析
    this.analyzeService();

    // プロジェクト内のすべてのTypeScriptファイルを解析
    const files = this.getAllTypeScriptFiles(this.projectPath);
    console.log(`Scanning ${files.length} files for service usage...\n`);

    let processed = 0;
    for (const file of files) {
      if (file !== this.servicePath) {
        this.analyzeFileForUsage(file);
        processed++;
        if (processed % 20 === 0) {
          console.log(`Processed ${processed}/${files.length} files...`);
        }
      }
    }

    // メソッド使用状況の集計
    const methods = this.aggregateMethodUsage();

    return {
      serviceName: this.serviceName,
      servicePath: path.relative(this.projectPath, this.servicePath),
      providedIn: 'root', // 簡易版
      injectedIn: this.injectionSites,
      methods,
      totalInjections: this.injectionSites.length
    };
  }

  private analyzeService(): void {
    const content = fs.readFileSync(this.servicePath, 'utf-8');

    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        comment: false
      });

      const traverse = (node: any): void => {
        if (!node) return;

        // クラス名を取得
        if (node.type === 'ClassDeclaration' && node.id) {
          if (node.decorators?.some((d: any) => d.expression?.callee?.name === 'Injectable')) {
            this.serviceClassName = node.id.name;
            this.serviceName = node.id.name;

            // メソッド一覧を取得
            if (node.body && node.body.body) {
              node.body.body.forEach((member: any) => {
                if (member.type === 'MethodDefinition' && member.key && member.kind !== 'constructor') {
                  const methodName = member.key.name;
                  this.methodUsages.set(methodName, []);
                }
              });
            }
          }
        }

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
    } catch (error) {
      console.error('Error parsing service file:', error);
    }
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
            if (!item.startsWith('.') && item !== 'node_modules' && item !== 'dist') {
              traverse(fullPath);
            }
          } else if (stat.isFile() && item.endsWith('.ts') && !item.endsWith('.spec.ts')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Ignore errors
      }
    };

    traverse(dir);
    return files;
  }

  private analyzeFileForUsage(filePath: string): void {
    const content = fs.readFileSync(filePath, 'utf-8');

    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        comment: false
      });

      let currentClassName = '';
      let currentMethodName = '';
      let hasServiceImport = false;

      // このファイルがサービスをインポートしているかチェック
      const checkImports = (node: any): void => {
        if (node.type === 'ImportDeclaration') {
          if (node.specifiers) {
            node.specifiers.forEach((spec: any) => {
              if (spec.local && spec.local.name === this.serviceClassName) {
                hasServiceImport = true;
              }
            });
          }
        }
      };

      const traverse = (node: any): void => {
        if (!node) return;

        // インポートチェック
        checkImports(node);

        // クラス名を追跡
        if (node.type === 'ClassDeclaration' && node.id) {
          currentClassName = node.id.name;

          // コンストラクタでの注入をチェック
          if (node.body && node.body.body) {
            node.body.body.forEach((member: any) => {
              if (member.type === 'MethodDefinition' && member.kind === 'constructor') {
                if (member.value && member.value.params) {
                  member.value.params.forEach((param: any) => {
                    if (param.parameter?.typeAnnotation?.typeAnnotation?.typeName?.name === this.serviceClassName) {
                      this.injectionSites.push({
                        file: path.relative(this.projectPath, filePath),
                        className: currentClassName,
                        injectionType: 'constructor',
                        line: member.loc.start.line
                      });
                    }
                  });
                }
              }
            });
          }
        }

        // メソッド名を追跡
        if (node.type === 'MethodDefinition' && node.key) {
          currentMethodName = node.key.name || 'unknown';
        }

        // サービスメソッドの呼び出しを検出
        if (hasServiceImport && node.type === 'MemberExpression') {
          if (node.property && node.property.name) {
            const methodName = node.property.name;
            if (this.methodUsages.has(methodName)) {
              const usages = this.methodUsages.get(methodName)!;
              usages.push({
                file: path.relative(this.projectPath, filePath),
                className: currentClassName,
                methodName: currentMethodName,
                line: node.loc.start.line
              });
            }
          }
        }

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
    } catch (error) {
      // Ignore parse errors
    }
  }

  private aggregateMethodUsage(): MethodUsage[] {
    const methods: MethodUsage[] = [];

    this.methodUsages.forEach((usages, methodName) => {
      methods.push({
        method: methodName,
        usedIn: usages,
        totalCalls: usages.length
      });
    });

    return methods.sort((a, b) => b.totalCalls - a.totalCalls);
  }
}

// ==================== Output Formatters ====================

function formatMarkdown(usage: ServiceUsage): string {
  let md = `# Service Usage Analysis: ${usage.serviceName}\n\n`;

  md += `**Service Path**: ${usage.servicePath}\n`;
  md += `**Provided In**: ${usage.providedIn}\n\n`;

  md += `## Summary\n\n`;
  md += `- **Total Injections**: ${usage.totalInjections}\n`;
  md += `- **Methods Tracked**: ${usage.methods.length}\n`;
  md += `- **Total Method Calls**: ${usage.methods.reduce((sum, m) => sum + m.totalCalls, 0)}\n\n`;

  if (usage.injectedIn.length > 0) {
    md += `## Injection Sites (${usage.injectedIn.length})\n\n`;
    md += `| File | Class | Type | Line |\n`;
    md += `|------|-------|------|------|\n`;
    usage.injectedIn.forEach(site => {
      md += `| ${site.file} | ${site.className} | ${site.injectionType} | ${site.line} |\n`;
    });
    md += `\n`;
  }

  if (usage.methods.length > 0) {
    md += `## Method Usage\n\n`;

    usage.methods.forEach(method => {
      md += `### ${method.method}() - ${method.totalCalls} call${method.totalCalls !== 1 ? 's' : ''}\n\n`;

      if (method.usedIn.length > 0) {
        md += `| File | Class | Method | Line |\n`;
        md += `|------|-------|--------|------|\n`;
        method.usedIn.forEach(site => {
          md += `| ${site.file} | ${site.className} | ${site.methodName} | ${site.line} |\n`;
        });
        md += `\n`;
      } else {
        md += `*Not used in project*\n\n`;
      }
    });
  }

  return md;
}

function formatConsole(usage: ServiceUsage): void {
  console.log(`\n📊 Service Usage Analysis: ${usage.serviceName}\n`);
  console.log(`Service Path: ${usage.servicePath}`);
  console.log(`Provided In: ${usage.providedIn}\n`);

  console.log(`Summary:`);
  console.log(`  - Total Injections: ${usage.totalInjections}`);
  console.log(`  - Methods Tracked: ${usage.methods.length}`);
  console.log(`  - Total Method Calls: ${usage.methods.reduce((sum, m) => sum + m.totalCalls, 0)}\n`);

  if (usage.injectedIn.length > 0) {
    console.log(`Injected in ${usage.injectedIn.length} location${usage.injectedIn.length !== 1 ? 's' : ''}:`);
    usage.injectedIn.slice(0, 10).forEach(site => {
      console.log(`  - ${site.className} (${site.file}:${site.line})`);
    });
    if (usage.injectedIn.length > 10) {
      console.log(`  ... and ${usage.injectedIn.length - 10} more\n`);
    } else {
      console.log('');
    }
  }

  if (usage.methods.length > 0) {
    console.log(`Method Usage:`);
    usage.methods.forEach(method => {
      console.log(`  - ${method.method}(): ${method.totalCalls} call${method.totalCalls !== 1 ? 's' : ''}`);
    });
    console.log('');
  }
}

// ==================== Main ====================

function main(): void {
  const args = process.argv.slice(2);

  if (args.length < 2 || args.includes('--help')) {
    console.log(`
Usage: npx ts-node src/trace-service-usage.ts <service-file> <project-dir> [options]

Arguments:
  service-file       Path to the service file to trace
  project-dir        Root directory of the Angular project

Options:
  --save <path>      Save output to file
  --help             Show this help message

Examples:
  npx ts-node src/trace-service-usage.ts ./src/app/services/user.service.ts ./src
  npx ts-node src/trace-service-usage.ts ./src/app/services/user.service.ts ./src --save usage.md
`);
    process.exit(0);
  }

  const serviceFile = args[0];
  const projectDir = args[1];
  const savePath = args.includes('--save') ? args[args.indexOf('--save') + 1] : null;

  if (!fs.existsSync(serviceFile)) {
    console.error(`Error: Service file "${serviceFile}" does not exist`);
    process.exit(1);
  }

  if (!fs.existsSync(projectDir)) {
    console.error(`Error: Project directory "${projectDir}" does not exist`);
    process.exit(1);
  }

  const tracer = new ServiceUsageTracer(serviceFile, projectDir);
  const usage = tracer.trace();

  formatConsole(usage);

  if (savePath) {
    const markdown = formatMarkdown(usage);
    fs.writeFileSync(savePath, markdown);
    console.log(`✓ Saved to ${savePath}`);
  }
}

main();
