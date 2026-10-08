import type { LambdaEvent } from "@hono/aws-lambda";
import type { APIGatewayProxyEvent } from "aws-lambda";

type ProxyEventInput = {
	path: string;
	resource: string;
	method?: string;
	pathParameters?: Record<string, string> | null;
};

// Synthetic REST (proxy v1) event, for tests and INIT priming only.
// Built against the official AWS shape (nullable fields, no `version`),
// then cast: Hono's own LambdaEvent typing is stricter than what API Gateway sends.
export const proxyEvent = ({
	path,
	resource,
	method = "GET",
	pathParameters = null,
}: ProxyEventInput): LambdaEvent => {
	const event: APIGatewayProxyEvent = {
		resource,
		path,
		httpMethod: method,
		headers: { accept: "application/json" },
		multiValueHeaders: { accept: ["application/json"] },
		queryStringParameters: null,
		multiValueQueryStringParameters: null,
		pathParameters,
		stageVariables: null,
		body: null,
		isBase64Encoded: false,
		requestContext: {
			accountId: "000000000000",
			apiId: "synthetic",
			authorizer: null,
			protocol: "HTTP/1.1",
			httpMethod: method,
			identity: {} as APIGatewayProxyEvent["requestContext"]["identity"],
			path,
			stage: "synthetic",
			requestId: "synthetic",
			requestTimeEpoch: 0,
			resourceId: "synthetic",
			resourcePath: resource,
		},
	};
	return event as unknown as LambdaEvent;
};
