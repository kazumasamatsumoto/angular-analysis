# Angular Test Project - 充実化計画

最終更新: 2025-10-22

## 📊 現状分析

### 既存ファイル数
- **総ファイル数**: 56ファイル（spec除く）
- **TypeScriptファイル**: 48ファイル
- **HTMLファイル**: 5ファイル
- **CSSファイル**: 3ファイル

### 現在の構成

```
angular-test/src/app/
├── app.module.ts                    ✅ ルートモジュール
├── app-routing.module.ts            ✅ ルートルーティング
├── app.routes.ts                    ✅ Standalone routes
├── app.component.ts                 ✅ ルートコンポーネント
│
├── core/                            ✅ Coreモジュール
│   ├── core.module.ts
│   ├── services/                    ✅ 4サービス
│   │   ├── auth.service.ts
│   │   ├── data.service.ts
│   │   ├── logger.service.ts
│   │   └── storage.service.ts
│   └── guards/                      ✅ 2ガード
│       ├── auth.guard.ts
│       └── admin.guard.ts
│
├── shared/                          ✅ Sharedモジュール
│   ├── shared.module.ts
│   ├── components/                  ✅ 4コンポーネント
│   │   ├── button/
│   │   ├── card/
│   │   ├── loader/
│   │   └── modal/
│   ├── directives/                  ✅ 1ディレクティブ
│   │   └── highlight.directive.ts
│   └── pipes/                       ✅ 2パイプ
│       ├── date-format.pipe.ts
│       └── truncate.pipe.ts
│
└── features/                        ✅ Featureモジュール (3つ)
    ├── products/
    │   ├── products.module.ts
    │   ├── products-routing.module.ts
    │   ├── products-list/
    │   ├── product-detail/
    │   ├── product-form/
    │   └── services/product.service.ts
    ├── users/
    │   ├── users.module.ts
    │   ├── users-routing.module.ts
    │   ├── users-list/
    │   ├── user-detail/
    │   ├── user-form/
    │   └── services/user.service.ts
    ├── orders/
    │   ├── orders.module.ts
    │   ├── orders-routing.module.ts
    │   ├── orders-list/
    │   ├── order-detail/
    │   ├── order-checkout/
    │   └── services/order.service.ts
    └── dashboard/
        ├── dashboard.module.ts
        ├── dashboard.component.ts
        └── services/
            ├── dashboard.service.ts
            └── stats.service.ts
```

---

## ❌ 不足している要素

### 1. テンプレートファイルの不足 🔴 **重要**

#### 問題点
- ほとんどのコンポーネントがインラインテンプレート
- 外部HTMLファイルは5つのみ
- **analyze-template-usage.ts** のテストが不十分

#### 必要なファイル
- 各コンポーネントに対応する `.html` ファイル
- 複雑なテンプレート構造のサンプル
- ネストされたコンポーネント使用例

---

### 2. スタイルファイルの不足 🔴 **重要**

#### 問題点
- CSSファイルは3つのみ
- ほとんどがインラインスタイル
- **summarize-css.ts** のテストが不十分

#### 必要なファイル
- 各コンポーネントに対応する `.css` / `.scss` ファイル
- グローバルスタイル
- テーマファイル

---

### 3. RxJS使用パターンの不足 🟡 **中程度**

#### 問題点
- Subscription漏れのサンプルがない
- 複雑なオペレーターチェーンがない
- **analyze-rxjs.ts** の検出精度テストが不十分

#### 必要なファイル
- メモリリークのあるコンポーネント（悪い例）
- 正しくunsubscribeしているコンポーネント（良い例）
- BehaviorSubject/ReplaySubjectの使用例
- 複雑なRxJSオペレーター使用例

---

### 4. 循環依存のサンプル不足 🟡 **中程度**

#### 問題点
- 意図的な循環依存のサンプルがない
- **detect-circular-deps.ts** のテストができない

#### 必要なファイル
- ServiceA ⇔ ServiceB の循環依存
- ModuleA ⇔ ModuleB の循環依存（警告レベル）
- ComponentA ⇔ ComponentB の循環依存

