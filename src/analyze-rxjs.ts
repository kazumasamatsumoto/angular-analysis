#!/usr/bin/env ts-node

/**
 * analyze-rxjs.ts
 * RxJS使用状況とSubscription漏れを検出
 *
 * Usage: npx ts-node src/analyze-rxjs.ts <project-dir>
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@typescript-eslint/typescript-estree';

// ==================== Interfaces ====================

interface RxJSAnalysis {
  observables: ObservableInfo[];
  subjects: SubjectInfo[];
  operators: OperatorUsage[];
  subscriptions: SubscriptionInfo[];
  potentialLeaks: SubscriptionLeak[];
  summary: {
    totalObservables: number;
    totalSubjects: number;
    totalSubscriptions: number;
    potentialLeaksCount: number;
    safeSubscriptions: number;
  };
}

interface ObservableInfo {
  file: string;
  name: string;
  line: number;
  type: 'Observable' | 'BehaviorSubject' | 'ReplaySubject' | 'Subject' | 'AsyncSubject' | 'EventEmitter';
}

interface SubjectInfo {
  file: string;
  name: string;
  line: number;
  type: 'BehaviorSubject' | 'ReplaySubject' | 'Subject' | 'AsyncSubject';
  isPublic: boolean;
}

interface OperatorUsage {
  operator: string;
  count: number;
  files: string[];
}

interface SubscriptionInfo {
  file: string;
  observable: string;
  line: number;
  handlingType: 'manual' | 'async-pipe' | 'take' | 'takeUntil' | 'takeWhile' | 'first' | 'unknown';
  isSafe: boolean;
}

interface SubscriptionLeak {
  file: string;
  line: number;
  observable: string;
  reason: 'no-unsubscribe' | 'no-async-pipe' | 'no-auto-complete';
  severity: 'error' | 'warning';
}

// ==================== RxJS Analyzer ====================

class RxJSAnalyzer {
  private projectPath: string;
  private observables: ObservableInfo[] = [];
  private subjects: SubjectInfo[] = [];
  private operators = new Map<string, Set<string>>();
  private subscriptions: SubscriptionInfo[] = [];
  private potentialLeaks: SubscriptionLeak[] = [];

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  analyze(): RxJSAnalysis {
    console.log(`Analyzing RxJS usage in: ${this.projectPath}\n`);

    const files = this.getAllTypeScriptFiles(this.projectPath);
    console.log(`Analyzing ${files.length} files...\n`);

    let processed = 0;
    for (const file of files) {
      this.analyzeFile(file);
      processed++;
      if (processed % 20 === 0) {
        console.log(`Processed ${processed}/${files.length} files...`);
      }
    }

    const operatorUsage = this.aggregateOperatorUsage();
    const safeSubscriptions = this.subscriptions.filter(s => s.isSafe).length;

    return {
      observables: this.observables,
      subjects: this.subjects,
      operators: operatorUsage,
      subscriptions: this.subscriptions,
      potentialLeaks: this.potentialLeaks,
      summary: {
        totalObservables: this.observables.length,
        totalSubjects: this.subjects.length,
        totalSubscriptions: this.subscriptions.length,
        potentialLeaksCount: this.potentialLeaks.length,
        safeSubscriptions
      }
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

  private analyzeFile(filePath: string): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(this.projectPath, filePath);

    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        comment: false
      });

      let hasRxJSImport = false;
      let currentClassName = '';
      let classHasNgOnDestroy = false;
      const subscriptionVariables = new Set<string>();

      const traverse = (node: any): void => {
        if (!node) return;

        // RxJSインポートを検出
        if (node.type === 'ImportDeclaration' && node.source.value === 'rxjs') {
          hasRxJSImport = true;
        }

        // クラス情報を追跡
        if (node.type === 'ClassDeclaration' && node.id) {
          currentClassName = node.id.name;

          // ngOnDestroyの実装を確認
          if (node.implements) {
            node.implements.forEach((impl: any) => {
              if (impl.expression?.name === 'OnDestroy') {
                classHasNgOnDestroy = true;
              }
            });
          }
        }

        // プロパティ宣言でObservable/Subjectを検出
        if (node.type === 'PropertyDefinition' && node.typeAnnotation) {
          const typeName = this.extractTypeName(node.typeAnnotation);
          if (this.isRxJSType(typeName)) {
            const isPublic = !node.accessibility || node.accessibility === 'public';

            if (this.isSubjectType(typeName)) {
              this.subjects.push({
                file: relativePath,
                name: node.key.name,
                line: node.loc.start.line,
                type: typeName as SubjectInfo['type'],
                isPublic
              });
            } else {
              this.observables.push({
                file: relativePath,
                name: node.key.name,
                line: node.loc.start.line,
                type: typeName as ObservableInfo['type']
              });
            }
          }

          if (typeName === 'Subscription') {
            subscriptionVariables.add(node.key.name);
          }
        }

        // RxJSオペレーターの使用を検出
        if (hasRxJSImport && node.type === 'CallExpression' && node.callee?.name) {
          const operatorName = node.callee.name;
          if (this.isRxJSOperator(operatorName)) {
            if (!this.operators.has(operatorName)) {
              this.operators.set(operatorName, new Set());
            }
            this.operators.get(operatorName)!.add(relativePath);
          }
        }

        // .subscribe()呼び出しを検出
        if (node.type === 'CallExpression' &&
            node.callee?.property?.name === 'subscribe') {

          const line = node.loc.start.line;
          const observable = this.extractObservableName(node.callee.object);

          // 安全性を判定
          const handlingType = this.determineSubscriptionHandling(node, content, line);
          const isSafe = this.isSubscriptionSafe(handlingType, classHasNgOnDestroy, subscriptionVariables);

          this.subscriptions.push({
            file: relativePath,
            observable,
            line,
            handlingType,
            isSafe
          });

          // 潜在的なリークを検出
          if (!isSafe) {
            this.potentialLeaks.push({
              file: relativePath,
              line,
              observable,
              reason: this.determineLeakReason(handlingType, classHasNgOnDestroy),
              severity: 'warning'
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

  private extractTypeName(typeAnnotation: any): string {
    if (typeAnnotation.typeAnnotation?.typeName?.name) {
      return typeAnnotation.typeAnnotation.typeName.name;
    }
    return 'unknown';
  }

  private isRxJSType(typeName: string): boolean {
    return ['Observable', 'BehaviorSubject', 'ReplaySubject', 'Subject', 'AsyncSubject', 'EventEmitter'].includes(typeName);
  }

  private isSubjectType(typeName: string): boolean {
    return ['BehaviorSubject', 'ReplaySubject', 'Subject', 'AsyncSubject'].includes(typeName);
  }

  private isRxJSOperator(name: string): boolean {
    const commonOperators = [
      'map', 'filter', 'tap', 'switchMap', 'mergeMap', 'concatMap', 'exhaustMap',
      'take', 'takeUntil', 'takeWhile', 'first', 'last', 'skip', 'debounceTime',
      'throttleTime', 'distinctUntilChanged', 'catchError', 'retry', 'shareReplay',
      'combineLatest', 'withLatestFrom', 'startWith', 'scan', 'reduce'
    ];
    return commonOperators.includes(name);
  }

  private extractObservableName(node: any): string {
    if (node?.property?.name) {
      return node.property.name;
    }
    if (node?.name) {
      return node.name;
    }
    return 'unknown';
  }

  private determineSubscriptionHandling(
    node: any,
    content: string,
    line: number
  ): SubscriptionInfo['handlingType'] {
    // コード内容から判定（簡易版）
    const lineContent = content.split('\n')[line - 1] || '';
    const surroundingLines = content.split('\n').slice(Math.max(0, line - 3), line + 3).join('\n');

    if (lineContent.includes('| async')) {
      return 'async-pipe';
    }
    if (surroundingLines.includes('takeUntil(')) {
      return 'takeUntil';
    }
    if (surroundingLines.includes('.take(')) {
      return 'take';
    }
    if (surroundingLines.includes('takeWhile(')) {
      return 'takeWhile';
    }
    if (surroundingLines.includes('.first(')) {
      return 'first';
    }
    if (lineContent.includes('.subscribe()') || lineContent.match(/\.subscribe\(\s*\)/)) {
      return 'manual';
    }

    return 'unknown';
  }

  private isSubscriptionSafe(
    handlingType: SubscriptionInfo['handlingType'],
    hasNgOnDestroy: boolean,
    subscriptionVariables: Set<string>
  ): boolean {
    // async pipe や自動完了オペレーターは安全
    if (['async-pipe', 'take', 'takeUntil', 'takeWhile', 'first'].includes(handlingType)) {
      return true;
    }

    // ngOnDestroyとSubscription変数があれば手動管理されている可能性が高い
    if (handlingType === 'manual' && hasNgOnDestroy && subscriptionVariables.size > 0) {
      return true;
    }

    return false;
  }

  private determineLeakReason(
    handlingType: SubscriptionInfo['handlingType'],
    hasNgOnDestroy: boolean
  ): SubscriptionLeak['reason'] {
    if (handlingType === 'async-pipe') {
      return 'no-async-pipe';
    }
    if (!hasNgOnDestroy) {
      return 'no-unsubscribe';
    }
    return 'no-auto-complete';
  }

  private aggregateOperatorUsage(): OperatorUsage[] {
    const usage: OperatorUsage[] = [];

    this.operators.forEach((files, operator) => {
      usage.push({
        operator,
        count: files.size,
        files: Array.from(files)
      });
    });

    return usage.sort((a, b) => b.count - a.count);
  }
}

// ==================== Output Formatters ====================

function formatMarkdown(analysis: RxJSAnalysis): string {
  let md = `# RxJS Usage Analysis\n\n`;

  md += `**Analyzed At**: ${new Date().toISOString()}\n\n`;

  md += `## Summary\n\n`;
  md += `- **Total Observables**: ${analysis.summary.totalObservables}\n`;
  md += `- **Total Subjects**: ${analysis.summary.totalSubjects}\n`;
  md += `- **Total Subscriptions**: ${analysis.summary.totalSubscriptions}\n`;
  md += `- **Safe Subscriptions**: ${analysis.summary.safeSubscriptions}\n`;
  md += `- **Potential Leaks**: ${analysis.summary.potentialLeaksCount}\n\n`;

  if (analysis.potentialLeaks.length > 0) {
    md += `## ⚠️ Potential Memory Leaks (${analysis.potentialLeaks.length})\n\n`;
    md += `| File | Line | Observable | Reason | Severity |\n`;
    md += `|------|------|------------|--------|----------|\n`;
    analysis.potentialLeaks.forEach(leak => {
      md += `| ${leak.file} | ${leak.line} | ${leak.observable} | ${leak.reason} | ${leak.severity} |\n`;
    });
    md += `\n`;
  }

  if (analysis.operators.length > 0) {
    md += `## Most Used Operators\n\n`;
    md += `| Operator | Usage Count | Files |\n`;
    md += `|----------|-------------|-------|\n`;
    analysis.operators.slice(0, 10).forEach(op => {
      md += `| ${op.operator} | ${op.count} | ${op.files.length} |\n`;
    });
    md += `\n`;
  }

  if (analysis.subjects.length > 0) {
    md += `## Subjects (${analysis.subjects.length})\n\n`;
    md += `| Name | Type | File | Public | Line |\n`;
    md += `|------|------|------|--------|------|\n`;
    analysis.subjects.forEach(subj => {
      md += `| ${subj.name} | ${subj.type} | ${subj.file} | ${subj.isPublic ? 'Yes' : 'No'} | ${subj.line} |\n`;
    });
    md += `\n`;
  }

  md += `## Subscription Safety\n\n`;
  const subscriptionsByType = new Map<string, number>();
  analysis.subscriptions.forEach(sub => {
    subscriptionsByType.set(sub.handlingType, (subscriptionsByType.get(sub.handlingType) || 0) + 1);
  });

  md += `| Handling Type | Count |\n`;
  md += `|---------------|-------|\n`;
  subscriptionsByType.forEach((count, type) => {
    md += `| ${type} | ${count} |\n`;
  });
  md += `\n`;

  return md;
}

function formatConsole(analysis: RxJSAnalysis): void {
  console.log(`\n📊 RxJS Usage Analysis\n`);

  console.log(`Summary:`);
  console.log(`  - Observables: ${analysis.summary.totalObservables}`);
  console.log(`  - Subjects: ${analysis.summary.totalSubjects}`);
  console.log(`  - Subscriptions: ${analysis.summary.totalSubscriptions}`);
  console.log(`  - Safe Subscriptions: ${analysis.summary.safeSubscriptions}`);
  console.log(`  - Potential Leaks: ${analysis.summary.potentialLeaksCount}\n`);

  if (analysis.potentialLeaks.length > 0) {
    console.log(`⚠️  Potential Memory Leaks (${analysis.potentialLeaks.length}):`);
    analysis.potentialLeaks.slice(0, 10).forEach(leak => {
      console.log(`  - ${leak.file}:${leak.line} - ${leak.observable} (${leak.reason})`);
    });
    if (analysis.potentialLeaks.length > 10) {
      console.log(`  ... and ${analysis.potentialLeaks.length - 10} more\n`);
    } else {
      console.log('');
    }
  }

  if (analysis.operators.length > 0) {
    console.log(`Most Used Operators:`);
    analysis.operators.slice(0, 5).forEach(op => {
      console.log(`  - ${op.operator}: ${op.count} usage${op.count !== 1 ? 's' : ''}`);
    });
    console.log('');
  }
}

// ==================== Main ====================

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Usage: npx ts-node src/analyze-rxjs.ts <project-dir> [options]

Options:
  --save <path>      Save output to file
  --help             Show this help message

Examples:
  npx ts-node src/analyze-rxjs.ts ./src
  npx ts-node src/analyze-rxjs.ts ./src --save rxjs-analysis.md
`);
    process.exit(0);
  }

  const projectPath = args[0];
  const savePath = args.includes('--save') ? args[args.indexOf('--save') + 1] : null;

  if (!fs.existsSync(projectPath)) {
    console.error(`Error: Project directory "${projectPath}" does not exist`);
    process.exit(1);
  }

  const analyzer = new RxJSAnalyzer(projectPath);
  const analysis = analyzer.analyze();

  formatConsole(analysis);

  if (savePath) {
    const markdown = formatMarkdown(analysis);
    fs.writeFileSync(savePath, markdown);
    console.log(`✓ Saved to ${savePath}\n`);
  }
}

main();
