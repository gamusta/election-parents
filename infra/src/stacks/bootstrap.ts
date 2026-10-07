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

export interface BootstrapStackProps {
  stage: string;
}

export class BootstrapStack extends TerraformStack {
  constructor(scope: Construct, id: string, props: BootstrapStackProps) {
    super(scope, id);

    const stateBucketName = process.env.TF_STATE_BUCKET;
    if (!stateBucketName) {
      throw new Error("TF_STATE_BUCKET is not set");
    }

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
      costTypes: {
        includeCredit: false,
        includeRefund: false,
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

    const caller = new DataAwsCallerIdentity(this, "caller");

    new TerraformOutput(this, "account_id", {
      value: caller.accountId,
    });

    const stateBucket = new S3Bucket(this, "state_bucket", {
      bucket: `election-parents-tfstate-${caller.accountId}`,
      lifecycle: { preventDestroy: true },
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