---

### 5. Interceptor / Resolver の不足 🟢 **低優先**

#### 問題点
- Interceptorが1つだけ
- Resolverが全くない

#### 必要なファイル
- HTTP Interceptor（認証トークン付与）
- Error Interceptor
- Resolver（データプリロード）

---

### 6. Standalone コンポーネントの不足 🟢 **低優先**

#### 問題点
- Angular 14+のStandaloneコンポーネントサンプルが少ない
- 新しいAngularパターンのテストができない

#### 必要なファイル
- Standalone component
- Standalone directive
- Standalone pipe

---

### 7. 未使用コードのサンプル不足 🟡 **中程度**

#### 問題点
- 意図的に未使用のコンポーネント/サービスがない
- **detect-unused-code.ts** の検出精度テストができない

#### 必要なファイル
- 未使用コンポーネント
- 未使用サービス
- 未使用パイプ

---

### 8. 大規模ファイルの不足 🟢 **低優先**

#### 問題点
- 大きなファイル（500行以上）のサンプルがない
- パフォーマンステストができない

#### 必要なファイル
- 大規模コンポーネント（500行+）
- 複雑なサービス（多数のメソッド）

---

## 🎯 優先度別実装計画

### 🔴 優先度1: テンプレート＆スタイル充実（分析ツールの基本テスト）

#### 作成するファイル (20ファイル)

1. **Products Feature**
   - `products-list/products-list.component.html` ← 新規
   - `products-list/products-list.component.css` ← 新規
   - `product-detail/product-detail.component.html` ← 新規
   - `product-detail/product-detail.component.css` ← 新規
   - `product-form/product-form.component.html` ← 新規
   - `product-form/product-form.component.css` ← 新規

2. **Users Feature**
   - `users-list/users-list.component.html` ← 新規
   - `users-list/users-list.component.css` ← 新規
   - `user-detail/user-detail.component.html` ← 新規
   - `user-detail/user-detail.component.css` ← 新規
   - `user-form/user-form.component.html` ← 新規
   - `user-form/user-form.component.css` ← 新規

3. **Orders Feature**
   - `orders-list/orders-list.component.html` ← 新規
   - `orders-list/orders-list.component.css` ← 新規
   - `order-detail/order-detail.component.html` ← 新規
   - `order-detail/order-detail.component.css` ← 新規
   - `order-checkout/order-checkout.component.html` ← 新規
   - `order-checkout/order-checkout.component.css` ← 新規

4. **Dashboard**
   - `dashboard/dashboard.component.html` ← 新規
   - `dashboard/dashboard.component.css` ← 新規

---

### 🟡 優先度2: RxJS & 循環依存サンプル（高度な分析のテスト）

#### 作成するファイル (10ファイル)

1. **RxJS Examples**
   - `features/examples/rxjs-good/rxjs-good.component.ts` ← 新規（正しい例）
   - `features/examples/rxjs-bad/rxjs-bad.component.ts` ← 新規（メモリリーク）
   - `features/examples/rxjs-complex/rxjs-complex.component.ts` ← 新規（複雑なオペレーター）
   - `core/services/state.service.ts` ← 新規（BehaviorSubject使用）
   - `core/services/notification.service.ts` ← 新規（Subject使用）

2. **Circular Dependency Examples**
   - `features/examples/circular/service-a.service.ts` ← 新規
   - `features/examples/circular/service-b.service.ts` ← 新規（A→B→A）
   - `features/examples/circular/component-x.component.ts` ← 新規
   - `features/examples/circular/component-y.component.ts` ← 新規（X→Y→X）
   - `features/examples/examples.module.ts` ← 新規

---

### 🟢 優先度3: 未使用コード & 高度な機能（検出精度向上）

#### 作成するファイル (15ファイル)

1. **Unused Code Examples**
   - `features/unused/unused-component.component.ts` ← 新規（未使用）
   - `features/unused/unused-service.service.ts` ← 新規（未使用）
   - `features/unused/unused-pipe.pipe.ts` ← 新規（未使用）
   - `features/unused/unused.module.ts` ← 新規

