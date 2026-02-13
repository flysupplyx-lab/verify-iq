import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { Vpc } from "@cdktf/provider-aws/lib/vpc";
import { Subnet } from "@cdktf/provider-aws/lib/subnet";
import { InternetGateway } from "@cdktf/provider-aws/lib/internet-gateway";
import { RouteTable } from "@cdktf/provider-aws/lib/route-table";
import { Route } from "@cdktf/provider-aws/lib/route";
import { RouteTableAssociation } from "@cdktf/provider-aws/lib/route-table-association";
import { SecurityGroup } from "@cdktf/provider-aws/lib/security-group";
import { EcrRepository } from "@cdktf/provider-aws/lib/ecr-repository";
import { EcsCluster } from "@cdktf/provider-aws/lib/ecs-cluster";
import { EcsTaskDefinition } from "@cdktf/provider-aws/lib/ecs-task-definition";
import { EcsService } from "@cdktf/provider-aws/lib/ecs-service";
import { Lb } from "@cdktf/provider-aws/lib/lb";
import { LbTargetGroup } from "@cdktf/provider-aws/lib/lb-target-group";
import { LbListener } from "@cdktf/provider-aws/lib/lb-listener";
import { CloudwatchLogGroup } from "@cdktf/provider-aws/lib/cloudwatch-log-group";
import { DataAwsAcmCertificate } from "@cdktf/provider-aws/lib/data-aws-acm-certificate";
import { Route53Record } from "@cdktf/provider-aws/lib/route53-record";
import { DataAwsRoute53Zone } from "@cdktf/provider-aws/lib/data-aws-route53-zone";
import { IamRole } from "@cdktf/provider-aws/lib/iam-role";
import { IamRolePolicyAttachment } from "@cdktf/provider-aws/lib/iam-role-policy-attachment";

interface VerifyIqConfig {
  appName: string;
  region: string;
  containerPort: number;
  desiredCount: number;
  domainName: string;
  environment: {
    [key: string]: string;
  };
}

