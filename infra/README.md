# Verify.IQ infrastructure (planned)

This directory will contain Terraform CDK (CDKTF) code to provision AWS infrastructure for Verify.IQ:

- VPC (public + private subnets)
- ECR repository
- ECS cluster + Fargate service
- ALB + target group + HTTPS listener (ACM)
- Route53 record for `api.verifyiq.io`
- CloudWatch logs

If you see this file committed, GitHub write access is working and I can proceed to add the full CDKTF stack + Dockerfile + deployment workflow.
