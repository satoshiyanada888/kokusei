variable "subscription_id" {
  description = "Azure Subscription ID for production resources."
  type        = string
}

variable "location" {
  description = "Azure region for Container Apps resources."
  type        = string
  default     = "japaneast"
}

variable "resource_group_name" {
  description = "Dedicated production resource group."
  type        = string
  default     = "rg-kokusei-prod"
}

variable "name_prefix" {
  description = "Lowercase prefix used for resource names."
  type        = string
  default     = "kokusei-prod"
  validation {
    condition     = can(regex("^[a-z0-9-]{3,20}$", var.name_prefix))
    error_message = "name_prefix must contain 3-20 lowercase letters, digits, or hyphens."
  }
}

variable "github_repository" {
  description = "GitHub repository in owner/name form used by the production Environment OIDC subject."
  type        = string
  default     = "satoshiyanada888/kokusei"
  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "github_repository must use the owner/name form."
  }
}

variable "github_repository_owner_id" {
  description = "Immutable GitHub owner ID included in the production OIDC subject."
  type        = string
  default     = "16567805"
  validation {
    condition     = can(regex("^[1-9][0-9]*$", var.github_repository_owner_id))
    error_message = "github_repository_owner_id must contain decimal digits without leading zeroes."
  }
}

variable "github_repository_id" {
  description = "Immutable GitHub repository ID included in the production OIDC subject."
  type        = string
  default     = "1301151718"
  validation {
    condition     = can(regex("^[1-9][0-9]*$", var.github_repository_id))
    error_message = "github_repository_id must contain decimal digits without leading zeroes."
  }
}

variable "github_environment" {
  description = "GitHub Environment protected by the OIDC federated credential."
  type        = string
  default     = "production"
}

variable "tags" {
  description = "Tags applied to production resources."
  type        = map(string)
  default = {
    Application = "KOKUSEI"
    Environment = "production"
    ManagedBy   = "Terraform"
    Stage       = "foundation"
  }
}
