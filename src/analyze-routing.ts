#!/usr/bin/env ts-node

/**
 * analyze-routing.ts
 * ルーティング構造を解析・可視化
 *
 * Usage: npx ts-node src/analyze-routing.ts <routes-file>
 */

import * as fs from 'fs';
import { parse } from '@typescript-eslint/typescript-estree';

// ==================== Interfaces ====================

interface RouteAnalysis {
  path: string;
  fullPath: string;
  component?: string;
  redirectTo?: string;
  guards: string[];
  resolvers: string[];
  data?: Record<string, any>;
  children: RouteAnalysis[];
  isLazy: boolean;
  loadChildren?: string;
  depth: number;
}

interface RoutingAnalysis {
  routes: RouteAnalysis[];
  totalRoutes: number;
  lazyRoutes: number;
  guards: Set<string>;
  resolvers: Set<string>;
}

// ==================== Routing Analyzer ====================

class RoutingAnalyzer {
  private routes: RouteAnalysis[] = [];
  private guards = new Set<string>();
  private resolvers = new Set<string>();

  analyzeFile(filePath: string): RoutingAnalysis {
    console.log(`Analyzing routes in: ${filePath}\n`);

    const content = fs.readFileSync(filePath, 'utf-8');

    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        comment: false
      });

      this.extractRoutes(ast);

      const totalRoutes = this.countRoutes(this.routes);
      const lazyRoutes = this.countLazyRoutes(this.routes);

      return {
        routes: this.routes,
        totalRoutes,
        lazyRoutes,
        guards: this.guards,
        resolvers: this.resolvers
      };
    } catch (error) {
      console.error('Error parsing routes file:', error);
      throw error;
    }
  }

  private extractRoutes(ast: any): void {
    const traverse = (node: any): void => {
      if (!node) return;

      // VariableDeclaration で routes を探す
      if (node.type === 'VariableDeclaration') {
        for (const declaration of node.declarations) {
          if (declaration.id?.name === 'routes' && declaration.init?.type === 'ArrayExpression') {
            this.routes = this.parseRoutesArray(declaration.init.elements, '', 0);
            return;
          }
        }
      }

      // ExportNamedDeclaration の中も探す
      if (node.type === 'ExportNamedDeclaration' && node.declaration) {
        traverse(node.declaration);
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
  }

  private parseRoutesArray(elements: any[], parentPath: string, depth: number): RouteAnalysis[] {
    const routes: RouteAnalysis[] = [];

    for (const element of elements) {
      if (element && element.type === 'ObjectExpression') {
        const route = this.parseRouteObject(element, parentPath, depth);
        routes.push(route);
      }
    }

    return routes;
  }

  private parseRouteObject(node: any, parentPath: string, depth: number): RouteAnalysis {
    const route: RouteAnalysis = {
      path: '',
      fullPath: '',
      guards: [],
      resolvers: [],
      children: [],
      isLazy: false,
      depth
    };

    for (const prop of node.properties) {
      if (prop.type === 'Property') {
        const key = prop.key.name || prop.key.value;
        const value = prop.value;

        switch (key) {
          case 'path':
            route.path = value.value || '';
            route.fullPath = parentPath ? `${parentPath}/${route.path}` : `/${route.path}`;
            break;

          case 'component':
            route.component = value.name || 'Unknown';
            break;

          case 'redirectTo':
            route.redirectTo = value.value;
            break;

          case 'loadChildren':
            route.isLazy = true;
            route.loadChildren = value.value || 'dynamic';
            break;

          case 'canActivate':
            if (value.type === 'ArrayExpression') {
              route.guards = value.elements
                .filter((el: any) => el && el.name)
                .map((el: any) => {
                  this.guards.add(el.name);
                  return el.name;
                });
            }
            break;

          case 'resolve':
            if (value.type === 'ObjectExpression') {
              value.properties.forEach((p: any) => {
                if (p.value && p.value.name) {
                  this.resolvers.add(p.value.name);
                  route.resolvers.push(p.value.name);
                }
              });
            }
            break;

          case 'children':
            if (value.type === 'ArrayExpression') {
              route.children = this.parseRoutesArray(value.elements, route.fullPath, depth + 1);
            }
            break;
        }
      }
    }

    return route;
  }

  private countRoutes(routes: RouteAnalysis[]): number {
    let count = routes.length;
    for (const route of routes) {
      count += this.countRoutes(route.children);
    }
    return count;
  }

  private countLazyRoutes(routes: RouteAnalysis[]): number {
    let count = 0;
    for (const route of routes) {
      if (route.isLazy) count++;
      count += this.countLazyRoutes(route.children);
    }
    return count;
  }
}

// ==================== Output Formatters ====================

function formatRouteTree(routes: RouteAnalysis[], prefix: string = ''): string {
  let output = '';

  routes.forEach((route, index) => {
    const isLast = index === routes.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = prefix + (isLast ? '    ' : '│   ');

    let routeLabel = route.fullPath || '/';

    if (route.component) {
      routeLabel += ` → ${route.component}`;
    }

    if (route.redirectTo) {
      routeLabel += ` ⇒ ${route.redirectTo}`;
    }

    if (route.isLazy) {
      routeLabel += ' [LAZY]';
    }

    output += `${prefix}${connector}${routeLabel}\n`;

    // Guards
    if (route.guards.length > 0) {
      output += `${childPrefix}  🛡️  Guards: ${route.guards.join(', ')}\n`;
    }

    // Resolvers
    if (route.resolvers.length > 0) {
      output += `${childPrefix}  📦 Resolvers: ${route.resolvers.join(', ')}\n`;
    }

    // Children
    if (route.children.length > 0) {
      output += formatRouteTree(route.children, childPrefix);
    }
  });

  return output;
}

function formatMarkdown(analysis: RoutingAnalysis): string {
  let md = `# Routing Analysis Report\n\n`;

  md += `**Analyzed At**: ${new Date().toISOString()}\n\n`;

  md += `## Summary\n\n`;
  md += `- **Total Routes**: ${analysis.totalRoutes}\n`;
  md += `- **Lazy Routes**: ${analysis.lazyRoutes}\n`;
  md += `- **Guards**: ${analysis.guards.size}\n`;
  md += `- **Resolvers**: ${analysis.resolvers.size}\n\n`;

  md += `## Route Tree\n\n`;
  md += '```\n';
  md += formatRouteTree(analysis.routes);
  md += '```\n\n';

  if (analysis.guards.size > 0) {
    md += `## Guards (${analysis.guards.size})\n\n`;
    Array.from(analysis.guards).forEach(guard => {
      md += `- ${guard}\n`;
    });
    md += `\n`;
  }

  if (analysis.resolvers.size > 0) {
    md += `## Resolvers (${analysis.resolvers.size})\n\n`;
    Array.from(analysis.resolvers).forEach(resolver => {
      md += `- ${resolver}\n`;
    });
    md += `\n`;
  }

  md += `## Route Details\n\n`;

  const listRoutes = (routes: RouteAnalysis[], depth: number = 0): void => {
    routes.forEach(route => {
      const indent = '  '.repeat(depth);
      md += `${indent}### ${route.fullPath || '/'}\n\n`;
      md += `${indent}- **Component**: ${route.component || 'N/A'}\n`;
      md += `${indent}- **Lazy**: ${route.isLazy ? 'Yes' : 'No'}\n`;

      if (route.redirectTo) {
        md += `${indent}- **Redirect To**: ${route.redirectTo}\n`;
      }

      if (route.guards.length > 0) {
        md += `${indent}- **Guards**: ${route.guards.join(', ')}\n`;
      }

      if (route.resolvers.length > 0) {
        md += `${indent}- **Resolvers**: ${route.resolvers.join(', ')}\n`;
      }

      md += `\n`;

      if (route.children.length > 0) {
        listRoutes(route.children, depth + 1);
      }
    });
  };

  listRoutes(analysis.routes);

  return md;
}

// ==================== Main ====================

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Usage: npx ts-node src/analyze-routing.ts <routes-file> [options]

Options:
  --save <path>      Save output to file
  --help             Show this help message

Examples:
  npx ts-node src/analyze-routing.ts ./src/app/app.routes.ts
  npx ts-node src/analyze-routing.ts ./src/app/app.routes.ts --save routing.md
`);
    process.exit(0);
  }

  const routesFile = args[0];
  const savePath = args.includes('--save') ? args[args.indexOf('--save') + 1] : null;

  if (!fs.existsSync(routesFile)) {
    console.error(`Error: Routes file "${routesFile}" does not exist`);
    process.exit(1);
  }

  const analyzer = new RoutingAnalyzer();
  const analysis = analyzer.analyzeFile(routesFile);

  console.log(`✓ Found ${analysis.totalRoutes} routes\n`);

  const output = formatMarkdown(analysis);

  // Save or print
  if (savePath) {
    fs.writeFileSync(savePath, output);
    console.log(`✓ Saved to ${savePath}`);
  } else {
    console.log(output);
  }
}

main();
