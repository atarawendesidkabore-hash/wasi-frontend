#!/bin/bash
# Azure Container Apps — one-time setup for wasi-backend-api
# Run this once after creating your Azure free account.
# Requires: Azure CLI installed (https://aka.ms/installazurecli)
#
# Usage:
#   bash scripts/azure-setup.sh YOUR_ANTHROPIC_API_KEY

set -e

ANTHROPIC_API_KEY="${1:?Usage: bash scripts/azure-setup.sh YOUR_ANTHROPIC_API_KEY}"

RESOURCE_GROUP="wasi-rg"
LOCATION="eastus"
CONTAINER_ENV="wasi-env"
CONTAINER_APP="wasi-backend-api"
SUBSCRIPTION=$(az account show --query id -o tsv)

echo "==> Using subscription: $SUBSCRIPTION"

# 1. Resource group
echo "==> Creating resource group..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

# 2. Container Apps environment
echo "==> Creating Container Apps environment..."
az containerapp env create \
  --name "$CONTAINER_ENV" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --output none

# 3. Container App (initial deploy with placeholder image)
echo "==> Creating Container App..."
az containerapp create \
  --name "$CONTAINER_APP" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$CONTAINER_ENV" \
  --image mcr.microsoft.com/azuredocs/containerapps-helloworld:latest \
  --target-port 3200 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 1 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --output none

# 4. Store Anthropic key as a secret
echo "==> Setting Anthropic API key as secret..."
az containerapp secret set \
  --name "$CONTAINER_APP" \
  --resource-group "$RESOURCE_GROUP" \
  --secrets "anthropic-api-key=$ANTHROPIC_API_KEY" \
  --output none

# 5. Service principal for GitHub Actions
echo "==> Creating service principal for GitHub Actions..."
SP=$(az ad sp create-for-rbac \
  --name "wasi-backend-github-actions" \
  --role contributor \
  --scopes "/subscriptions/$SUBSCRIPTION/resourceGroups/$RESOURCE_GROUP" \
  --sdk-auth)

echo ""
echo "============================================================"
echo "DONE. Add this JSON as GitHub secret AZURE_CREDENTIALS:"
echo "============================================================"
echo "$SP"
echo "============================================================"
echo ""

# 6. App URL
APP_URL=$(az containerapp show \
  --name "$CONTAINER_APP" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo "Your app URL will be: https://$APP_URL"
echo ""
echo "Next: copy the JSON above → GitHub repo → Settings → Secrets → AZURE_CREDENTIALS"
echo "Then push to main to trigger the first real deploy."
