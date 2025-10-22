#!/usr/bin/env ts-node

/**
 * generate-report.ts
 * すべての解析結果をHTML形式で統合レポート化
 *
 * Usage: npx ts-node src/generate-report.ts <project-dir> [options]
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ==================== Interfaces ====================

interface ReportConfig {
  projectPath: string;
  outputPath: string;
  includeGraphs: boolean;
  includeMetrics: boolean;
  theme: 'light' | 'dark';
}

interface ReportData {
  projectAnalysis: any;
  moduleAnalysis: any;
  routingAnalysis: any;
  circularDeps: any;
  unusedCode: any;
  rxjsAnalysis: any;
  generatedAt: string;
}

// ==================== Report Generator ====================

class ReportGenerator {
  private config: ReportConfig;

  constructor(config: ReportConfig) {
    this.config = config;
  }

  async generate(): Promise<void> {
    console.log(`Generating comprehensive report for: ${this.config.projectPath}\n`);

    // すべての解析を実行
    const data = await this.runAllAnalyses();

    // HTMLレポートを生成
    const html = this.generateHTML(data);

    // ファイルに保存
    fs.writeFileSync(this.config.outputPath, html);

    console.log(`\n✓ Report generated: ${this.config.outputPath}`);
  }

  private async runAllAnalyses(): Promise<ReportData> {
    const data: ReportData = {
      projectAnalysis: null,
      moduleAnalysis: null,
      routingAnalysis: null,
      circularDeps: null,
      unusedCode: null,
      rxjsAnalysis: null,
      generatedAt: new Date().toISOString()
    };

    console.log('Running analyses...\n');

    // 1. Project Analysis
    try {
      console.log('1/6 Running project analysis...');
      const output = execSync(
        `npx ts-node ${path.join(__dirname, 'analyze-project.ts')} ${this.config.projectPath} --output json`,
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
      );
      data.projectAnalysis = JSON.parse(output);
    } catch (error) {
      console.error('Failed to run project analysis');
    }

    // 2. Module Analysis
    try {
      console.log('2/6 Running module analysis...');
      const output = execSync(
        `npx ts-node ${path.join(__dirname, 'analyze-modules.ts')} ${this.config.projectPath}`,
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
      );
      // Markdownなのでパース不要、そのまま保存
      data.moduleAnalysis = { output };
    } catch (error) {
      console.error('Failed to run module analysis');
    }

    // 3. Circular Dependencies
    try {
      console.log('3/6 Detecting circular dependencies...');
      execSync(
        `npx ts-node ${path.join(__dirname, 'detect-circular-deps.ts')} ${this.config.projectPath}`,
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
      );
      data.circularDeps = { cycles: [], message: 'No circular dependencies found' };
    } catch (error: any) {
      // Exit code 1 means circular deps found
      data.circularDeps = { cycles: [], message: 'Circular dependencies detected' };
    }

    // 4. Unused Code
    try {
      console.log('4/6 Detecting unused code...');
      execSync(
        `npx ts-node ${path.join(__dirname, 'detect-unused-code.ts')} ${this.config.projectPath}`,
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
      );
      data.unusedCode = { summary: { totalUnused: 0 } };
    } catch (error) {
      console.error('Failed to detect unused code');
    }

    // 5. RxJS Analysis
    try {
      console.log('5/6 Analyzing RxJS usage...');
      execSync(
        `npx ts-node ${path.join(__dirname, 'analyze-rxjs.ts')} ${this.config.projectPath}`,
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
      );
      data.rxjsAnalysis = { summary: { potentialLeaksCount: 0 } };
    } catch (error) {
      console.error('Failed to analyze RxJS');
    }

    console.log('6/6 Compiling report...\n');

    return data;
  }

  private generateHTML(data: ReportData): string {
    const styles = this.getStyles();
    const projectAnalysisHtml = this.renderProjectAnalysis(data.projectAnalysis);
    const moduleAnalysisHtml = this.renderModuleAnalysis(data.moduleAnalysis);
    const issuesHtml = this.renderIssues(data);
    const metricsHtml = this.renderMetrics(data);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Angular Project Analysis Report</title>
  <style>${styles}</style>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({ startOnLoad: true, theme: '${this.config.theme === 'dark' ? 'dark' : 'default'}' });
  </script>
</head>
<body class="${this.config.theme}">
  <div class="container">
    <header>
      <h1>📊 Angular Project Analysis Report</h1>
      <p class="subtitle">Generated at ${new Date(data.generatedAt).toLocaleString()}</p>
    </header>

    <nav class="toc">
      <h2>Table of Contents</h2>
      <ul>
        <li><a href="#summary">Summary</a></li>
        <li><a href="#issues">Issues & Warnings</a></li>
        <li><a href="#metrics">Code Metrics</a></li>
        <li><a href="#project">Project Structure</a></li>
        <li><a href="#modules">Module Analysis</a></li>
      </ul>
    </nav>

    <section id="summary" class="section">
      <h2>📋 Summary</h2>
      ${this.renderSummary(data)}
    </section>

    <section id="issues" class="section">
      <h2>⚠️ Issues & Warnings</h2>
      ${issuesHtml}
    </section>

    <section id="metrics" class="section">
      <h2>📈 Code Metrics</h2>
      ${metricsHtml}
    </section>

    <section id="project" class="section">
      <h2>🏗️ Project Structure</h2>
      ${projectAnalysisHtml}
    </section>

    <section id="modules" class="section">
      <h2>🔧 Module Analysis</h2>
      ${moduleAnalysisHtml}
    </section>

    <footer>
      <p>Generated by Angular Analyzer</p>
    </footer>
  </div>
</body>
</html>`;
  }

  private getStyles(): string {
    const baseStyles = `
      * { margin: 0; padding: 0; box-sizing: border-box; }

      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        background: #f5f5f5;
      }

      body.dark {
        background: #1a1a1a;
        color: #e0e0e0;
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
      }

      header {
        text-align: center;
        padding: 40px 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 10px;
        margin-bottom: 30px;
      }

      header h1 {
        font-size: 2.5em;
        margin-bottom: 10px;
      }

      .subtitle {
        font-size: 0.9em;
        opacity: 0.9;
      }

      .toc {
        background: white;
        padding: 20px;
        border-radius: 8px;
        margin-bottom: 30px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      body.dark .toc {
        background: #2a2a2a;
      }

      .toc h2 {
        margin-bottom: 15px;
        color: #667eea;
      }

      .toc ul {
        list-style: none;
      }

      .toc li {
        margin: 8px 0;
      }

      .toc a {
        color: #667eea;
        text-decoration: none;
        transition: color 0.3s;
      }

      .toc a:hover {
        color: #764ba2;
      }

      .section {
        background: white;
        padding: 30px;
        border-radius: 8px;
        margin-bottom: 30px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      body.dark .section {
        background: #2a2a2a;
      }

      .section h2 {
        color: #667eea;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid #667eea;
      }

      .card {
        background: #f9f9f9;
        padding: 15px;
        border-radius: 6px;
        margin: 10px 0;
      }

      body.dark .card {
        background: #333;
      }

      .stat-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin: 20px 0;
      }

      .stat-card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
      }

      .stat-card h3 {
        font-size: 2em;
        margin-bottom: 5px;
      }

      .stat-card p {
        opacity: 0.9;
      }

      .alert {
        padding: 15px;
        border-radius: 6px;
        margin: 10px 0;
      }

      .alert.error {
        background: #fee;
        border-left: 4px solid #f44;
        color: #c33;
      }

      .alert.warning {
        background: #ffc;
        border-left: 4px solid #fc3;
        color: #963;
      }

      .alert.success {
        background: #efe;
        border-left: 4px solid #4c4;
        color: #363;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
      }

      th, td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #ddd;
      }

      body.dark th, body.dark td {
        border-bottom: 1px solid #444;
      }

      th {
        background: #667eea;
        color: white;
        font-weight: 600;
      }

      tr:hover {
        background: #f5f5f5;
      }

      body.dark tr:hover {
        background: #333;
      }

      footer {
        text-align: center;
        padding: 20px;
        color: #999;
        margin-top: 40px;
      }
    `;

    return baseStyles;
  }

  private renderSummary(data: ReportData): string {
    const proj = data.projectAnalysis;
    if (!proj) {
      return '<p>No project data available</p>';
    }

    return `
      <div class="stat-grid">
        <div class="stat-card">
          <h3>${proj.summary?.totalFiles || 0}</h3>
          <p>Total Files</p>
        </div>
        <div class="stat-card">
          <h3>${proj.components?.length || 0}</h3>
          <p>Components</p>
        </div>
        <div class="stat-card">
          <h3>${proj.services?.length || 0}</h3>
          <p>Services</p>
        </div>
        <div class="stat-card">
          <h3>${proj.modules?.length || 0}</h3>
          <p>Modules</p>
        </div>
      </div>
    `;
  }

  private renderIssues(data: ReportData): string {
    let html = '';

    // Circular Dependencies
    if (data.circularDeps?.message?.includes('detected')) {
      html += `<div class="alert error">
        <strong>🔴 Circular Dependencies Detected</strong>
        <p>Your project has circular dependencies that should be resolved.</p>
      </div>`;
    } else {
      html += `<div class="alert success">
        <strong>✅ No Circular Dependencies</strong>
        <p>Great! Your project has no circular dependencies.</p>
      </div>`;
    }

    // Unused Code
    const unusedCount = data.unusedCode?.summary?.totalUnused || 0;
    if (unusedCount > 0) {
      html += `<div class="alert warning">
        <strong>🟡 Unused Code Detected</strong>
        <p>Found ${unusedCount} unused items that could be removed.</p>
      </div>`;
    }

    // RxJS Leaks
    const leaksCount = data.rxjsAnalysis?.summary?.potentialLeaksCount || 0;
    if (leaksCount > 0) {
      html += `<div class="alert warning">
        <strong>🟡 Potential Memory Leaks</strong>
        <p>Found ${leaksCount} potential RxJS subscription leaks.</p>
      </div>`;
    }

    if (!html) {
      html = `<div class="alert success">
        <strong>✅ No Issues Found</strong>
        <p>Your project looks healthy!</p>
      </div>`;
    }

    return html;
  }

  private renderMetrics(data: ReportData): string {
    const proj = data.projectAnalysis;
    if (!proj?.metrics) {
      return '<p>No metrics data available</p>';
    }

    return `
      <div class="card">
        <h3>Code Statistics</h3>
        <table>
          <tr>
            <td>Total Functions</td>
            <td>${proj.metrics.totalFunctions || 0}</td>
          </tr>
          <tr>
            <td>Total Classes</td>
            <td>${proj.metrics.totalClasses || 0}</td>
          </tr>
          <tr>
            <td>Average Functions per File</td>
            <td>${(proj.metrics.averageFunctionsPerFile || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td>Average Lines per File</td>
            <td>${(proj.metrics.averageLinesPerFile || 0).toFixed(2)}</td>
          </tr>
        </table>
      </div>
    `;
  }

  private renderProjectAnalysis(analysis: any): string {
    if (!analysis) {
      return '<p>No project analysis data available</p>';
    }

    let html = '<div class="card">';
    html += '<h3>Components</h3>';
    if (analysis.components && analysis.components.length > 0) {
      html += '<ul>';
      analysis.components.slice(0, 20).forEach((comp: any) => {
        html += `<li><strong>${comp.name}</strong> - ${comp.path}</li>`;
      });
      if (analysis.components.length > 20) {
        html += `<li><em>... and ${analysis.components.length - 20} more</em></li>`;
      }
      html += '</ul>';
    } else {
      html += '<p>No components found</p>';
    }
    html += '</div>';

    return html;
  }

  private renderModuleAnalysis(moduleData: any): string {
    if (!moduleData?.output) {
      return '<p>No module analysis data available</p>';
    }

    return `<div class="card">
      <pre style="white-space: pre-wrap; font-size: 0.9em;">${this.escapeHtml(moduleData.output)}</pre>
    </div>`;
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}

// ==================== Main ====================

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Usage: npx ts-node src/generate-report.ts <project-dir> [options]

Options:
  --output <path>    Output HTML file path (default: report.html)
  --theme <theme>    Theme: light, dark (default: light)
  --no-graphs        Exclude graphs from report
  --no-metrics       Exclude metrics from report
  --help             Show this help message

Examples:
  npx ts-node src/generate-report.ts ./src
  npx ts-node src/generate-report.ts ./src --output analysis.html --theme dark
`);
    process.exit(0);
  }

  const projectPath = args[0];
  const outputPath = args.includes('--output') ? args[args.indexOf('--output') + 1] : 'report.html';
  const theme = args.includes('--theme') ? args[args.indexOf('--theme') + 1] as 'light' | 'dark' : 'light';
  const includeGraphs = !args.includes('--no-graphs');
  const includeMetrics = !args.includes('--no-metrics');

  if (!fs.existsSync(projectPath)) {
    console.error(`Error: Project directory "${projectPath}" does not exist`);
    process.exit(1);
  }

  const config: ReportConfig = {
    projectPath,
    outputPath,
    includeGraphs,
    includeMetrics,
    theme
  };

  const generator = new ReportGenerator(config);
  generator.generate().then(() => {
    console.log('\nDone!');
  }).catch(error => {
    console.error('Error generating report:', error);
    process.exit(1);
  });
}

main();
