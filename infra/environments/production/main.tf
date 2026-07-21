locals {
  compact_prefix      = replace(var.name_prefix, "-", "")
  frontend_app_name   = "${var.name_prefix}-frontend"
  backend_app_name    = "${var.name_prefix}-backend"
  github_oidc_subject = "repo:${var.github_repository}:environment:${var.github_environment}"
}

resource "random_string" "global_suffix" {
  length  = 6
  upper   = false
  special = false
}

resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
  tags     = var.tags
}

resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.name_prefix}-logs"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

resource "azurerm_container_registry" "main" {
  name                          = "${local.compact_prefix}acr${random_string.global_suffix.result}"
  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  sku                           = "Basic"
  admin_enabled                 = false
  anonymous_pull_enabled        = false
  public_network_access_enabled = true
  tags                          = var.tags
}

resource "azurerm_container_app_environment" "main" {
  name                       = "${var.name_prefix}-env"
  resource_group_name        = azurerm_resource_group.main.name
  location                   = azurerm_resource_group.main.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  tags                       = var.tags
}

resource "azurerm_user_assigned_identity" "frontend" {
  name                = "${var.name_prefix}-frontend"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tags                = var.tags
}

resource "azurerm_role_assignment" "frontend_acr_pull" {
  scope                            = azurerm_container_registry.main.id
  role_definition_name             = "AcrPull"
  principal_id                     = azurerm_user_assigned_identity.frontend.principal_id
  skip_service_principal_aad_check = true
}

resource "azurerm_user_assigned_identity" "backend" {
  name                = "${var.name_prefix}-backend"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tags                = var.tags
}

resource "azurerm_role_assignment" "backend_acr_pull" {
  scope                            = azurerm_container_registry.main.id
  role_definition_name             = "AcrPull"
  principal_id                     = azurerm_user_assigned_identity.backend.principal_id
  skip_service_principal_aad_check = true
}

resource "azurerm_user_assigned_identity" "github_deploy" {
  name                = "${var.name_prefix}-github-deploy"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tags                = var.tags
}

resource "azurerm_federated_identity_credential" "github_production" {
  name                      = "github-${var.github_environment}"
  user_assigned_identity_id = azurerm_user_assigned_identity.github_deploy.id
  audience                  = ["api://AzureADTokenExchange"]
  issuer                    = "https://token.actions.githubusercontent.com"
  subject                   = local.github_oidc_subject
}

resource "azurerm_role_assignment" "github_container_apps" {
  scope                            = azurerm_resource_group.main.id
  role_definition_name             = "Container Apps Contributor"
  principal_id                     = azurerm_user_assigned_identity.github_deploy.principal_id
  skip_service_principal_aad_check = true
}

resource "azurerm_role_assignment" "github_acr_push" {
  scope                            = azurerm_container_registry.main.id
  role_definition_name             = "AcrPush"
  principal_id                     = azurerm_user_assigned_identity.github_deploy.principal_id
  skip_service_principal_aad_check = true
}

resource "azurerm_role_assignment" "github_frontend_identity_operator" {
  scope                            = azurerm_user_assigned_identity.frontend.id
  role_definition_name             = "Managed Identity Operator"
  principal_id                     = azurerm_user_assigned_identity.github_deploy.principal_id
  skip_service_principal_aad_check = true
}

resource "azurerm_role_assignment" "github_backend_identity_operator" {
  scope                            = azurerm_user_assigned_identity.backend.id
  role_definition_name             = "Managed Identity Operator"
  principal_id                     = azurerm_user_assigned_identity.github_deploy.principal_id
  skip_service_principal_aad_check = true
}
