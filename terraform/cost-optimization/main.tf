terraform {
  required_version = ">= 1.0"
  
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket         = "pitchey-terraform-state"
    key            = "cost-optimization/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

# Variables
variable "cloudflare_api_token" {
  description = "Cloudflare API Token"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "cost_thresholds" {
  description = "Cost alert thresholds per service"
  type = object({
    total       = number
    cloudflare  = number
    neon        = number
    upstash     = number
    github      = number
  })
  default = {
    total      = 1500
    cloudflare = 500
    neon       = 800
    upstash    = 200
    github     = 150
  }
}

# Providers
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

provider "aws" {
  region = "us-east-1"
}

# Cloudflare Workers Configuration
resource "cloudflare_worker_script" "cost_monitor" {
  account_id = var.cloudflare_account_id
  name       = "cost-monitor-${var.environment}"
  content    = file("../../infrastructure/cost-optimization/cost-monitor.ts")
  
  kv_namespace_binding {
    name         = "COST_DATA"
    namespace_id = cloudflare_workers_kv_namespace.cost_data.id
  }
  
  plain_text_binding {
    name = "ENVIRONMENT"
    text = var.environment
  }
  
  secret_text_binding {
    name = "UPSTASH_REDIS_REST_URL"
    text = var.upstash_redis_rest_url
  }
  
  secret_text_binding {
    name = "UPSTASH_REDIS_REST_TOKEN"
    text = var.upstash_redis_rest_token
  }
}

# KV Namespace for cost data
resource "cloudflare_workers_kv_namespace" "cost_data" {
  account_id = var.cloudflare_account_id
  title      = "cost-data-${var.environment}"
}

# Cloudflare Worker Route
resource "cloudflare_worker_route" "cost_monitor" {
  zone_id     = var.cloudflare_zone_id
  pattern     = "api.pitchey.com/cost-monitor/*"
  script_name = cloudflare_worker_script.cost_monitor.name
}

# Cloudflare Cache Rules for Cost Optimization
resource "cloudflare_ruleset" "cache_optimization" {
  zone_id = var.cloudflare_zone_id
  name    = "Cache Optimization Rules"
  kind    = "zone"
  phase   = "http_request_cache_settings"
  
  rules {
    action = "set_cache_settings"
    action_parameters {
      edge_ttl {
        mode    = "override_origin"
        default = 3600  # 1 hour for dynamic content
      }
      browser_ttl {
        mode    = "override_origin"
        default = 86400  # 24 hours for static assets
      }
      cache_key {
        ignore_query_strings_order = true
        exclude_query_strings      = ["utm_*", "fbclid"]
      }
    }
    expression = "(http.request.uri.path contains \"/static/\")"
    description = "Cache static assets aggressively"
  }
  
  rules {
    action = "set_cache_settings"
    action_parameters {
      edge_ttl {
        mode    = "override_origin"
        default = 300  # 5 minutes for API responses
      }
      cache_key {
        include_query_strings = ["page", "limit", "sort"]
      }
    }
    expression = "(http.request.uri.path contains \"/api/\" and http.request.method eq \"GET\")"
    description = "Cache GET API responses"
  }
}

# AWS CloudWatch for Cost Monitoring
resource "aws_cloudwatch_metric_alarm" "cost_alarm_total" {
  alarm_name          = "pitchey-total-cost-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "EstimatedCharges"
  namespace           = "AWS/Billing"
  period              = 86400
  statistic           = "Maximum"
  threshold           = var.cost_thresholds.total
  alarm_description   = "Alert when total costs exceed threshold"
  alarm_actions       = [aws_sns_topic.cost_alerts.arn]
  
  dimensions = {
    Currency = "USD"
  }
}

resource "aws_sns_topic" "cost_alerts" {
  name = "pitchey-cost-alerts"
}

resource "aws_sns_topic_subscription" "cost_alerts_email" {
  topic_arn = aws_sns_topic.cost_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Budget Controls
resource "aws_budgets_budget" "monthly" {
  name              = "pitchey-monthly-budget"
  budget_type       = "COST"
  limit_amount      = var.cost_thresholds.total
  limit_unit        = "USD"
  time_unit         = "MONTHLY"
  
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }
  
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type            = "PERCENTAGE"
    notification_type         = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}

# Auto-scaling Configuration
resource "cloudflare_load_balancer" "auto_scale" {
  zone_id     = var.cloudflare_zone_id
  name        = "pitchey-lb"
  fallback_pool_id = cloudflare_load_balancer_pool.primary.id
  default_pool_ids = [cloudflare_load_balancer_pool.primary.id]
  description = "Auto-scaling load balancer"
  proxied     = true
  
  adaptive_routing {
    failover_across_pools = true
  }
  
  session_affinity = "cookie"
  session_affinity_ttl = 1800
  
  rules {
    name     = "scale-up-rule"
    condition = "http.request.uri.path contains \"/api/\""
    priority = 1
    
    overrides {
      default_pool_ids = [
        cloudflare_load_balancer_pool.primary.id,
        cloudflare_load_balancer_pool.secondary.id
      ]
      session_affinity = "ip_cookie"
    }
  }
}

resource "cloudflare_load_balancer_pool" "primary" {
  account_id = var.cloudflare_account_id
  name       = "primary-pool"
  
  origins {
    name    = "primary-worker"
    address = "pitchey-production.cavelltheleaddev.workers.dev"
    weight  = 1
    enabled = true
  }
  
  check_regions = ["WNAM"]
  description   = "Primary worker pool"
  monitor_id    = cloudflare_load_balancer_monitor.health.id
}

resource "cloudflare_load_balancer_pool" "secondary" {
  account_id = var.cloudflare_account_id
  name       = "secondary-pool"
  
  origins {
    name    = "secondary-worker"
    address = "pitchey-production-2.cavelltheleaddev.workers.dev"
    weight  = 1
    enabled = true
  }
  
  check_regions = ["WNAM", "EEU"]
  description   = "Secondary worker pool for scaling"
  monitor_id    = cloudflare_load_balancer_monitor.health.id
}

resource "cloudflare_load_balancer_monitor" "health" {
  account_id     = var.cloudflare_account_id
  type           = "https"
  port           = 443
  method         = "GET"
  path           = "/health"
  interval       = 60
  timeout        = 5
  retries        = 2
  expected_codes = "200"
  
  header {
    name  = "Host"
    value = "api.pitchey.com"
  }
}

# Output important values
output "cost_monitor_url" {
  value = "https://api.pitchey.com/cost-monitor"
}

output "kv_namespace_id" {
  value = cloudflare_workers_kv_namespace.cost_data.id
}

output "load_balancer_hostname" {
  value = cloudflare_load_balancer.auto_scale.hostname
}

output "budget_id" {
  value = aws_budgets_budget.monthly.id
}

output "monthly_budget_limit" {
  value = var.cost_thresholds.total
}