import { ApiGatewayIntegration } from "@cdktn/provider-aws/lib/api-gateway-integration";
import { ApiGatewayMethod } from "@cdktn/provider-aws/lib/api-gateway-method";
import type { ApiGatewayRestApi } from "@cdktn/provider-aws/lib/api-gateway-rest-api";
import { LambdaPermission } from "@cdktn/provider-aws/lib/lambda-permission";
import { Construct } from "constructs";
import type { LambdaHandler } from "./lambda-handler";

export interface LambdaRouteProps {
	api: ApiGatewayRestApi;
	resourceId: string;
	httpMethod: "GET" | "POST";
	// Path in the execute-api ARN, parameters as wildcards (e.g. "elections/*").
	sourcePath: string;
	handler: LambdaHandler;
	requestParameters?: Record<string, boolean>;
}

export class LambdaRoute extends Construct {
	// Ids to include in the deployment trigger, so a route change republishes the stage.
	readonly triggerIds: string[];
	readonly method: ApiGatewayMethod;
	readonly integration: ApiGatewayIntegration;

	constructor(scope: Construct, id: string, props: LambdaRouteProps) {
		super(scope, id);

		this.method = new ApiGatewayMethod(this, "method", {
			restApiId: props.api.id,
			resourceId: props.resourceId,
			httpMethod: props.httpMethod,
			authorization: "NONE",
			requestParameters: props.requestParameters,
		});

		this.integration = new ApiGatewayIntegration(this, "integration", {
			restApiId: props.api.id,
			resourceId: props.resourceId,
			httpMethod: this.method.httpMethod,
			type: "AWS_PROXY",
			// API Gateway always invokes Lambda with POST, whatever the client verb.
			integrationHttpMethod: "POST",
			uri: props.handler.fn.invokeArn,
		});

		new LambdaPermission(this, "permission", {
			functionName: props.handler.fn.functionName,
			action: "lambda:InvokeFunction",
			principal: "apigateway.amazonaws.com",
			sourceArn: `${props.api.executionArn}/*/${props.httpMethod}/${props.sourcePath}`,
		});

		this.triggerIds = [props.resourceId, this.method.id, this.integration.id];
	}
}
