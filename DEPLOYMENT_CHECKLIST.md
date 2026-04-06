# WASI Production Deployment Checklist

## 1. Generate Secrets

Run these locally to generate strong secrets:

```bash
# JWT secret (required)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Password pepper (recommended)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

## 2. Configure Render Environment Variables

In Render dashboard for **wasi-web-api**, set:

| Variable | Value | Required |
|----------|-------|----------|
| `BANKING_JWT_SECRET` | (generated above) | YES |
| `BANKING_PASSWORD_PEPPER` | (generated above) | YES |
| `CORS_ALLOWED_ORIGINS` | `https://wasi-web.onrender.com` | YES |
| `NODE_ENV` | `production` | YES |
| `PORT` | `8010` | YES |
| `BANKING_JWT_EXPIRES_IN` | `12h` | optional |
| `AUTH_RATE_LIMIT_MAX_ATTEMPTS` | `5` | optional |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `1800000` | optional |
| `ALERT_LARGE_TRANSFER_CENTIMES` | `10000000` | optional |

For **wasi-web** (frontend), set:

| Variable | Value |
|----------|-------|
| `VITE_WASI_BANKING_API_URL` | `https://wasi-web-api.onrender.com` |

## 3. Revoke Exposed Credentials

- [ ] Revoke Anthropic API key at https://console.anthropic.com/settings/keys
- [ ] Revoke GitHub PAT at https://github.com/settings/tokens
- [ ] Change all demo passwords if ever used in production

## 4. Verify Security

- [ ] CORS only allows production frontend domain
- [ ] JWT secret is 32+ bytes of randomness
- [ ] Demo users are disabled (`WASI_ALLOW_DEMO_USERS` unset or false)
- [ ] `.env` files are NOT in git (check with `git ls-files .env`)
- [ ] Security headers visible in browser DevTools > Network tab
- [ ] Rate limiting works (test with 6+ rapid login attempts)

## 5. Push & Deploy

```bash
# Push WASI monorepo
cd ~/OneDrive/Desktop/WASI
git push origin main

# Push wasi-cli
cd ~/OneDrive/Desktop/wasi-cli
git push origin main

# Push wasi-platform (remote URL already cleaned)
cd ~/OneDrive/Desktop/WASI/wasi-platform
git push origin main
```

## 6. Post-Deploy Verification

```bash
# Health check
curl https://wasi-web-api.onrender.com/api/health

# Platform health (needs auth)
curl -H "Authorization: Bearer <token>" \
  https://wasi-web-api.onrender.com/api/v1/platform/health

# Verify security headers
curl -I https://wasi-web.onrender.com | grep -i "x-content-type\|x-frame\|strict-transport"
```

## 7. Admin Dashboard Access

Navigate to `https://wasi-web.onrender.com/?app=admin`

Login with a MANAGER-role account to access:
- System overview & health metrics
- User management (roles, activation)
- Audit log search
- Security alerts
- Transaction CSV export
