import type { InfraNode, InfraNodeType } from "@/store/useCanvasStore";

function sanitizeName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

const TF_MAP: Record<InfraNodeType, (name: string, label: string) => string> = {
  "load-balancer": (n, l) => `# ${l}
resource "aws_lb" "${n}" {
  name               = "${n}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.${n}_sg.id]
  subnets            = var.public_subnets

  tags = {
    Name = "${l}"
  }
}

resource "aws_lb_listener" "${n}_listener" {
  load_balancer_arn = aws_lb.${n}.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.${n}_tg.arn
  }
}`,

  "api-gateway": (n, l) => `# ${l}
resource "aws_apigatewayv2_api" "${n}" {
  name          = "${n}"
  protocol_type = "HTTP"
  description   = "${l}"

  tags = {
    Name = "${l}"
  }
}

resource "aws_apigatewayv2_stage" "${n}_default" {
  api_id      = aws_apigatewayv2_api.${n}.id
  name        = "$default"
  auto_deploy = true
}`,

  docker: (n, l) => `# ${l}
resource "aws_ecs_task_definition" "${n}" {
  family                   = "${n}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"

  container_definitions = jsonencode([{
    name      = "${n}"
    image     = "${n}:latest"
    essential = true
    portMappings = [{
      containerPort = 8080
      hostPort      = 8080
    }]
  }])
}

resource "aws_ecs_service" "${n}_service" {
  name            = "${n}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.${n}.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnets
    security_groups  = [aws_security_group.${n}_sg.id]
    assign_public_ip = false
  }
}`,

  kubernetes: (n, l) => `# ${l}
resource "aws_eks_node_group" "${n}" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${n}"
  node_role_arn   = aws_iam_role.eks_nodes.arn
  subnet_ids      = var.private_subnets

  scaling_config {
    desired_size = 2
    max_size     = 5
    min_size     = 1
  }

  instance_types = ["t3.medium"]

  tags = {
    Name = "${l}"
  }
}`,

  server: (n, l) => `# ${l}
resource "aws_instance" "${n}" {
  ami           = var.ami_id
  instance_type = "t3.medium"
  subnet_id     = var.private_subnets[0]

  tags = {
    Name = "${l}"
  }
}`,

  database: (n, l) => `# ${l}
resource "aws_db_instance" "${n}" {
  identifier           = "${n}"
  engine               = "postgres"
  engine_version       = "16.1"
  instance_class       = "db.t3.medium"
  allocated_storage    = 20
  max_allocated_storage = 100
  db_name              = "${n.replace(/_/g, "")}"
  username             = "admin"
  password             = var.db_password
  skip_final_snapshot  = true
  publicly_accessible  = false

  vpc_security_group_ids = [aws_security_group.${n}_sg.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  tags = {
    Name = "${l}"
  }
}`,

  cache: (n, l) => `# ${l}
resource "aws_elasticache_cluster" "${n}" {
  cluster_id           = "${n}"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.${n}_sg.id]

  tags = {
    Name = "${l}"
  }
}`,

  queue: (n, l) => `# ${l}
resource "aws_sqs_queue" "${n}" {
  name                       = "${n}"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 345600
  receive_wait_time_seconds  = 10
  visibility_timeout_seconds = 30

  tags = {
    Name = "${l}"
  }
}

resource "aws_sqs_queue" "${n}_dlq" {
  name = "${n}-dlq"

  tags = {
    Name = "${l} Dead Letter Queue"
  }
}`,

  storage: (n, l) => `# ${l}
resource "aws_s3_bucket" "${n}" {
  bucket = "${n}-\${var.environment}"

  tags = {
    Name = "${l}"
  }
}

resource "aws_s3_bucket_versioning" "${n}_versioning" {
  bucket = aws_s3_bucket.${n}.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "${n}_sse" {
  bucket = aws_s3_bucket.${n}.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}`,

  cdn: (n, l) => `# ${l}
resource "aws_cloudfront_distribution" "${n}" {
  enabled             = true
  default_root_object = "index.html"
  comment             = "${l}"

  origin {
    domain_name = aws_s3_bucket.origin.bucket_regional_domain_name
    origin_id   = "${n}-origin"
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "${n}-origin"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "${l}"
  }
}`,

  firewall: (n, l) => `# ${l}
resource "aws_security_group" "${n}" {
  name        = "${n}"
  description = "${l}"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${l}"
  }
}`,

  monitoring: (n, l) => `# ${l}
resource "aws_cloudwatch_dashboard" "${n}" {
  dashboard_name = "${n}"
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [["AWS/EC2", "CPUUtilization"]]
          period  = 300
          stat    = "Average"
          region  = var.region
          title   = "CPU Utilization"
        }
      }
    ]
  })
}

resource "aws_sns_topic" "${n}_alerts" {
  name = "${n}-alerts"

  tags = {
    Name = "${l} Alerts"
  }
}`,
};

export function generateTerraform(nodes: InfraNode[]): string {
  if (nodes.length === 0) return "# No nodes to generate Terraform for";

  const header = `# ══════════════════════════════════════════
# Generated by Cloud Wiz — Terraform Config
# ══════════════════════════════════════════

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "region" {
  default = "us-east-1"
}

variable "environment" {
  default = "production"
}

variable "vpc_id" {
  type = string
}

variable "public_subnets" {
  type = list(string)
}

variable "private_subnets" {
  type = list(string)
}

variable "ami_id" {
  type    = string
  default = "ami-0c55b159cbfafe1f0"
}

variable "db_password" {
  type      = string
  sensitive = true
}
`;

  const resources = nodes.map((node) => {
    const name = sanitizeName(node.data.label);
    const generator = TF_MAP[node.data.type] || TF_MAP.server;
    return generator(name, node.data.label);
  });

  return header + "\n" + resources.join("\n\n");
}
