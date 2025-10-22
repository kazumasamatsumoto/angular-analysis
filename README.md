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

## クイックスタート

```bash
# 1. プロジェクト全体を解析
npx ts-node src/analyze-project.ts ./your-angular-project --output md

# 2. モジュール構造を可視化
npx ts-node src/analyze-modules.ts ./your-angular-project

# 3. 循環依存をチェック
npx ts-node src/detect-circular-deps.ts ./your-angular-project

# 4. ルーティング構造を確認
npx ts-node src/analyze-routing.ts ./your-angular-project/src/app/app-routing.module.ts
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
  --no-cache         Disable cache (default: cache enabled)
  --clear-cache      Clear cache and exit
```

**出力**: プロジェクトサマリ、ファイル解析、コンポーネント/サービス一覧、依存関係グラフ、メトリクス

**メリット**:
- 60-1000倍高速 (13ファイル: 10秒 → 0.01秒)
- メモリ使用量90%削減
- 大規模プロジェクト対応
- **インクリメンタル解析**: 変更ファイルのみ再解析（2回目以降は数倍高速）

**使用例**:
```bash
# Markdown形式で出力
npx ts-node src/analyze-project.ts ./my-project --output md

# JSONファイルに保存
npx ts-node src/analyze-project.ts ./my-project --output json --save analysis.json

# キャッシュなしで実行（初回または完全再解析時）
npx ts-node src/analyze-project.ts ./my-project --no-cache

# キャッシュをクリア
npx ts-node src/analyze-project.ts ./my-project --clear-cache
```

**キャッシュ機能**:
- デフォルトでキャッシュが有効
- `.cache/analysis-cache.json`にキャッシュを保存
- ファイルのハッシュ値とタイムスタンプで変更を検出
- 2回目以降の解析が大幅に高速化

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

---

### Phase 3 - 実用性向上ツール

#### analyze-template-usage.ts - テンプレート使用状況解析 🆕 **NEW**

テンプレート内のコンポーネント/ディレクティブ/パイプ使用状況を解析します。

```bash
npx ts-node src/analyze-template-usage.ts <component-file> [options]

Options:
  --save <path>      Save output to file
```

**出力**: 使用コンポーネント、ディレクティブ、パイプ一覧、未使用インポート警告

#### trace-service-usage.ts - サービス使用箇所追跡 🆕 **NEW**

サービスがどこで注入・使用されているか追跡します。

```bash
npx ts-node src/trace-service-usage.ts <service-file> <project-dir> [options]

Options:
  --save <path>      Save output to file
```

**出力**: 注入箇所、メソッド使用状況、呼び出し回数

#### detect-unused-code.ts - 未使用コード検出 🆕 **NEW**

未使用のコンポーネント、サービス、パイプ、ディレクティブを検出します。

```bash
npx ts-node src/detect-unused-code.ts <project-dir> [options]

Options:
  --save <path>      Save output to file
```

**出力**: 未使用アイテム一覧（コンポーネント/サービス/パイプ/ディレクティブ/モジュール）

#### analyze-rxjs.ts - RxJS解析 🆕 **NEW**

RxJS使用状況とSubscription漏れを検出します。

```bash
npx ts-node src/analyze-rxjs.ts <project-dir> [options]

Options:
  --save <path>      Save output to file
```

**出力**: Observable/Subject一覧、オペレーター使用状況、潜在的なメモリリーク警告

#### generate-report.ts - HTML統合レポート 🆕 **NEW**

すべての解析結果をHTML形式で統合レポート化します。

```bash
npx ts-node src/generate-report.ts <project-dir> [options]

Options:
  --output <path>    Output HTML file (default: report.html)
  --theme <theme>    Theme: light, dark (default: light)
  --help             Show this help message
```

**出力**: インタラクティブなHTMLレポート（サマリ、問題点、メトリクス、グラフ）

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

## 詳細な使い方と測定内容

### 📊 1. analyze-project.ts - プロジェクト統合解析

**目的**: プロジェクト全体の健全性と構造を一度に把握