2. **Interceptors & Resolvers**
   - `core/interceptors/auth-token.interceptor.ts` ← 新規
   - `core/interceptors/error.interceptor.ts` ← 新規
   - `core/interceptors/logging.interceptor.ts` ← 新規
   - `core/resolvers/user.resolver.ts` ← 新規
   - `core/resolvers/product.resolver.ts` ← 新規
   - `core/resolvers/data.resolver.ts` ← 新規

3. **Standalone Components**
   - `standalone/standalone-button.component.ts` ← 新規
   - `standalone/standalone-card.component.ts` ← 新規
   - `standalone/standalone-list.component.ts` ← 新規

4. **Large Files**
   - `features/complex/complex-form.component.ts` ← 新規（500行+）
   - `features/complex/complex-service.service.ts` ← 新規（多数のメソッド）

---

## 📋 詳細な追加ファイルリスト

### Phase 1: テンプレート＆スタイル (20ファイル)

```
src/app/features/products/
├── products-list/
│   ├── products-list.component.html     ← NEW
│   └── products-list.component.css      ← NEW
├── product-detail/
│   ├── product-detail.component.html    ← NEW
│   └── product-detail.component.css     ← NEW
└── product-form/
    ├── product-form.component.html      ← NEW
    └── product-form.component.css       ← NEW

src/app/features/users/
├── users-list/
│   ├── users-list.component.html        ← NEW
│   └── users-list.component.css         ← NEW
├── user-detail/
│   ├── user-detail.component.html       ← NEW
│   └── user-detail.component.css        ← NEW
└── user-form/
    ├── user-form.component.html         ← NEW
    └── user-form.component.css          ← NEW

src/app/features/orders/
├── orders-list/
│   ├── orders-list.component.html       ← NEW
│   └── orders-list.component.css        ← NEW
├── order-detail/
│   ├── order-detail.component.html      ← NEW
│   └── order-detail.component.css       ← NEW
└── order-checkout/
    ├── order-checkout.component.html    ← NEW
    └── order-checkout.component.css     ← NEW

src/app/features/dashboard/
├── dashboard.component.html             ← NEW
└── dashboard.component.css              ← NEW

src/app/shared/components/
├── loader/
│   ├── loader.component.html            ← NEW
│   └── loader.component.css             ← NEW
└── modal/
    ├── modal.component.html             ← NEW
    └── modal.component.css              ← NEW
```

### Phase 2: RxJS & 循環依存 (10ファイル)

```
src/app/features/examples/
├── examples.module.ts                   ← NEW
├── examples-routing.module.ts           ← NEW
├── rxjs-good/
│   ├── rxjs-good.component.ts           ← NEW (正しいunsubscribe)
│   ├── rxjs-good.component.html         ← NEW
│   └── rxjs-good.component.css          ← NEW
├── rxjs-bad/
│   ├── rxjs-bad.component.ts            ← NEW (メモリリーク)
│   ├── rxjs-bad.component.html          ← NEW
│   └── rxjs-bad.component.css           ← NEW
├── rxjs-complex/
│   ├── rxjs-complex.component.ts        ← NEW (複雑なオペレーター)
│   ├── rxjs-complex.component.html      ← NEW
│   └── rxjs-complex.component.css       ← NEW
└── circular/
    ├── service-a.service.ts             ← NEW (循環依存A)
    ├── service-b.service.ts             ← NEW (循環依存B)
    ├── component-x.component.ts         ← NEW
    └── component-y.component.ts         ← NEW

src/app/core/services/
├── state.service.ts                     ← NEW (BehaviorSubject)
└── notification.service.ts              ← NEW (Subject)
```

### Phase 3: 高度な機能 (15ファイル)

