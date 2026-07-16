output "backend_config" {
  description = "Values to copy into the production backend.hcl file."
  value = {
    resource_group_name  = azurerm_resource_group.state.name
    storage_account_name = azurerm_storage_account.state.name
    container_name       = azurerm_storage_container.state.name
    key                  = "production.tfstate"
    use_azuread_auth     = true
  }
}

output "state_operator_role_assignment_id" {
  description = "Role assignment that grants the operator access to Terraform state blobs."
  value       = azurerm_role_assignment.state_operator.id
}