**測定内容**:
- ✅ **ファイル統計**: TypeScript/HTML/CSSファイル数、総行数
- ✅ **コンポーネント分析**: 全コンポーネントの一覧、テンプレート/スタイル情報
- ✅ **サービス分析**: 全サービスの一覧、依存関係
- ✅ **モジュール検出**: NgModuleの数と構造
- ✅ **インポート/エクスポート**: 各ファイルの依存関係
- ✅ **関数/クラス一覧**: コードの詳細構造
- ✅ **コードメトリクス**: プロジェクト全体の規模感

**使用例**:
```bash
# Markdown形式で人間が読みやすく出力
npx ts-node src/analyze-project.ts ./src --output md

# JSON形式で保存（他のツールで処理する場合）
npx ts-node src/analyze-project.ts ./src --output json --save analysis.json

# CI/CDで定期実行してプロジェクト成長をトラッキング
npx ts-node src/analyze-project.ts ./src --output json --save reports/analysis-$(date +%Y%m%d).json
```

**こんな時に使う**:
- 新しいプロジェクトを引き継いだ時の全体把握
- リファクタリング前後の変化測定
- 定期的な技術負債レビュー
- プロジェクト規模の報告資料作成

**出力例**:
```
Project Analysis Report
======================

Summary:
- Total Files: 53
- Total Lines: 1,713
- Components: 10
- Services: 8
- Modules: 11

Top Components:
1. ProductsListComponent (45 lines)
2. OrderDetailComponent (38 lines)
...
```

---

### 🏗️ 2. analyze-modules.ts - モジュール構造解析

**目的**: NgModuleの依存関係とアーキテクチャを可視化

**測定内容**:
- ✅ **モジュール分類**: Root/Core/Shared/Featureの識別
- ✅ **imports/exports**: モジュール間の依存関係
- ✅ **declarations**: 各モジュールが管理するコンポーネント
- ✅ **providers**: 各モジュールが提供するサービス
- ✅ **遅延ロード検出**: Lazy-loaded modulesの識別
- ✅ **依存関係グラフ**: Mermaid形式の可視化

**使用例**:
```bash
# Markdown形式でモジュール一覧を表示
npx ts-node src/analyze-modules.ts ./src

# Mermaid形式のみを出力（ドキュメントに埋め込む場合）
npx ts-node src/analyze-modules.ts ./src --output mermaid

# ファイルに保存
npx ts-node src/analyze-modules.ts ./src --save docs/module-structure.md
```

**こんな時に使う**:
- モジュール設計のレビュー
- 不要なモジュール依存の発見
- 遅延ロード対象モジュールの確認
- アーキテクチャドキュメント作成
- 新メンバーへの構造説明

**出力例**:
```
Module Analysis Report
=====================

Summary:
- Total Modules: 11
- Root Modules: 1
- Core Modules: 1
- Shared Modules: 1
- Feature Modules: 7
- Lazy Modules: 7

AppModule (root)
├── imports: BrowserModule, CoreModule, SharedModule
└── declarations: AppComponent

UsersModule (feature, LAZY)
├── imports: CommonModule, SharedModule
└── declarations: UsersListComponent, UserDetailComponent

[Mermaid Dependency Graph]
```

---

### 🛣️ 3. analyze-routing.ts - ルーティング解析

**目的**: アプリケーションのルーティング構造を可視化

**測定内容**:
- ✅ **ルート一覧**: 全てのパスとコンポーネントのマッピング
- ✅ **Guards検出**: 認証/認可ガードの配置
- ✅ **Resolvers検出**: データプリロード設定
- ✅ **遅延ロード**: Lazy-loadedルートの識別
- ✅ **リダイレクト**: リダイレクトルールの一覧
- ✅ **子ルート**: ネストされたルーティング構造

**使用例**:
```bash
# メインのルーティングファイルを解析
npx ts-node src/analyze-routing.ts ./src/app/app-routing.module.ts

# 特定のFeatureモジュールのルーティングを解析
npx ts-node src/analyze-routing.ts ./src/app/features/users/users-routing.module.ts

# 結果をファイルに保存
npx ts-node src/analyze-routing.ts ./src/app/app-routing.module.ts --save docs/routes.md
```

