import { Construct } from "constructs";
import { TerraformVariable, TerraformOutput, TerraformStack } from "cdktn";
import { AwsProvider } from "@cdktn/provider-aws/lib/provider";
import { DataAwsCallerIdentity } from "@cdktn/provider-aws/lib/data-aws-caller-identity";
import { BudgetsBudget } from "@cdktn/provider-aws/lib/budgets-budget";

export interface BootstrapStackProps {
  stage: string;
}

export class BootstrapStack extends TerraformStack {
  constructor(scope: Construct, id: string, props: BootstrapStackProps) {
    super(scope, id);

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
  }
}