class VerifyIqStack extends TerraformStack {
  constructor(scope: Construct, id: string, config: VerifyIqConfig) {
    super(scope, id);

    new AwsProvider(this, "aws", {
      region: config.region,
    });

    // VPC
    const vpc = new Vpc(this, "vpc", {
      cidrBlock: "10.0.0.0/16",
      enableDnsHostnames: true,
      enableDnsSupport: true,
      tags: {
        Name: `${config.appName}-vpc`,
      },
    });

    // Internet Gateway
    const igw = new InternetGateway(this, "igw", {
      vpcId: vpc.id,
      tags: {
        Name: `${config.appName}-igw`,
      },
    });

    // Public Subnets (for ALB)
    const publicSubnet1 = new Subnet(this, "public-subnet-1", {
      vpcId: vpc.id,
      cidrBlock: "10.0.1.0/24",
      availabilityZone: `${config.region}a`,
      mapPublicIpOnLaunch: true,
      tags: {
        Name: `${config.appName}-public-subnet-1`,
      },
    });

    const publicSubnet2 = new Subnet(this, "public-subnet-2", {
      vpcId: vpc.id,
      cidrBlock: "10.0.2.0/24",
      availabilityZone: `${config.region}b`,
      mapPublicIpOnLaunch: true,
      tags: {
        Name: `${config.appName}-public-subnet-2`,
      },
    });

    // Private Subnets (for ECS)
    const privateSubnet1 = new Subnet(this, "private-subnet-1", {
      vpcId: vpc.id,
      cidrBlock: "10.0.10.0/24",
      availabilityZone: `${config.region}a`,
      tags: {
        Name: `${config.appName}-private-subnet-1`,
      },
    });

    const privateSubnet2 = new Subnet(this, "private-subnet-2", {
      vpcId: vpc.id,
      cidrBlock: "10.0.11.0/24",
      availabilityZone: `${config.region}b`,
      tags: {
        Name: `${config.appName}-private-subnet-2`,
      },
    });

    // Route Table for Public Subnets
    const publicRouteTable = new RouteTable(this, "public-rt", {
      vpcId: vpc.id,
      tags: {
        Name: `${config.appName}-public-rt`,
      },
    });

    new Route(this, "public-route", {
      routeTableId: publicRouteTable.id,
      destinationCidrBlock: "0.0.0.0/0",
      gatewayId: igw.id,
    });

    new RouteTableAssociation(this, "public-rt-assoc-1", {
      subnetId: publicSubnet1.id,
      routeTableId: publicRouteTable.id,
    });

    new RouteTableAssociation(this, "public-rt-assoc-2", {
      subnetId: publicSubnet2.id,
      routeTableId: publicRouteTable.id,
    });

    // Security Group for ALB
    const albSg = new SecurityGroup(this, "alb-sg", {
      vpcId: vpc.id,
      name: `${config.appName}-alb-sg`,
      ingress: [
        {
          fromPort: 80,
          toPort: 80,
          protocol: "tcp",
          cidrBlocks: ["0.0.0.0/0"],
        },
        {
          fromPort: 443,
          toPort: 443,
          protocol: "tcp",
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: "-1",
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
      tags: {
        Name: `${config.appName}-alb-sg`,
      },
    });

    // Security Group for ECS
    const ecsSg = new SecurityGroup(this, "ecs-sg", {
      vpcId: vpc.id,
      name: `${config.appName}-ecs-sg`,
      ingress: [
        {
          fromPort: config.containerPort,
          toPort: config.containerPort,
          protocol: "tcp",
          securityGroups: [albSg.id],
        },
      ],
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: "-1",
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
      tags: {
        Name: `${config.appName}-ecs-sg`,
      },
    });

    // ECR Repository
    const ecr = new EcrRepository(this, "ecr", {
      name: config.appName,
      imageScanningConfiguration: {
        scanOnPush: true,
      },
      imageTagMutability: "MUTABLE",
      tags: {
        Name: `${config.appName}-ecr`,
      },
    });

    // CloudWatch Log Group
    const logGroup = new CloudwatchLogGroup(this, "log-group", {
      name: `/ecs/${config.appName}`,
      retentionInDays: 7,
      tags: {
        Name: `${config.appName}-logs`,
      },
    });

    // ECS Cluster
    const cluster = new EcsCluster(this, "cluster", {
      name: `${config.appName}-cluster`,
      setting: [
        {
          name: "containerInsights",
          value: "enabled",
        },
      ],
      tags: {
        Name: `${config.appName}-cluster`,
      },
    });

    // IAM Role for ECS Task Execution
    const ecsTaskExecutionRole = new IamRole(this, "ecs-task-execution-role", {
      name: `${config.appName}-ecs-task-execution-role`,
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Action: "sts:AssumeRole",
            Effect: "Allow",
            Principal: {
              Service: "ecs-tasks.amazonaws.com",
            },
          },
        ],
      }),
    });

    new IamRolePolicyAttachment(this, "ecs-task-execution-role-policy", {
      role: ecsTaskExecutionRole.name,
      policyArn:
        "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    });

    // ECS Task Definition
    const taskDef = new EcsTaskDefinition(this, "task-def", {
      family: config.appName,
      networkMode: "awsvpc",
      requiresCompatibilities: ["FARGATE"],
      cpu: "256",
      memory: "512",
      executionRoleArn: ecsTaskExecutionRole.arn,
      containerDefinitions: JSON.stringify([
        {
          name: config.appName,
          image: `${ecr.repositoryUrl}:latest`,
          portMappings: [
            {
              containerPort: config.containerPort,
              hostPort: config.containerPort,
              protocol: "tcp",
            },
          ],
          logConfiguration: {
            logDriver: "awslogs",
            options: {
              "awslogs-group": logGroup.name,
              "awslogs-region": config.region,
              "awslogs-stream-prefix": "ecs",
            },
          },
          environment: Object.entries(config.environment).map(([key, value]) => ({
            name: key,
            value: value,
          })),
        },
      ]),
      tags: {
        Name: `${config.appName}-task-def`,
      },
    });

    // ALB
    const alb = new Lb(this, "alb", {
      name: `${config.appName}-alb`,
      internal: false,
      loadBalancerType: "application",
      securityGroups: [albSg.id],
      subnets: [publicSubnet1.id, publicSubnet2.id],
      enableDeletionProtection: false,
      tags: {
        Name: `${config.appName}-alb`,
      },
    });

    // Target Group
    const targetGroup = new LbTargetGroup(this, "tg", {
      name: `${config.appName}-tg`,
      port: config.containerPort,
      protocol: "HTTP",
      vpcId: vpc.id,
      targetType: "ip",
      healthCheck: {
        healthyThreshold: 2,
        unhealthyThreshold: 2,
        timeout: 3,
        interval: 30,
        path: "/api/health",
        matcher: "200",
      },
      tags: {
        Name: `${config.appName}-tg`,
      },
    });

    // HTTP Listener (redirect to HTTPS)
    new LbListener(this, "http-listener", {
      loadBalancerArn: alb.arn,
      port: 80,
      protocol: "HTTP",
      defaultAction: [
        {
          type: "redirect",
          redirect: {
            port: "443",
            protocol: "HTTPS",
            statusCode: "HTTP_301",
          },
        },
      ],
    });

    // HTTPS Listener (requires ACM cert - you'll need to create this manually or via separate stack)
    // For now, we'll create a placeholder that you can update with your cert ARN
    const certArn = process.env.ACM_CERT_ARN || "arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT_ID";

    new LbListener(this, "https-listener", {
      loadBalancerArn: alb.arn,
      port: 443,
      protocol: "HTTPS",
      sslPolicy: "ELBSecurityPolicy-TLS-1-2-2017-01",
      certificateArn: certArn,
      defaultAction: [
        {
          type: "forward",
          targetGroupArn: targetGroup.arn,
        },
      ],
    });

    // ECS Service
    new EcsService(this, "service", {
      name: `${config.appName}-service`,
      cluster: cluster.id,
      taskDefinition: taskDef.arn,
      desiredCount: config.desiredCount,
      launchType: "FARGATE",
      networkConfiguration: {
        subnets: [privateSubnet1.id, privateSubnet2.id],
        securityGroups: [ecsSg.id],
        assignPublicIp: false,
      },
      loadBalancer: [
        {
          targetGroupArn: targetGroup.arn,
          containerName: config.appName,
          containerPort: config.containerPort,
        },
      ],
      dependsOn: [
        // Ensure ALB listener is created before service
      ],
      tags: {
        Name: `${config.appName}-service`,
      },
    });

    // Outputs
    console.log(`ALB DNS: ${alb.dnsName}`);
    console.log(`ECR Repository: ${ecr.repositoryUrl}`);
  }
}

const app = new App();

const config: VerifyIqConfig = {
  appName: "verify-iq-api",
  region: process.env.AWS_REGION || "us-east-1",
  containerPort: 3000,
  desiredCount: 1,
  domainName: process.env.DOMAIN_NAME || "api.verifyiq.io",
  environment: {
    NODE_ENV: "production",
    PORT: "3000",
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "https://verifyiq.io,chrome-extension://YOUR_EXTENSION_ID",
    VERIFYIQ_ADMIN_TOKEN: process.env.VERIFYIQ_ADMIN_TOKEN || "change-me-in-production",
  },
};

new VerifyIqStack(app, "verify-iq", config);

app.synth();