**こんな時に使う**:
- URL構造の全体把握
- Guards配置の確認（セキュリティレビュー）
- 遅延ロード戦略の確認
- ルーティング設計のドキュメント化
- 404エラーの調査

**出力例**:
```
Routing Analysis Report
=======================

Summary:
- Total Routes: 6
- Lazy Routes: 4
- Guards: 2 (AuthGuard, AdminGuard)

Route Tree:
├── / ⇒ /products
├── /users [LAZY] 🛡️ AuthGuard
├── /products [LAZY]
├── /orders [LAZY] 🛡️ AuthGuard
├── /admin [LAZY] 🛡️ AuthGuard, AdminGuard
└── /** ⇒ /products
```

---

### 🔄 4. detect-circular-deps.ts - 循環依存検出

**目的**: コードの健全性チェック、循環依存による問題を未然に防ぐ

**測定内容**:
- ✅ **循環依存の検出**: Tarjanアルゴリズムによる厳密な検出
- ✅ **Severity判定**: error（Module/Service）/ warning（Component）
- ✅ **サイクル経路**: A → B → C → A の依存経路を表示
- ✅ **ファイルタイプ識別**: どの種類のファイルで循環が起きているか

**使用例**:
```bash
# プロジェクト全体をチェック
npx ts-node src/detect-circular-deps.ts ./src

# 特定のディレクトリのみチェック
npx ts-node src/detect-circular-deps.ts ./src/app/features/users

# CI/CDパイプラインに組み込む（循環依存があればビルド失敗）
npx ts-node src/detect-circular-deps.ts ./src || exit 1

# 結果をファイルに保存
npx ts-node src/detect-circular-deps.ts ./src --save reports/circular-deps.txt
```

**こんな時に使う**:
- ✅ **Pre-commit hook**: コミット前に自動チェック
- ✅ **CI/CD**: プルリクエスト時の品質ゲート
- ✅ **定期レビュー**: 週次/月次での技術負債チェック
- ✅ **リファクタリング**: 循環依存解消の優先度判断

**出力例**:
```
Detecting circular dependencies in: ./src

Analyzing 53 files...

Found 1 circular dependencies:

🔴 ERRORS (1):

  1. SERVICE Cycle:
     src/app/services/user.service.ts →
     src/app/services/auth.service.ts →
     src/app/services/user.service.ts

⚠️  WARNINGS (0):

Exit code: 1 (エラーあり)
```

---

## 実践的な使用シナリオ

### 📅 シナリオ 1: 新規プロジェクト参画時

```bash
# ステップ1: プロジェクト全体を把握
npx ts-node src/analyze-project.ts ./src --output md > docs/project-overview.md

# ステップ2: モジュール構造を理解
npx ts-node src/analyze-modules.ts ./src --save docs/module-structure.md

# ステップ3: ルーティングを把握
npx ts-node src/analyze-routing.ts ./src/app/app-routing.module.ts --save docs/routes.md

# ステップ4: 技術的問題をチェック
npx ts-node src/detect-circular-deps.ts ./src
```

### 🔧 シナリオ 2: リファクタリング前の現状分析

```bash
# 現状をスナップショット
mkdir -p reports/before
npx ts-node src/analyze-project.ts ./src --output json --save reports/before/analysis.json
npx ts-node src/analyze-modules.ts ./src --save reports/before/modules.md
npx ts-node src/detect-circular-deps.ts ./src --save reports/before/circular-deps.txt

# リファクタリング実施...

# 結果を比較
mkdir -p reports/after
npx ts-node src/analyze-project.ts ./src --output json --save reports/after/analysis.json
npx ts-node src/analyze-modules.ts ./src --save reports/after/modules.md
npx ts-node src/detect-circular-deps.ts ./src --save reports/after/circular-deps.txt

# 差分を確認
diff reports/before/circular-deps.txt reports/after/circular-deps.txt
```

### 🚀 シナリオ 3: CI/CDパイプライン統合

**package.json**:
```json
{
  "scripts": {
    "analyze": "ts-node src/analyze-project.ts ./src --output md",
    "analyze:modules": "ts-node src/analyze-modules.ts ./src",
    "check:circular": "ts-node src/detect-circular-deps.ts ./src",
    "analyze:full": "npm run analyze && npm run analyze:modules && npm run check:circular"
  }
}
```

