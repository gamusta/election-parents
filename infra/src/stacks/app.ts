import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CloudwatchLogGroup } from "@cdktn/provider-aws/lib/cloudwatch-log-group";
import { DataAwsIamPolicyDocument } from "@cdktn/provider-aws/lib/data-aws-iam-policy-document";
import { IamRole } from "@cdktn/provider-aws/lib/iam-role";
import { IamRolePolicy } from "@cdktn/provider-aws/lib/iam-role-policy";
import { LambdaFunction } from "@cdktn/provider-aws/lib/lambda-function";
import { AwsProvider } from "@cdktn/provider-aws/lib/provider";
import {
	AssetType,
	S3Backend,
	TerraformAsset,
	TerraformOutput,
	TerraformStack,
} from "cdktn";
import type { Construct } from "constructs";

type Manifest = Record<
	string,
	{ zip: string; handler: string; sha256: string }
>;

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

		const functionName = `${props.stage}-health`;

		const healthLogGroup = new CloudwatchLogGroup(this, "health_log_group", {
			name: `/aws/lambda/${functionName}`,
			retentionInDays: 7,
		});

		const health = manifest.health;
		if (!health) {
			throw new Error("health handler missing from manifest.json");
		}

		const lambdaTrust = new DataAwsIamPolicyDocument(this, "lambda_trust", {
			statement: [
				{
					effect: "Allow",
					actions: ["sts:AssumeRole"],
					principals: [
						{ type: "Service", identifiers: ["lambda.amazonaws.com"] },
					],
				},
			],
		});
		const healthRole = new IamRole(this, "health_role", {
			name: functionName,
			assumeRolePolicy: lambdaTrust.json,
		});

		const healthLogs = new DataAwsIamPolicyDocument(this, "health_logs", {
			statement: [
				{
					effect: "Allow",
					actions: ["logs:CreateLogStream", "logs:PutLogEvents"],
					resources: [`${healthLogGroup.arn}:*`],
				},
			],
		});

		const healthLogsPolicy = new IamRolePolicy(this, "health_logs_policy", {
			role: healthRole.id,
			policy: healthLogs.json,
		});

		const healthAsset = new TerraformAsset(this, "health_asset", {
			path: resolve(distDir, health.zip),
			type: AssetType.FILE,
		});
		const healthFn = new LambdaFunction(this, "health_fn", {
			functionName,
			role: healthRole.arn,
			runtime: "nodejs24.x",
			architectures: ["arm64"],
			handler: health.handler,
			memorySize: 256,
			timeout: 10,
			filename: healthAsset.path,
			sourceCodeHash: health.sha256,
			loggingConfig: {
				logFormat: "JSON",
				logGroup: healthLogGroup.name,
			},
			environment: {
				variables: { STAGE: props.stage },
			},
			dependsOn: [healthLogsPolicy],
		});
		new TerraformOutput(this, "health_function_name", {
			value: healthFn.functionName,
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
