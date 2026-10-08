import { resolve } from "node:path";
import { CloudwatchLogGroup } from "@cdktn/provider-aws/lib/cloudwatch-log-group";
import {
	DataAwsIamPolicyDocument,
	type DataAwsIamPolicyDocumentStatement,
} from "@cdktn/provider-aws/lib/data-aws-iam-policy-document";
import { IamRole } from "@cdktn/provider-aws/lib/iam-role";
import { IamRolePolicy } from "@cdktn/provider-aws/lib/iam-role-policy";
import { LambdaFunction } from "@cdktn/provider-aws/lib/lambda-function";
import { AssetType, TerraformAsset } from "cdktn";
import { Construct } from "constructs";

export type Manifest = Record<
	string,
	{ zip: string; handler: string; sha256: string }
>;

export interface LambdaHandlerProps {
	stage: string;
	name: string;
	distDir: string;
	manifest: Manifest;
	statements?: DataAwsIamPolicyDocumentStatement[];
	environment?: Record<string, string>;
}

export class LambdaHandler extends Construct {
	readonly fn: LambdaFunction;
	readonly role: IamRole;
	readonly logGroup: CloudwatchLogGroup;
	readonly rolePolicy: IamRolePolicy;

	constructor(scope: Construct, id: string, props: LambdaHandlerProps) {
		super(scope, id);

		const artifact = props.manifest[props.name];
		if (!artifact) {
			throw new Error(`${props.name} handler missing from manifest.json`);
		}

		const functionName = `${props.stage}-${props.name}`;

		this.logGroup = new CloudwatchLogGroup(this, "log_group", {
			name: `/aws/lambda/${functionName}`,
			retentionInDays: 7,
		});

		const trust = new DataAwsIamPolicyDocument(this, "trust", {
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

		this.role = new IamRole(this, "role", {
			name: functionName,
			assumeRolePolicy: trust.json,
		});

		const policyDoc = new DataAwsIamPolicyDocument(this, "policy_doc", {
			statement: [
				{
					effect: "Allow",
					actions: ["logs:CreateLogStream", "logs:PutLogEvents"],
					resources: [`${this.logGroup.arn}:*`],
				},
				...(props.statements ?? []),
			],
		});

		this.rolePolicy = new IamRolePolicy(this, "policy", {
			role: this.role.id,
			policy: policyDoc.json,
		});

		const asset = new TerraformAsset(this, "asset", {
			path: resolve(props.distDir, artifact.zip),
			type: AssetType.FILE,
		});

		this.fn = new LambdaFunction(this, "fn", {
			functionName,
			role: this.role.arn,
			runtime: "nodejs24.x",
			architectures: ["arm64"],
			handler: artifact.handler,
			memorySize: 256,
			timeout: 10,
			filename: asset.path,
			sourceCodeHash: artifact.sha256,
			loggingConfig: {
				logFormat: "JSON",
				logGroup: this.logGroup.name,
			},
			environment: {
				variables: { STAGE: props.stage, ...props.environment },
			},
			dependsOn: [this.rolePolicy],
		});
	}
}