**GitHub Actions (.github/workflows/code-quality.yml)**:
```yaml
name: Code Quality

on: [pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Install Dependencies
        run: npm install

      - name: Check Circular Dependencies
        run: npm run check:circular

      - name: Generate Analysis Report
        run: npm run analyze:full

      - name: Upload Report
        uses: actions/upload-artifact@v3
        with:
          name: analysis-report
          path: reports/
```

### 📈 シナリオ 4: 定期的なプロジェクト成長トラッキング

```bash
# 毎週実行するスクリプト (weekly-analysis.sh)
#!/bin/bash

DATE=$(date +%Y%m%d)
REPORT_DIR="reports/weekly/$DATE"

mkdir -p "$REPORT_DIR"

echo "Running weekly analysis for $DATE..."

npx ts-node src/analyze-project.ts ./src --output json --save "$REPORT_DIR/project.json"
npx ts-node src/analyze-modules.ts ./src --save "$REPORT_DIR/modules.md"
npx ts-node src/detect-circular-deps.ts ./src --save "$REPORT_DIR/circular-deps.txt" || true

echo "Analysis complete: $REPORT_DIR"

# 前週との比較
if [ -d "reports/weekly/last" ]; then
  echo "Comparing with last week..."
  jq '.summary' "$REPORT_DIR/project.json" > "$REPORT_DIR/summary.json"
  jq '.summary' reports/weekly/last/project.json > "$REPORT_DIR/summary-last.json"
fi

ln -sfn "$DATE" reports/weekly/last
```

### 🔍 シナリオ 5: 特定機能の依存関係調査

```bash
# Usersモジュールだけを深掘り
npx ts-node src/analyze-modules.ts ./src/app/features/users
npx ts-node src/analyze-routing.ts ./src/app/features/users/users-routing.module.ts
npx ts-node src/detect-circular-deps.ts ./src/app/features/users

# 個別ファイルの詳細分析（従来ツール使用）
npx ts-node src/analyze-ts-role.ts ./src/app/features/users/services/user.service.ts
npx ts-node src/list-ts-functions.ts ./src/app/features/users/services/user.service.ts
```

---

## 測定メトリクスの解釈ガイド

### プロジェクト規模の目安

| メトリクス | 小規模 | 中規模 | 大規模 | 超大規模 |
|-----------|--------|--------|--------|----------|
| TypeScriptファイル数 | < 100 | 100-500 | 500-1000 | 1000+ |
| 総行数 | < 10K | 10K-50K | 50K-100K | 100K+ |
| モジュール数 | < 10 | 10-30 | 30-50 | 50+ |
| コンポーネント数 | < 20 | 20-100 | 100-200 | 200+ |
| サービス数 | < 10 | 10-30 | 30-50 | 50+ |

### 警告サイン

#### 🔴 緊急対応が必要
- ✅ **循環依存が10個以上**: アーキテクチャの根本的な見直しが必要
- ✅ **Serviceレベルの循環依存**: 即座に修正すべき
- ✅ **Moduleが50個以上**: 過度な分割、統合を検討

#### ⚠️ 注意が必要
- ✅ **Componentレベルの循環依存**: 時間がある時に解消
- ✅ **1ファイル500行以上**: 分割を検討
- ✅ **1モジュール20コンポーネント以上**: Feature分割を検討

#### ✅ 健全な状態
- ✅ **循環依存が0-2個**
- ✅ **CoreModule/SharedModuleが明確に分離**
- ✅ **Featureモジュールが適切に分割**
- ✅ **遅延ロードが効果的に使われている**

---

## パフォーマンス特性

| プロジェクト規模 | ファイル数 | 実行時間 (推定) |
|-----------------|-----------|----------------|
| 小規模 | ~100 | < 0.5秒 |
| 中規模 | ~500 | 1-2秒 |
| 大規模 | ~1000 | 2-5秒 |
| 超大規模 | 3000+ | 5-15秒 |

**メモリ使用量**: 通常100MB以下（大規模プロジェクトでも500MB以下）

---

## 個別解析ツールの使用例

### 特定ファイルの詳細分析

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
