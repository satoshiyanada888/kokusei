output "resource_group_name" {
  value = azurerm_resource_group.main.name
}

output "location" {
  value = azurerm_resource_group.main.location
}

output "container_registry_name" {
  value = azurerm_container_registry.main.name
}

output "container_registry_login_server" {
  value = azurerm_container_registry.main.login_server
}

output "container_app_environment_name" {
  value = azurerm_container_app_environment.main.name
}

output "container_app_environment_id" {
  value = azurerm_container_app_environment.main.id
}

output "frontend_container_app_name" {
  value = local.frontend_app_name
}

output "backend_container_app_name" {
  value = local.backend_app_name
}

output "expected_frontend_url" {
  description = "Set NEXT_PUBLIC_SITE_URL to this HTTPS URL before building the first production image."
  value       = "https://${local.frontend_app_name}.${azurerm_container_app_environment.main.default_domain}"
}

output "github_actions_client_id" {
  description = "Set as GitHub production Environment variable AZURE_CLIENT_ID."
  value       = azurerm_user_assigned_identity.github_deploy.client_id
}

output "frontend_identity_id" {
  description = "Resource ID used by the frontend Container App for ACR pull."
  value       = azurerm_user_assigned_identity.frontend.id
}

output "backend_identity_id" {
  description = "Resource ID used by the backend Container App for ACR pull."
  value       = azurerm_user_assigned_identity.backend.id
}

output "stage_1_scope" {
  description = "Stage 1 creates Azure foundation only; Neon and Container Apps are not created."
  value       = "azure-foundation-only"
}
