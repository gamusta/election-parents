import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AwsProvider } from "@cdktn/provider-aws/lib/provider";
import { S3Backend, TerraformOutput, TerraformStack } from "cdktn";
import type { Construct } from "constructs";
import type { Manifest } from "../constructs/lambda-handler";
import { LambdaHandler } from "../constructs/lambda-handler";

export interface AppStackProps {
	stage: string;
}

export class AppStack extends TerraformStack {
	constructor(scope: Construct, id: string, props: AppStackProps) {
		super(scope, id);

		const stateBucketName = process.env.TF_STATE_BUCKET;
		if (!stateBucketName) {
			throw new Error("TF_STATE_BUCKET is not set");
		}

		const distDir = resolve(__dirname, "../../../apps/api/dist");
		const manifestPath = resolve(distDir, "manifest.json");
		if (!existsSync(manifestPath)) {
			throw new Error(
				`${manifestPath} not found — run: pnpm --filter @election/api build`,
			);
		}
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;

		const health = new LambdaHandler(this, "health", {
			stage: props.stage,
			name: "health",
			distDir,
			manifest,
		});

        // One-shot: keep Terraform addresses after the move into the construct.
        health.logGroup.moveFromId("aws_cloudwatch_log_group.health_log_group");
        health.role.moveFromId("aws_iam_role.health_role");
        health.rolePolicy.moveFromId("aws_iam_role_policy.health_logs_policy");
        health.fn.moveFromId("aws_lambda_function.health_fn");
        
		new TerraformOutput(this, "health_function_name", {
			value: health.fn.functionName,
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

		new S3Backend(this, {
			bucket: stateBucketName,
			key: `${props.stage}/app.tfstate`,
			region: "eu-west-1",
			encrypt: true,
			useLockfile: true,
		});
	}
}
