#!/usr/bin/env ts-node

/**
 * detect-unused-code.ts
 * 未使用のコンポーネント、サービス、パイプ、ディレクティブを検出
 *
 * Usage: npx ts-node src/detect-unused-code.ts <project-dir>
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@typescript-eslint/typescript-estree';
import { parse as parseHtml } from 'node-html-parser';

// ==================== Interfaces ====================

interface UnusedCode {
  components: UnusedItem[];
  services: UnusedItem[];
  pipes: UnusedItem[];
  directives: UnusedItem[];
  modules: UnusedItem[];
  summary: {
    totalUnused: number;
    componentCount: number;
    serviceCount: number;
    pipeCount: number;
    directiveCount: number;
    moduleCount: number;
  };
}

interface UnusedItem {
  name: string;
  path: string;
  type: 'component' | 'service' | 'pipe' | 'directive' | 'module';
  reason: string;
}

interface CodeItem {
  name: string;
  path: string;
  type: 'component' | 'service' | 'pipe' | 'directive' | 'module';
  selector?: string;
}

// ==================== Unused Code Detector ====================

class UnusedCodeDetector {
  private projectPath: string;
  private allComponents: CodeItem[] = [];
  private allServices: CodeItem[] = [];
  private allPipes: CodeItem[] = [];
  private allDirectives: CodeItem[] = [];
  private allModules: CodeItem[] = [];

  private usedComponents = new Set<string>();
  private usedServices = new Set<string>();
  private usedPipes = new Set<string>();
  private usedDirectives = new Set<string>();
  private usedModules = new Set<string>();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  detect(): UnusedCode {
    console.log(`Detecting unused code in: ${this.projectPath}\n`);

    // ステップ1: すべてのコード要素を収集
    this.collectAllCodeItems();

    console.log(`Found:`);
    console.log(`  - ${this.allComponents.length} components`);
    console.log(`  - ${this.allServices.length} services`);
    console.log(`  - ${this.allPipes.length} pipes`);
    console.log(`  - ${this.allDirectives.length} directives`);
    console.log(`  - ${this.allModules.length} modules\n`);

    // ステップ2: 使用箇所を検出
    console.log('Analyzing usage...\n');
    this.analyzeUsage();

    // ステップ3: 未使用を判定
    const unused = this.identifyUnused();

    return unused;
  }

  private collectAllCodeItems(): void {
    const files = this.getAllTypeScriptFiles(this.projectPath);

    for (const file of files) {
      const item = this.analyzeFile(file);
      if (item) {
        switch (item.type) {
          case 'component':
            this.allComponents.push(item);
            break;
          case 'service':
            this.allServices.push(item);
            break;
          case 'pipe':
            this.allPipes.push(item);
            break;
          case 'directive':
            this.allDirectives.push(item);
            break;
          case 'module':
            this.allModules.push(item);
            break;
        }
      }
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

  private analyzeFile(filePath: string): CodeItem | null {
    const content = fs.readFileSync(filePath, 'utf-8');

    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        comment: false
      });

      let className: string | null = null;
      let itemType: CodeItem['type'] | null = null;
      let selector: string | undefined;

      const traverse = (node: any): void => {
        if (!node) return;

        if (node.type === 'ClassDeclaration' && node.id) {
          className = node.id.name;

          if (node.decorators && Array.isArray(node.decorators)) {
            for (const decorator of node.decorators) {
              const decoratorName = decorator.expression?.callee?.name || decorator.expression?.name;

              switch (decoratorName) {
                case 'Component':
                  itemType = 'component';
                  selector = this.extractSelector(decorator);
                  break;
                case 'Injectable':
                  itemType = 'service';
                  break;
                case 'Pipe':
                  itemType = 'pipe';
                  selector = this.extractPipeName(decorator);
                  break;
                case 'Directive':
                  itemType = 'directive';
                  selector = this.extractSelector(decorator);
                  break;
                case 'NgModule':
                  itemType = 'module';
                  break;
              }
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

      if (className && itemType) {
        return {
          name: className,
          path: path.relative(this.projectPath, filePath),
          type: itemType,
          selector
        };
      }
    } catch (error) {
      // Ignore parse errors
    }

    return null;
  }

  private extractSelector(decorator: any): string | undefined {
    if (decorator.expression?.arguments?.[0]?.properties) {
      for (const prop of decorator.expression.arguments[0].properties) {
        if (prop.key?.name === 'selector' && prop.value?.value) {
          return prop.value.value;
        }
      }
    }
    return undefined;
  }

  private extractPipeName(decorator: any): string | undefined {
    if (decorator.expression?.arguments?.[0]?.properties) {
      for (const prop of decorator.expression.arguments[0].properties) {
        if (prop.key?.name === 'name' && prop.value?.value) {
          return prop.value.value;
        }
      }
    }
    return undefined;
  }

  private analyzeUsage(): void {
    const files = this.getAllTypeScriptFiles(this.projectPath);

    // TypeScriptファイルからの使用を検出
    for (const file of files) {
      this.analyzeTypeScriptUsage(file);
    }

    // HTMLテンプレートからの使用を検出
    const htmlFiles = this.getAllHtmlFiles(this.projectPath);
    for (const file of htmlFiles) {
      this.analyzeTemplateUsage(file);
    }

    // モジュールは常にAppModuleを使用済みとマーク
    const appModule = this.allModules.find(m => m.name.toLowerCase().includes('appmodule'));
    if (appModule) {
      this.usedModules.add(appModule.name);
    }
  }

  private getAllHtmlFiles(dir: string): string[] {
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
          } else if (stat.isFile() && item.endsWith('.html')) {
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

  private analyzeTypeScriptUsage(filePath: string): void {
    const content = fs.readFileSync(filePath, 'utf-8');

    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        comment: false
      });

      const traverse = (node: any): void => {
        if (!node) return;

        // インポートから使用を検出
        if (node.type === 'ImportDeclaration') {
          if (node.specifiers) {
            node.specifiers.forEach((spec: any) => {
              if (spec.local) {
                const importedName = spec.local.name;

                // コンポーネント/サービス/パイプ/ディレクティブ/モジュールの使用を検出
                if (this.allComponents.some(c => c.name === importedName)) {
                  this.usedComponents.add(importedName);
                }
                if (this.allServices.some(s => s.name === importedName)) {
                  this.usedServices.add(importedName);
                }
                if (this.allPipes.some(p => p.name === importedName)) {
                  this.usedPipes.add(importedName);
                }
                if (this.allDirectives.some(d => d.name === importedName)) {
                  this.usedDirectives.add(importedName);
                }
                if (this.allModules.some(m => m.name === importedName)) {
                  this.usedModules.add(importedName);
                }
              }
            });
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

  private analyzeTemplateUsage(filePath: string): void {
    const content = fs.readFileSync(filePath, 'utf-8');

    try {
      const root = parseHtml(content);

      // セレクタからコンポーネント/ディレクティブの使用を検出
      const traverse = (node: any): void => {
        if (node.nodeType === 1) {
          const tagName = node.rawTagName?.toLowerCase();

          // コンポーネントセレクタとマッチング
          this.allComponents.forEach(comp => {
            if (comp.selector && tagName === comp.selector.toLowerCase()) {
              this.usedComponents.add(comp.name);
            }
          });

          // ディレクティブセレクタとマッチング
          this.allDirectives.forEach(dir => {
            if (dir.selector && content.includes(dir.selector)) {
              this.usedDirectives.add(dir.name);
            }
          });

          // 属性をチェック
          if (node.attributes) {
            const attrText = JSON.stringify(node.attributes);
            this.allDirectives.forEach(dir => {
              if (dir.selector && attrText.includes(dir.selector)) {
                this.usedDirectives.add(dir.name);
              }
            });
          }
        }

        if (node.childNodes) {
          node.childNodes.forEach((child: any) => traverse(child));
        }
      };

      traverse(root);

      // パイプの使用を検出
      this.allPipes.forEach(pipe => {
        if (pipe.selector) {
          const pipeRegex = new RegExp(`\\|\\s*${pipe.selector}\\b`);
          if (pipeRegex.test(content)) {
            this.usedPipes.add(pipe.name);
          }
        }
      });
    } catch (error) {
      // Ignore parse errors
    }
  }

  private identifyUnused(): UnusedCode {
    const unusedComponents = this.allComponents
      .filter(c => !this.usedComponents.has(c.name))
      .map(c => ({
        ...c,
        reason: 'Not imported or used in any template'
      }));

    const unusedServices = this.allServices
      .filter(s => !this.usedServices.has(s.name))
      .map(s => ({
        ...s,
        reason: 'Not injected in any component or service'
      }));

    const unusedPipes = this.allPipes
      .filter(p => !this.usedPipes.has(p.name))
      .map(p => ({
        ...p,
        reason: 'Not used in any template'
      }));

    const unusedDirectives = this.allDirectives
      .filter(d => !this.usedDirectives.has(d.name))
      .map(d => ({
        ...d,
        reason: 'Not used in any template'
      }));

    const unusedModules = this.allModules
      .filter(m => !this.usedModules.has(m.name))
      .map(m => ({
        ...m,
        reason: 'Not imported by any other module'
      }));

    return {
      components: unusedComponents,
      services: unusedServices,
      pipes: unusedPipes,
      directives: unusedDirectives,
      modules: unusedModules,
      summary: {
        totalUnused: unusedComponents.length + unusedServices.length + unusedPipes.length + unusedDirectives.length + unusedModules.length,
        componentCount: unusedComponents.length,
        serviceCount: unusedServices.length,
        pipeCount: unusedPipes.length,
        directiveCount: unusedDirectives.length,
        moduleCount: unusedModules.length
      }
    };
  }
}

// ==================== Output Formatters ====================

function formatMarkdown(unused: UnusedCode): string {
  let md = `# Unused Code Detection Report\n\n`;

  md += `**Analyzed At**: ${new Date().toISOString()}\n\n`;

  md += `## Summary\n\n`;
  md += `- **Total Unused Items**: ${unused.summary.totalUnused}\n`;
  md += `- **Unused Components**: ${unused.summary.componentCount}\n`;
  md += `- **Unused Services**: ${unused.summary.serviceCount}\n`;
  md += `- **Unused Pipes**: ${unused.summary.pipeCount}\n`;
  md += `- **Unused Directives**: ${unused.summary.directiveCount}\n`;
  md += `- **Unused Modules**: ${unused.summary.moduleCount}\n\n`;

  if (unused.summary.totalUnused === 0) {
    md += `✅ **No unused code detected!**\n`;
    return md;
  }

  if (unused.components.length > 0) {
    md += `## Unused Components (${unused.components.length})\n\n`;
    md += `| Name | Path | Reason |\n`;
    md += `|------|------|--------|\n`;
    unused.components.forEach(item => {
      md += `| ${item.name} | ${item.path} | ${item.reason} |\n`;
    });
    md += `\n`;
  }

  if (unused.services.length > 0) {
    md += `## Unused Services (${unused.services.length})\n\n`;
    md += `| Name | Path | Reason |\n`;
    md += `|------|------|--------|\n`;
    unused.services.forEach(item => {
      md += `| ${item.name} | ${item.path} | ${item.reason} |\n`;
    });
    md += `\n`;
  }

  if (unused.pipes.length > 0) {
    md += `## Unused Pipes (${unused.pipes.length})\n\n`;
    md += `| Name | Path | Reason |\n`;
    md += `|------|------|--------|\n`;
    unused.pipes.forEach(item => {
      md += `| ${item.name} | ${item.path} | ${item.reason} |\n`;
    });
    md += `\n`;
  }

  if (unused.directives.length > 0) {
    md += `## Unused Directives (${unused.directives.length})\n\n`;
    md += `| Name | Path | Reason |\n`;
    md += `|------|------|--------|\n`;
    unused.directives.forEach(item => {
      md += `| ${item.name} | ${item.path} | ${item.reason} |\n`;
    });
    md += `\n`;
  }

  if (unused.modules.length > 0) {
    md += `## Unused Modules (${unused.modules.length})\n\n`;
    md += `| Name | Path | Reason |\n`;
    md += `|------|------|--------|\n`;
    unused.modules.forEach(item => {
      md += `| ${item.name} | ${item.path} | ${item.reason} |\n`;
    });
    md += `\n`;
  }

  return md;
}

function formatConsole(unused: UnusedCode): void {
  console.log(`\n📊 Unused Code Detection Report\n`);

  console.log(`Summary:`);
  console.log(`  - Total Unused: ${unused.summary.totalUnused}`);
  console.log(`  - Components: ${unused.summary.componentCount}`);
  console.log(`  - Services: ${unused.summary.serviceCount}`);
  console.log(`  - Pipes: ${unused.summary.pipeCount}`);
  console.log(`  - Directives: ${unused.summary.directiveCount}`);
  console.log(`  - Modules: ${unused.summary.moduleCount}\n`);

  if (unused.summary.totalUnused === 0) {
    console.log('✅ No unused code detected!\n');
    return;
  }

  if (unused.components.length > 0) {
    console.log(`Unused Components (${unused.components.length}):`);
    unused.components.forEach(item => {
      console.log(`  - ${item.name} (${item.path})`);
    });
    console.log('');
  }

  if (unused.services.length > 0) {
    console.log(`Unused Services (${unused.services.length}):`);
    unused.services.forEach(item => {
      console.log(`  - ${item.name} (${item.path})`);
    });
    console.log('');
  }

  if (unused.pipes.length > 0) {
    console.log(`Unused Pipes (${unused.pipes.length}):`);
    unused.pipes.forEach(item => {
      console.log(`  - ${item.name} (${item.path})`);
    });
    console.log('');
  }

  if (unused.directives.length > 0) {
    console.log(`Unused Directives (${unused.directives.length}):`);
    unused.directives.forEach(item => {
      console.log(`  - ${item.name} (${item.path})`);
    });
    console.log('');
  }

  if (unused.modules.length > 0) {
    console.log(`Unused Modules (${unused.modules.length}):`);
    unused.modules.forEach(item => {
      console.log(`  - ${item.name} (${item.path})`);
    });
    console.log('');
  }
}

// ==================== Main ====================

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Usage: npx ts-node src/detect-unused-code.ts <project-dir> [options]

Options:
  --save <path>      Save output to file
  --help             Show this help message

Examples:
  npx ts-node src/detect-unused-code.ts ./src
  npx ts-node src/detect-unused-code.ts ./src --save unused-code.md
`);
    process.exit(0);
  }

  const projectPath = args[0];
  const savePath = args.includes('--save') ? args[args.indexOf('--save') + 1] : null;

  if (!fs.existsSync(projectPath)) {
    console.error(`Error: Project directory "${projectPath}" does not exist`);
    process.exit(1);
  }

  const detector = new UnusedCodeDetector(projectPath);
  const unused = detector.detect();

  formatConsole(unused);

  if (savePath) {
    const markdown = formatMarkdown(unused);
    fs.writeFileSync(savePath, markdown);
    console.log(`✓ Saved to ${savePath}\n`);
  }
}

main();
