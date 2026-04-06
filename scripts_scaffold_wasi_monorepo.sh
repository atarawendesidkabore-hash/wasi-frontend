#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-wasi-ecosystem}"
mkdir -p "$ROOT_DIR"
cd "$ROOT_DIR"

cat > package.json <<'JSON'
{
  "name": "wasi-ecosystem",
  "private": true,
  "packageManager": "pnpm@10.0.0",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "^2.5.4",
    "typescript": "^5.8.2"
  }
}
JSON

cat > pnpm-workspace.yaml <<'YAML'
packages:
  - "apps/*"
  - "packages/*"
YAML

cat > turbo.json <<'JSON'
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "test": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
JSON

cat > tsconfig.base.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["node"]
  }
}
JSON

cat > .gitignore <<'TXT'
node_modules
.pnpm-store
dist
build
.turbo
coverage
.env
.env.*
TXT

mkdir -p apps packages

create_module() {
  local app_dir="$1"
  local app_name="$2"
  local app_desc="$3"
  local module_slug="$4"

  mkdir -p "apps/$app_dir/src"/{components,hooks,services,types,utils,config}

  cat > "apps/$app_dir/package.json" <<JSON
{
  "name": "@wasi/$app_dir",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "echo \"build $app_dir\"",
    "dev": "echo \"dev $app_dir\"",
    "lint": "echo \"lint $app_dir\"",
    "test": "echo \"test $app_dir\"",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "decimal.js": "^10.4.3"
  },
  "devDependencies": {
    "@types/node": "^22.13.10",
    "typescript": "^5.8.2"
  }
}
JSON

  cat > "apps/$app_dir/README.md" <<MD
# $app_name

$app_desc

## Stack
- TypeScript (strict)
- Monetary values in bigint centimes (XOF)
- UTC storage, Africa/Ouagadougou display
MD

  cat > "apps/$app_dir/.env.example" <<ENV
NODE_ENV=development
MODULE_NAME=$app_dir
API_BASE_URL=http://localhost:8000/api/v1/$module_slug
JWT_ISSUER=wasi-auth
JWT_AUDIENCE=wasi-clients
ENV

  cat > "apps/$app_dir/tsconfig.json" <<JSON
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
JSON

  touch "apps/$app_dir/src/index.ts"
  touch "apps/$app_dir/src/components/index.ts"
  touch "apps/$app_dir/src/hooks/index.ts"
  touch "apps/$app_dir/src/services/index.ts"
  touch "apps/$app_dir/src/types/index.ts"
  touch "apps/$app_dir/src/utils/index.ts"
  touch "apps/$app_dir/src/config/constants.ts"
  touch "apps/$app_dir/src/types/$module_slug.types.ts"
}

create_module "wasi-core" "WASI Core" "Financial intelligence terminal for West Africa (BRVM/UEMOA/ECOWAS)." "wasi"
create_module "afritrade" "AfriTrade" "Trading app for BRVM, US stocks, crypto, and mobile money rails." "afritrade"
create_module "africompta" "AfriCompta" "SYSCOHADA-compliant accounting with AI assistance." "africompta"
create_module "afritax" "AfriTax" "OHADA-zone tax dashboard with calculators and Excel export." "afritax"
create_module "fiscia-pro" "FiscIA Pro" "French tax professional SaaS with CGI-oriented tooling." "fiscia-pro"
create_module "sib-sci" "SIB-SCI" "Commercial real estate portfolio management (Ouagadougou)." "sib-sci"
create_module "africredit" "AfriCredit" "Microfinance management platform with PAR metrics and impact tracking." "africredit"

mkdir -p packages/{ui,types,config,auth-client}/{src,src/components,src/tokens}

cat > packages/ui/package.json <<'JSON'
{
  "name": "@wasi/ui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "build": "echo \"build @wasi/ui\"",
    "test": "echo \"test @wasi/ui\"",
    "typecheck": "tsc --noEmit"
  }
}
JSON

touch packages/ui/src/index.ts
touch packages/ui/src/tokens/colors.ts
touch packages/ui/src/components/WASICard.tsx
touch packages/ui/src/components/MetricBadge.tsx
touch packages/ui/src/components/CurrencyDisplay.tsx
touch packages/ui/src/components/DemoLabel.tsx
touch packages/ui/src/components/CreditGradeBadge.tsx
touch packages/ui/src/components/RiskIndicator.tsx

cat > packages/types/package.json <<'JSON'
{
  "name": "@wasi/types",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts"
}
JSON

touch packages/types/src/index.ts
touch packages/types/src/api.types.ts
touch packages/types/src/finance.types.ts
touch packages/types/src/credit.types.ts
touch packages/types/src/ohada.types.ts

cat > packages/config/package.json <<'JSON'
{
  "name": "@wasi/config",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts"
}
JSON

touch packages/config/src/index.ts
touch packages/config/src/constants.ts
touch packages/config/src/countries.ts
touch packages/config/src/rates.ts

cat > packages/auth-client/package.json <<'JSON'
{
  "name": "@wasi/auth-client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts"
}
JSON

touch packages/auth-client/src/index.ts
touch packages/auth-client/src/jwt.ts
touch packages/auth-client/src/session.ts

cat > README.md <<'MD'
# WASI Ecosystem Monorepo

Modules:
- M1 WASI Core
- M2 AfriTrade
- M3 AfriCompta
- M4 AfriTax
- M5 FiscIA Pro
- M6 SIB-SCI
- M7 AfriCredit

## Quick start
1. `pnpm install`
2. `pnpm dev`
3. `pnpm test`
MD

echo "Scaffold complete at: $(pwd)"
