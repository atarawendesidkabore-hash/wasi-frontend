#!/usr/bin/env bash
# ------------------------------------------------------------
# WASI Ecosystem monorepo scaffold
# ------------------------------------------------------------
# Run from an empty directory (or a fresh git repo). The script
# creates:
#   - apps/M1...M7        (Vite + React + TS app shells)
#   - packages/ui         (shared UI package + design tokens)
#   - packages/types      (shared types package)
#   - packages/config     (shared config package)
#   - packages/auth-client(shared auth helpers package)
#   - root workspace files (.gitignore, package.json, tsconfig, README)
# ------------------------------------------------------------

set -euo pipefail

require_empty_workspace() {
  if [ -n "$(find . -mindepth 1 -maxdepth 1 -not -name '.git' -print -quit)" ]; then
    echo "Error: current directory is not empty."
    echo "Run this script in an empty directory or a fresh repo."
    exit 1
  fi
}

write_root_files() {
  cat > package.json <<'EOF'
{
  "name": "wasi-ecosystem",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "npm run dev --workspaces",
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces"
  },
  "devDependencies": {
    "@types/jest": "^29.5.12",
    "typescript": "^5.6.3"
  }
}
EOF

  cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "@wasi/ui": ["packages/ui/src/index.ts"],
      "@wasi/types": ["packages/types/src/index.ts"],
      "@wasi/config": ["packages/config/src/index.ts"],
      "@wasi/auth-client": ["packages/auth-client/src/index.ts"]
    }
  },
  "include": [
    "apps/*/src",
    "packages/*/src"
  ]
}
EOF

  cat > .gitignore <<'EOF'
node_modules
dist
.env
.vscode
*.log
coverage
.DS_Store
EOF

  cat > README.md <<'EOF'
# WASI Ecosystem Monorepo

This repository contains the 7 WASI modules and shared workspace packages.

## Getting Started

```bash
npm install
cd apps/M1_WASI
npm run dev
```

## Modules

| Module | Path | Description |
|---|---|---|
| M1 - WASI Core | apps/M1_WASI | Market dashboard, risk intelligence terminal |
| M2 - AfriTrade | apps/M2_AfriTrade | Trading app (BRVM + US + crypto + MoMo) |
| M3 - AfriCompta | apps/M3_AfriCompta | SYSCOHADA accounting |
| M4 - AfriTax | apps/M4_AfriTax | OHADA tax compliance dashboard |
| M5 - FiscIA Pro | apps/M5_FiscIA_Pro | French tax professional SaaS |
| M6 - SIB SCI | apps/M6_SIB_SCI | Real estate portfolio tooling |
| M7 - AfriCredit | apps/M7_AfriCredit | Microfinance workflows and PAR metrics |

## Shared Packages

| Package | Path | Purpose |
|---|---|---|
| @wasi/ui | packages/ui | Shared UI components + design tokens |
| @wasi/types | packages/types | Shared TS contracts |
| @wasi/config | packages/config | Shared constants/config |
| @wasi/auth-client | packages/auth-client | Auth helper client |
EOF
}

write_shared_package() {
  local pkg_dir="$1"
  local pkg_name="$2"
  local pkg_desc="$3"

  mkdir -p "${pkg_dir}/src"

  cat > "${pkg_dir}/package.json" <<EOF
{
  "name": "${pkg_name}",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "build": "echo \"build ${pkg_name}\"",
    "test": "echo \"test ${pkg_name}\""
  },
  "devDependencies": {
    "typescript": "^5.6.3"
  }
}
EOF

  cat > "${pkg_dir}/README.md" <<EOF
# ${pkg_name}

${pkg_desc}
EOF

  cat > "${pkg_dir}/.env.example" <<'EOF'
NODE_ENV=development
EOF

  cat > "${pkg_dir}/src/utils.ts" <<'EOF'
export const noop = (): void => {};
EOF

  cat > "${pkg_dir}/src/index.ts" <<'EOF'
export * from "./utils";
EOF
}

write_ui_package_extras() {
  local ui_dir="packages/ui/src"
  mkdir -p "${ui_dir}/components"

  cat > "${ui_dir}/designTokens.ts" <<'EOF'
export const colors = {
  primaryGreen: "#1A7A4A",
  secondaryGold: "#C9A84C",
  darkBackground: "#0D2B1A",
  lightSurface: "#E8F5EE",
  danger: "#DC2626",
  warning: "#F59E0B",
};
EOF

  cat > "${ui_dir}/components/WASICard.tsx" <<'EOF'
import React from "react";

type WASICardProps = {
  title: string;
  headerColor?: string;
  children: React.ReactNode;
};

export const WASICard: React.FC<WASICardProps> = ({
  title,
  headerColor = "#1A7A4A",
  children,
}) => (
  <div style={{ border: "1px solid #d4d4d4", borderRadius: 8, overflow: "hidden" }}>
    <div style={{ background: headerColor, color: "#fff", padding: "10px 12px", fontWeight: 700 }}>
      {title}
    </div>
    <div style={{ padding: 12 }}>{children}</div>
  </div>
);
EOF

  cat > "${ui_dir}/components/DemoLabel.tsx" <<'EOF'
import React from "react";

export const DemoLabel: React.FC = () => (
  <span style={{ color: "#DC2626", fontWeight: 700 }}>
    DONNEES SIMULEES - NON REELLES
  </span>
);
EOF

  cat > "${ui_dir}/components/CurrencyDisplay.tsx" <<'EOF'
import React from "react";

type CurrencyDisplayProps = {
  amount: bigint;
  currency?: string;
  locale?: string;
};

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
  amount,
  currency = "XOF",
  locale = "fr-FR",
}) => {
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount));

  return <span>{formatted} {currency}</span>;
};
EOF

  cat > "${ui_dir}/index.ts" <<'EOF'
