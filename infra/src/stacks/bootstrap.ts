import { Construct } from "constructs";
import { TerraformVariable, TerraformOutput, TerraformStack, S3Backend } from "cdktn";
import { AwsProvider } from "@cdktn/provider-aws/lib/provider";
import { DataAwsCallerIdentity } from "@cdktn/provider-aws/lib/data-aws-caller-identity";
import { BudgetsBudget } from "@cdktn/provider-aws/lib/budgets-budget";
import { S3Bucket } from "@cdktn/provider-aws/lib/s3-bucket";
import { S3BucketVersioningA } from "@cdktn/provider-aws/lib/s3-bucket-versioning";
import { S3BucketServerSideEncryptionConfigurationA } from "@cdktn/provider-aws/lib/s3-bucket-server-side-encryption-configuration";
import { S3BucketPublicAccessBlock } from "@cdktn/provider-aws/lib/s3-bucket-public-access-block";
import { S3BucketOwnershipControls } from "@cdktn/provider-aws/lib/s3-bucket-ownership-controls";
import { IamOpenidConnectProvider } from "@cdktn/provider-aws/lib/iam-openid-connect-provider";
import { DataAwsIamPolicyDocument } from "@cdktn/provider-aws/lib/data-aws-iam-policy-document";
import { IamRole } from "@cdktn/provider-aws/lib/iam-role";
import { DataAwsIamPolicy } from "@cdktn/provider-aws/lib/data-aws-iam-policy";
import { IamRolePolicyAttachment } from "@cdktn/provider-aws/lib/iam-role-policy-attachment";
import { IamRolePolicy } from "@cdktn/provider-aws/lib/iam-role-policy";

export interface BootstrapStackProps {
  stage: string;
  githubRepo: string;
}

export class BootstrapStack extends TerraformStack {
  constructor(scope: Construct, id: string, props: BootstrapStackProps) {
    super(scope, id);

    const stateBucketName = process.env.TF_STATE_BUCKET;
    if (!stateBucketName) {
      throw new Error("TF_STATE_BUCKET is not set");
    }

    const caller = new DataAwsCallerIdentity(this, "caller");

    const stateBucket = new S3Bucket(this, "state_bucket", {
      bucket: `election-parents-tfstate-${caller.accountId}`,
      lifecycle: { preventDestroy: true },
    });

    const githubOidc = new IamOpenidConnectProvider(this, "github_oidc", {
      url: "https://token.actions.githubusercontent.com",
      clientIdList: ["sts.amazonaws.com"],
    });

    const ciPlanTrust = new DataAwsIamPolicyDocument(this, "ci_plan_trust", {
      statement: [
        {
          effect: "Allow",
          actions: ["sts:AssumeRoleWithWebIdentity"],
          principals: [{ type: "Federated", identifiers: [githubOidc.arn] }],
          condition: [
            {
              test: "StringEquals",
              variable: "token.actions.githubusercontent.com:aud",
              values: ["sts.amazonaws.com"],
            },
            {
              test: "StringEquals",
              variable: "token.actions.githubusercontent.com:sub",
              values: [
                `repo:${props.githubRepo}:pull_request`,
                `repo:${props.githubRepo}:ref:refs/heads/main`,
              ],
            },
          ],
        },
      ],
    });

    const ciPlanRole = new IamRole(this, "ci_plan_role", {
      name: `${props.stage}-github-ci-plan`,
      assumeRolePolicy: ciPlanTrust.json,
      maxSessionDuration: 3600,
    });

    const readOnly = new DataAwsIamPolicy(this, "readonly_access", {
      name: "ReadOnlyAccess",
    });
    
    new IamRolePolicyAttachment(this, "ci_plan_readonly", {
      role: ciPlanRole.name,
      policyArn: readOnly.arn,
    });

    const ciPlanLock = new DataAwsIamPolicyDocument(this, "ci_plan_lock", {
      statement: [
        {
          effect: "Allow",
          actions: ["s3:PutObject", "s3:DeleteObject"],
          resources: [`${stateBucket.arn}/*.tflock`],
        },
      ],
    });
    
    new IamRolePolicy(this, "ci_plan_lock_policy", {
      role: ciPlanRole.id,
      policy: ciPlanLock.json,
    });
    
    new TerraformOutput(this, "ci_plan_role_arn", { value: ciPlanRole.arn });

    new S3Backend(this, {
      bucket: stateBucketName,
      key: `${props.stage}/bootstrap.tfstate`,
      region: "eu-west-1",
      encrypt: true,
      useLockfile: true,
    });

    const alertEmail = new TerraformVariable(this, "alert_email", {
      type: "string",
      description: "Budget alert recipient (set via TF_VAR_alert_email)",
      nullable: false,
      sensitive: false,
    });
    
    const subscribers = [alertEmail.stringValue];

    new BudgetsBudget(this, "monthly_budget", {
      name: `${props.stage}-monthly-cost`,
      budgetType: "COST",
      timeUnit: "MONTHLY",
      limitAmount: "50",
      limitUnit: "USD",
      metrics: ["UnblendedCost"],
      filterExpression: {
        not: {
          dimensions: {
            key: "RECORD_TYPE",
            values: ["Credit", "Refund"],
          },
        },
      },
      notification: [
        {
          notificationType: "ACTUAL",
          comparisonOperator: "GREATER_THAN",
          threshold: 10,
          thresholdType: "ABSOLUTE_VALUE",
          subscriberEmailAddresses: subscribers,
        },
        {
          notificationType: "ACTUAL",
          comparisonOperator: "GREATER_THAN",
          threshold: 50,
          thresholdType: "ABSOLUTE_VALUE",
          subscriberEmailAddresses: subscribers,
        },
        {
          notificationType: "FORECASTED",
          comparisonOperator: "GREATER_THAN",
          threshold: 50,
          thresholdType: "ABSOLUTE_VALUE",
          subscriberEmailAddresses: subscribers,
        },
      ],
    });

    new AwsProvider(this, "aws", {
      region: "eu-west-1",
      defaultTags: [
        {
          tags: {
            project: "election-parents",
            stage: props.stage,
            "managed-by": "cdktn",
          },
        },
      ],
    });

    new TerraformOutput(this, "account_id", {
      value: caller.accountId,
    });
    
    new S3BucketVersioningA(this, "state_versioning", {
      bucket: stateBucket.id,
      versioningConfiguration: { status: "Enabled" },
    });
    
    new S3BucketServerSideEncryptionConfigurationA(this, "state_sse", {
      bucket: stateBucket.id,
      rule: [{ applyServerSideEncryptionByDefault: { sseAlgorithm: "AES256" } }],
    });
    
    new S3BucketPublicAccessBlock(this, "state_pab", {
      bucket: stateBucket.id,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true,
    });
    
    new S3BucketOwnershipControls(this, "state_ownership", {
      bucket: stateBucket.id,
      rule: { objectOwnership: "BucketOwnerEnforced" },
    });
    
    new TerraformOutput(this, "state_bucket_name", { value: stateBucket.bucket });
  }
}
