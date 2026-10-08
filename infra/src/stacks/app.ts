import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ApiGatewayDeployment } from "@cdktn/provider-aws/lib/api-gateway-deployment";
import { ApiGatewayIntegration } from "@cdktn/provider-aws/lib/api-gateway-integration";
import { ApiGatewayMethod } from "@cdktn/provider-aws/lib/api-gateway-method";
import { ApiGatewayMethodSettings } from "@cdktn/provider-aws/lib/api-gateway-method-settings";
import { ApiGatewayResource } from "@cdktn/provider-aws/lib/api-gateway-resource";
import { ApiGatewayRestApi } from "@cdktn/provider-aws/lib/api-gateway-rest-api";
import { ApiGatewayStage } from "@cdktn/provider-aws/lib/api-gateway-stage";
import { CloudwatchLogGroup } from "@cdktn/provider-aws/lib/cloudwatch-log-group";
import { LambdaPermission } from "@cdktn/provider-aws/lib/lambda-permission";
import { AwsProvider } from "@cdktn/provider-aws/lib/provider";
import { Fn, S3Backend, TerraformOutput, TerraformStack } from "cdktn";
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

		const accessLogs = new CloudwatchLogGroup(this, "api_access_logs", {
			name: `/aws/apigateway/${props.stage}-api`,
			retentionInDays: 7,
		});

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
			...(props.stage === "dev" && { environment: { LAB_MODE: "1" } }),
			// Lab 5: 1024 MB is fastest per cost (see diagnostic sheet / ADR).
			memorySize: 1024,
		});

		const api = new ApiGatewayRestApi(this, "api", {
			name: `${props.stage}-api`,
			endpointConfiguration: { types: ["REGIONAL"] },
		});

		const healthResource = new ApiGatewayResource(this, "health_resource", {
			restApiId: api.id,
			parentId: api.rootResourceId,
			pathPart: "health",
		});

		const healthMethod = new ApiGatewayMethod(this, "health_method", {
			restApiId: api.id,
			resourceId: healthResource.id,
			httpMethod: "GET",
			authorization: "NONE",
		});

		const healthIntegration = new ApiGatewayIntegration(
			this,
			"health_integration",
			{
				restApiId: api.id,
				resourceId: healthResource.id,
				httpMethod: healthMethod.httpMethod,
				type: "AWS_PROXY",
				integrationHttpMethod: "POST",
				uri: health.fn.invokeArn,
			},
		);

		new LambdaPermission(this, "health_api_permission", {
			functionName: health.fn.functionName,
			action: "lambda:InvokeFunction",
			principal: "apigateway.amazonaws.com",
			sourceArn: `${api.executionArn}/*/GET/health`,
		});

		const deployment = new ApiGatewayDeployment(this, "api_deployment", {
			restApiId: api.id,
			triggers: {
				redeployment: Fn.sha1(
					Fn.jsonencode([
						healthResource.id,
						healthMethod.id,
						healthIntegration.id,
					]),
				),
			},
			lifecycle: { createBeforeDestroy: true },
		});

		const apiStage = new ApiGatewayStage(this, "api_stage", {
			restApiId: api.id,
			deploymentId: deployment.id,
			stageName: props.stage,
			accessLogSettings: {
				destinationArn: accessLogs.arn,
				format: JSON.stringify({
					requestId: "$context.requestId",
					requestTime: "$context.requestTime",
					httpMethod: "$context.httpMethod",
					resourcePath: "$context.resourcePath",
					status: "$context.status",
					responseLatency: "$context.responseLatency",
					integrationStatus: "$context.integration.status",
					integrationLatency: "$context.integration.latency",
					errorType: "$context.error.responseType",
					errorMessage: "$context.error.message",
					integrationError: "$context.integration.error",
				}),
			},
		});

		const execLogs = new CloudwatchLogGroup(this, "api_execution_logs", {
			name: `API-Gateway-Execution-Logs_${api.id}/${props.stage}`,
			retentionInDays: 7,
		});

		new ApiGatewayMethodSettings(this, "api_throttling", {
			restApiId: api.id,
			stageName: apiStage.stageName,
			methodPath: "*/*",
			settings: {
				throttlingBurstLimit: 10,
				throttlingRateLimit: 5,
				loggingLevel: "ERROR",
				metricsEnabled: true,
				dataTraceEnabled: false,
			},
			dependsOn: [execLogs],
		});

		new TerraformOutput(this, "api_url", {
			value: apiStage.invokeUrl,
		});
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
