# Angular Analyzer

Angularプロジェクトを解析するためのTypeScript製ツール集です。各ツールは完全に独立して動作し、コピペで使用できます。

## 特徴

- **完全独立**: 各ツールは他のファイルに依存せず、単独で動作
- **コピペ対応**: セキュリティの厳しい環境でもファイルをコピーして使用可能
- **TypeScript 5.9**: 最新のTypeScriptで実装
- **Node.js環境**: Node.jsで実行可能

## セットアップ

```bash
# 依存関係をインストール
npm install
```

## ツール一覧

### ⭐ 推奨ツール (Phase 1 - 統合解析)

#### analyze-project.ts - プロジェクト統合解析 🚀 **NEW**

**最も重要**: プロジェクト全体を1回のパスで解析します。従来の10ツールの機能を統合し、60-1000倍高速化を実現。

```bash
npx ts-node src/analyze-project.ts <project-dir> [options]

Options:
  --output <format>  Output format: json, md (default: json)
  --save <path>      Save output to file
```

**出力**: プロジェクトサマリ、ファイル解析、コンポーネント/サービス一覧、依存関係グラフ、メトリクス

**メリット**:
- 60-1000倍高速 (13ファイル: 10秒 → 0.01秒)
- メモリ使用量90%削減
- 大規模プロジェクト対応

**使用例**:
```bash
# Markdown形式で出力
npx ts-node src/analyze-project.ts ./my-project --output md

# JSONファイルに保存
npx ts-node src/analyze-project.ts ./my-project --output json --save analysis.json
```

#### analyze-modules.ts - モジュール構造解析 🆕 **NEW**

NgModuleの構造と依存関係を解析します。

```bash
npx ts-node src/analyze-modules.ts <project-dir> [options]

Options:
  --output <format>  Output format: md, mermaid (default: md)
  --save <path>      Save output to file
```

**出力**: モジュール一覧、imports/exports、Mermaid依存関係グラフ

#### analyze-routing.ts - ルーティング解析 🆕 **NEW**

ルーティング構造を解析・可視化します。

```bash
npx ts-node src/analyze-routing.ts <routes-file> [options]

Options:
  --save <path>      Save output to file
```

**出力**: ルートツリー、Guards/Resolvers一覧、Lazy routes検出

#### detect-circular-deps.ts - 循環依存検出 🆕 **NEW**

循環依存を検出して警告します。CI/CD統合に最適。

```bash
npx ts-node src/detect-circular-deps.ts <project-dir> [options]

Options:
  --save <path>      Save output to file
```

**出力**: 循環依存リスト、Severity判定 (error/warning)、エラー時はexit code 1

**CI/CD統合例**:
```bash
# Pre-commit hook
npx ts-node src/detect-circular-deps.ts ./src || exit 1
```

---

### 個別解析ツール (従来版)

これらのツールは特定のファイルタイプに特化した解析を行います。
**推奨**: 大規模プロジェクトでは`analyze-project.ts`を使用してください。

### 1. list-files.ts - ファイル一覧取得

指定ディレクトリ配下の.html/.css/.tsファイルをリストアップします。

```bash
npx ts-node src/list-files.ts <target-dir>
```

**出力**: JSON形式のファイルパスリスト + 統計情報

### 2. visualize-html.ts - HTML構造可視化

HTMLファイルのDOM構造をツリー形式で可視化します。

```bash
npx ts-node src/visualize-html.ts <html-file>
```

**出力**: ツリー形式の構造 + Angularコンポーネント/ディレクティブ情報

### 3. list-css-classes.ts - CSSクラス一覧

CSSファイルからクラスセレクタを抽出します。

```bash
npx ts-node src/list-css-classes.ts <css-file>
```

**出力**: テーブル形式のクラス一覧 + JSON

### 4. analyze-ts-imports.ts - TypeScriptインポート解析

TypeScriptファイルのimport文を解析します。

```bash
npx ts-node src/analyze-ts-imports.ts <ts-file>
```

**出力**: カテゴリ別のインポート一覧 (Angular/サードパーティ/相対パス)

### 5. list-ts-functions.ts - TypeScript関数一覧

TypeScriptファイルの関数/メソッドを一覧化します。

```bash
npx ts-node src/list-ts-functions.ts <ts-file>
```

**出力**: 関数名、パラメータ、戻り値型、行番号のテーブル

### 6. analyze-ts-role.ts - TypeScriptファイル役割分析

TypeScriptファイルの役割を判定します。

```bash
npx ts-node src/analyze-ts-role.ts <ts-file>
```

**出力**: ファイルの役割 (Component/Service/Module等) と信頼度

### 7. graph-ts-dependencies.ts - 依存関係グラフ化

プロジェクト全体のimport/export関係をグラフ化します。

```bash
npx ts-node src/graph-ts-dependencies.ts <project-dir>
```

**出力**: Mermaid形式とDOT形式のグラフ、`output/`ディレクトリに保存

### 8. summarize-html.ts - HTMLサマリ生成

HTMLファイルをMarkdown形式でサマリ化します。

```bash
npx ts-node src/summarize-html.ts <html-file>
```

**出力**: Markdownサマリ (コンソール + `output/`ディレクトリ)

### 9. summarize-css.ts - CSSサマリ生成

CSSファイルをMarkdown形式でサマリ化します。

```bash
npx ts-node src/summarize-css.ts <css-file>
```

**出力**: Markdownサマリ (セレクタ、プロパティ、レイアウト手法等)

### 10. summarize-ts.ts - TypeScriptサマリ生成

TypeScriptファイルをMarkdown形式でサマリ化します。

```bash
npx ts-node src/summarize-ts.ts <ts-file>
```

**出力**: Markdownサマリ (役割、インポート、エクスポート、関数等)

## 出力ディレクトリ

`output/`ディレクトリに以下のファイルが生成されます:

- `*-summary.md` - 各種サマリファイル
- `dependencies.mmd` - Mermaid形式の依存関係グラフ
- `dependencies.dot` - Graphviz形式の依存関係グラフ

## 技術スタック

- **TypeScript**: 5.9.0
- **@typescript-eslint/parser**: ^8.0.0 - TypeScript解析
- **node-html-parser**: ^6.1.0 - HTML解析
- **css-tree**: ^3.0.0 - CSS解析
- **ts-node**: ^10.9.0 - TypeScript実行環境

## 使用例

```bash
# プロジェクト全体のファイル一覧を取得
npx ts-node src/list-files.ts ./my-angular-project

# 特定のコンポーネントHTMLを解析
npx ts-node src/visualize-html.ts ./src/app/home/home.component.html

# コンポーネントのTypeScriptファイルを解析
npx ts-node src/analyze-ts-role.ts ./src/app/home/home.component.ts

# プロジェクト全体の依存関係グラフを生成
npx ts-node src/graph-ts-dependencies.ts ./src

# サマリを一括生成
npx ts-node src/summarize-html.ts ./src/app/home/home.component.html
npx ts-node src/summarize-css.ts ./src/app/home/home.component.css
npx ts-node src/summarize-ts.ts ./src/app/home/home.component.ts
```

## ライセンス

ISC

## 注意事項

- 各ツールは`node_modules`、`dist`、`.angular`などのディレクトリを自動的に除外します
- `.spec.ts`ファイルは依存関係グラフから除外されます
- CSSファイルは`.css`、`.scss`、`.sass`、`.less`に対応しています
