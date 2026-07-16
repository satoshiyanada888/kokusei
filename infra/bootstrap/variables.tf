variable "subscription_id" {
  description = "Azure Subscription ID used for the Terraform state resources."
  type        = string
}

variable "operator_principal_object_id" {
  description = "Microsoft Entra object ID of the operator who manages the remote Terraform state."
  type        = string

  validation {
    condition     = can(regex("^[0-9a-fA-F-]{36}$", var.operator_principal_object_id))
    error_message = "operator_principal_object_id must be a Microsoft Entra object ID in UUID format."
  }
}

variable "location" {
  description = "Azure region for the Terraform state resources."
  type        = string
  default     = "japaneast"
}

variable "resource_group_name" {
  description = "Dedicated resource group for Terraform state."
  type        = string
  default     = "rg-kokusei-tfstate"
}

variable "storage_account_prefix" {
  description = "Lowercase alphanumeric prefix for the globally unique state storage account."
  type        = string
  default     = "kokuseitfstate"

  validation {
    condition     = can(regex("^[a-z0-9]{3,18}$", var.storage_account_prefix))
    error_message = "storage_account_prefix must contain 3-18 lowercase letters or digits."
  }
}

variable "tags" {
  description = "Tags applied to bootstrap resources."
  type        = map(string)
  default = {
    Application = "KOKUSEI"
    Environment = "production"
    ManagedBy   = "Terraform"
  }
}