```
src/app/features/unused/
├── unused.module.ts                     ← NEW
├── unused-component.component.ts        ← NEW
├── unused-service.service.ts            ← NEW
└── unused-pipe.pipe.ts                  ← NEW

src/app/core/interceptors/
├── auth-token.interceptor.ts            ← NEW
├── error.interceptor.ts                 ← NEW
└── logging.interceptor.ts               ← NEW

src/app/core/resolvers/
├── user.resolver.ts                     ← NEW
├── product.resolver.ts                  ← NEW
└── data.resolver.ts                     ← NEW

src/app/standalone/
├── standalone-button.component.ts       ← NEW
├── standalone-card.component.ts         ← NEW
└── standalone-list.component.ts         ← NEW

src/app/features/complex/
├── complex-form.component.ts            ← NEW (500行+)
├── complex-form.component.html          ← NEW
├── complex-form.component.css           ← NEW
├── complex-service.service.ts           ← NEW (多数メソッド)
└── complex.module.ts                    ← NEW
```

---

## 📊 追加後の期待される状態

### ファイル数
- **現在**: 56ファイル
- **Phase 1後**: 76ファイル (+20)
- **Phase 2後**: 86ファイル (+10)
- **Phase 3後**: 101ファイル (+15)
- **合計増加**: **+45ファイル**

### 解析ツールのテストカバレッジ

| ツール | 現状 | Phase 1後 | Phase 2後 | Phase 3後 |
|--------|------|-----------|-----------|-----------|
| analyze-project.ts | ✅ 60% | ✅ 85% | ✅ 90% | ✅ 95% |
| analyze-modules.ts | ✅ 70% | ✅ 75% | ✅ 85% | ✅ 90% |
| analyze-routing.ts | ✅ 80% | ✅ 85% | ✅ 90% | ✅ 95% |
| detect-circular-deps.ts | ❌ 10% | ❌ 10% | ✅ 90% | ✅ 95% |
| analyze-template-usage.ts | ❌ 30% | ✅ 90% | ✅ 95% | ✅ 95% |
| trace-service-usage.ts | ✅ 60% | ✅ 70% | ✅ 85% | ✅ 90% |
| detect-unused-code.ts | ❌ 20% | ❌ 25% | ❌ 30% | ✅ 90% |
| analyze-rxjs.ts | ❌ 20% | ❌ 25% | ✅ 95% | ✅ 95% |

---

## 🎯 実装の進め方

### Step 1: Phase 1 - テンプレート＆スタイル
1. 既存のインラインテンプレートを外部ファイル化
2. 各コンポーネントに対応するHTMLファイルを作成
3. 各コンポーネントに対応するCSSファイルを作成
4. リアルなHTMLコンテンツ（フォーム、テーブル、リストなど）

### Step 2: Phase 2 - RxJS & 循環依存
1. `examples` フィーチャーモジュールを作成
2. RxJSの良い例・悪い例・複雑な例を実装
3. 意図的な循環依存を作成
4. BehaviorSubject/Subjectを使用するサービスを追加

### Step 3: Phase 3 - 高度な機能
1. 未使用コードのモジュールを作成（実際には使用しない）
2. Interceptor実装
3. Resolver実装
4. Standaloneコンポーネント作成
5. 大規模ファイルを作成

---

## ✅ 期待される効果

### 1. 解析ツールの信頼性向上
- すべてのツールが実際のAngularプロジェクトで検証可能
- エッジケースのテストが可能

### 2. ドキュメント・デモの充実
- README.mdに実例を追加可能
- ベンチマーク結果が具体的に

### 3. CI/CDテストの自動化
- テストプロジェクトで自動テスト実行
- リグレッションテスト可能

### 4. ユーザーへの価値提供
- より信頼性の高いツール
- 実践的なサンプルコード

---

## 📝 備考

### 実装時の注意点
- インラインテンプレート/スタイルを残すファイルもいくつか残す（両方のパターンをテスト）
- リアリティのあるコード（実際のプロジェクトに近い）
- コメントで「テスト用」であることを明記

### テストシナリオの作成
- 各Phaseごとに`scripts/test-phase-X.sh`を作成
- 期待される出力と実際の出力を比較
- CI/CDに統合

---

**次のアクション**: Phase 1から順次実装開始