export * from "./designTokens";
export * from "./components/WASICard";
export * from "./components/DemoLabel";
export * from "./components/CurrencyDisplay";
export * from "./utils";
EOF
}

module_npm_name() {
  # Transform M1_WASI -> m1-wasi
  local raw="$1"
  echo "${raw}" | tr '[:upper:]' '[:lower:]' | tr '_' '-'
}

write_app_scaffold() {
  local app_key="$1"
  local app_desc="$2"
  local app_dir="apps/${app_key}"
  local src_dir="${app_dir}/src"
  local npm_name
  npm_name="$(module_npm_name "$app_key")"

  mkdir -p "${src_dir}/components" "${src_dir}/hooks" "${src_dir}/services" "${src_dir}/types" "${src_dir}/utils"

  cat > "${app_dir}/package.json" <<EOF
{
  "name": "@wasi/${npm_name}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "jest"
  },
  "dependencies": {
    "axios": "^1.7.7",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.9",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.3",
    "jest": "^29.7.0",
    "typescript": "^5.6.3",
    "vite": "^5.4.8"
  }
}
EOF

  cat > "${app_dir}/README.md" <<EOF
# ${app_key}

${app_desc}
EOF

  cat > "${app_dir}/.env.example" <<'EOF'
VITE_API_BASE_URL=http://localhost:8000
NODE_ENV=development
EOF

  cat > "${app_dir}/index.html" <<EOF
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${app_key}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

  cat > "${app_dir}/tsconfig.json" <<'EOF'
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "types": ["vite/client", "jest", "node"]
  },
  "include": ["src"]
}
EOF

  cat > "${app_dir}/vite.config.ts" <<'EOF'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  }
});
EOF

  cat > "${src_dir}/main.tsx" <<'EOF'
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF

  cat > "${src_dir}/App.tsx" <<EOF
import React from "react";
import { ExampleComponent } from "./components/ExampleComponent";

export const App: React.FC = () => {
  return (
    <main style={{ fontFamily: "sans-serif", padding: 24 }}>
      <h1>${app_key}</h1>
      <p>${app_desc}</p>
      <ExampleComponent />
    </main>
  );
};
EOF

  cat > "${src_dir}/components/ExampleComponent.tsx" <<EOF
import React from "react";

export const ExampleComponent: React.FC = () => (
  <section style={{ border: "1px dashed #aaa", padding: 12, borderRadius: 8 }}>
    Placeholder component for ${app_key}.
  </section>
);
EOF

  cat > "${src_dir}/services/api.ts" <<'EOF'
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});
EOF

  cat > "${src_dir}/utils/helpers.ts" <<'EOF'
export const identity = <T,>(value: T): T => value;
EOF

  cat > "${src_dir}/utils/index.ts" <<'EOF'
export * from "./helpers";
EOF

  cat > "${src_dir}/index.ts" <<'EOF'
export * from "./components/ExampleComponent";
export * from "./services/api";
export * from "./utils";
EOF
}

main() {
  require_empty_workspace

  echo "Creating root workspace files..."
  mkdir -p apps packages
  write_root_files

  echo "Creating shared packages..."
  write_shared_package "packages/ui" "@wasi/ui" "Shared UI library for all WASI modules."
  write_shared_package "packages/types" "@wasi/types" "Shared TypeScript contracts."
  write_shared_package "packages/config" "@wasi/config" "Shared constants and config values."
  write_shared_package "packages/auth-client" "@wasi/auth-client" "Shared auth client helpers."
  write_ui_package_extras

  echo "Creating application modules (M1-M7)..."
  write_app_scaffold "M1_WASI" "WASI Core - market dashboard and credit engine UI"
  write_app_scaffold "M2_AfriTrade" "AfriTrade - trading app (BRVM + US + crypto + MoMo)"
  write_app_scaffold "M3_AfriCompta" "AfriCompta - SYSCOHADA accounting"
  write_app_scaffold "M4_AfriTax" "AfriTax - tax compliance dashboard"
  write_app_scaffold "M5_FiscIA_Pro" "FiscIA Pro - French tax professional SaaS"
  write_app_scaffold "M6_SIB_SCI" "SIB SCI - real estate portfolio manager"
  write_app_scaffold "M7_AfriCredit" "AfriCredit - microfinance loan workflow"

  echo ""
  echo "Monorepo scaffold created."
  echo "Next steps:"
  echo "  1) npm install"
  echo "  2) cd apps/M1_WASI && npm run dev"
  echo "  3) Replace placeholders with real domain logic"
}

main "$@"
