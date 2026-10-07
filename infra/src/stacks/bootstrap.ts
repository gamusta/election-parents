import { Construct } from "constructs";
import { TerraformOutput, TerraformStack } from "cdktn";
import { AwsProvider } from "@cdktn/provider-aws/lib/provider";
import { DataAwsCallerIdentity } from "@cdktn/provider-aws/lib/data-aws-caller-identity";

export interface BootstrapStackProps {
  stage: string;
}

export class BootstrapStack extends TerraformStack {
  constructor(scope: Construct, id: string, props: BootstrapStackProps) {
    super(scope, id);

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
  }
}
