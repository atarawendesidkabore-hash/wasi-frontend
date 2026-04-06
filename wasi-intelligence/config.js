// WASI Backend — API endpoint configuration
// Update WASI_CORE_API_BASE after Azure deployment with your Container App URL:
//   https://wasi-backend-api.<unique-id>.eastus.azurecontainerapps.io
//
// Get your URL by running:
//   az containerapp show --name wasi-backend-api --resource-group wasi-rg --query "properties.configuration.ingress.fqdn" -o tsv

window.WASI_CORE_API_BASE = '';   // ← paste your Azure URL here after setup
window.WASI_AI_API_BASE   = '';   // ← same URL (used by wasi-ai-integration.js)
