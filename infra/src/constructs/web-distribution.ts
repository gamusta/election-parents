import { CloudfrontDistribution } from "@cdktn/provider-aws/lib/cloudfront-distribution";
import { CloudfrontFunction } from "@cdktn/provider-aws/lib/cloudfront-function";
import { CloudfrontOriginAccessControl } from "@cdktn/provider-aws/lib/cloudfront-origin-access-control";
import { DataAwsCallerIdentity } from "@cdktn/provider-aws/lib/data-aws-caller-identity";
import { DataAwsCloudfrontCachePolicy } from "@cdktn/provider-aws/lib/data-aws-cloudfront-cache-policy";
import { DataAwsCloudfrontOriginRequestPolicy } from "@cdktn/provider-aws/lib/data-aws-cloudfront-origin-request-policy";
import { DataAwsIamPolicyDocument } from "@cdktn/provider-aws/lib/data-aws-iam-policy-document";
import { S3Bucket } from "@cdktn/provider-aws/lib/s3-bucket";
import { S3BucketPolicy } from "@cdktn/provider-aws/lib/s3-bucket-policy";
import { S3BucketPublicAccessBlock } from "@cdktn/provider-aws/lib/s3-bucket-public-access-block";
import { Construct } from "constructs";

// SPA routing: any path without a file extension serves index.html.
// Bound to the default behavior only, so /api/* errors stay untouched (phase 3).
const SPA_REWRITE = `function handler(event) {
      var request = event.request;
      var last = request.uri.split("/").pop();
      if (last.indexOf(".") === -1) {
              request.uri = "/index.html";
      }
      return request;
}`;

// API Gateway resources have no /api prefix; originPath then adds /<stage>.
const API_STRIP_PREFIX = `function handler(event) {
    var request = event.request;
    request.uri = request.uri.replace(/^\\/api/, "") || "/";
    return request;
}`;

export interface WebDistributionProps {
	stage: string;
	// Regional REST API host, e.g. <id>.execute-api.<region>.amazonaws.com
	apiDomainName: string;
	apiStageName: string;
}

export class WebDistribution extends Construct {
	readonly bucket: S3Bucket;
	readonly distribution: CloudfrontDistribution;

	constructor(scope: Construct, id: string, props: WebDistributionProps) {
		super(scope, id);

		const caller = new DataAwsCallerIdentity(this, "caller");

		this.bucket = new S3Bucket(this, "bucket", {
			bucket: `${props.stage}-election-parents-web-${caller.accountId}`,
			// Content is rebuilt by CI; lets destroy empty the bucket.
			forceDestroy: true,
		});

		new S3BucketPublicAccessBlock(this, "bucket_pab", {
			bucket: this.bucket.id,
			blockPublicAcls: true,
			blockPublicPolicy: true,
			ignorePublicAcls: true,
			restrictPublicBuckets: true,
		});

		const oac = new CloudfrontOriginAccessControl(this, "oac", {
			name: `${props.stage}-web-oac`,
			originAccessControlOriginType: "s3",
			signingBehavior: "always",
			signingProtocol: "sigv4",
		});

		const spaRewrite = new CloudfrontFunction(this, "spa_rewrite", {
			name: `${props.stage}-spa-rewrite`,
			runtime: "cloudfront-js-2.0",
			code: SPA_REWRITE,
			publish: true,
		});

		const apiStripPrefix = new CloudfrontFunction(this, "api_strip_prefix", {
			name: `${props.stage}-api-strip-prefix`,
			runtime: "cloudfront-js-2.0",
			code: API_STRIP_PREFIX,
			publish: true,
		});

		const cachingDisabled = new DataAwsCloudfrontCachePolicy(
			this,
			"caching_disabled",
			{ name: "Managed-CachingDisabled" },
		);

		// Forwards headers, query strings and cookies, but not Host:
		// API Gateway routes on Host/SNI and rejects the CloudFront domain.
		const allViewerExceptHost = new DataAwsCloudfrontOriginRequestPolicy(
			this,
			"all_viewer_except_host",
			{ name: "Managed-AllViewerExceptHostHeader" },
		);

		const apiOriginId = "api";

		// Honors origin Cache-Control (set per file at upload, phase 4).
		const cachingOptimized = new DataAwsCloudfrontCachePolicy(
			this,
			"caching_optimized",
			{ name: "Managed-CachingOptimized" },
		);

		const webOriginId = "web";

		this.distribution = new CloudfrontDistribution(this, "distribution", {
			enabled: true,
			comment: `${props.stage} election-parents web`,
			defaultRootObject: "index.html",
			isIpv6Enabled: true,
			httpVersion: "http2and3",
			priceClass: "PriceClass_100",
			origin: [
				{
					originId: webOriginId,
					domainName: this.bucket.bucketRegionalDomainName,
					originAccessControlId: oac.id,
				},
				{
					originId: apiOriginId,
					domainName: props.apiDomainName,
					originPath: `/${props.apiStageName}`,
					customOriginConfig: {
						httpPort: 80,
						httpsPort: 443,
						originProtocolPolicy: "https-only",
						originSslProtocols: ["TLSv1.2"],
					},
				},
			],
			defaultCacheBehavior: {
				targetOriginId: webOriginId,
				viewerProtocolPolicy: "redirect-to-https",
				allowedMethods: ["GET", "HEAD"],
				cachedMethods: ["GET", "HEAD"],
				cachePolicyId: cachingOptimized.id,
				compress: true,
				functionAssociation: [
					{ eventType: "viewer-request", functionArn: spaRewrite.arn },
				],
			},
			orderedCacheBehavior: [
				{
					pathPattern: "/api/*",
					targetOriginId: apiOriginId,
					viewerProtocolPolicy: "https-only",
					allowedMethods: [
						"GET",
						"HEAD",
						"OPTIONS",
						"PUT",
						"POST",
						"PATCH",
						"DELETE",
					],
					cachedMethods: ["GET", "HEAD"],
					cachePolicyId: cachingDisabled.id,
					originRequestPolicyId: allViewerExceptHost.id,
					compress: true,
					functionAssociation: [
						{ eventType: "viewer-request", functionArn: apiStripPrefix.arn },
					],
				},
			],
			restrictions: { geoRestriction: { restrictionType: "none" } },
			viewerCertificate: { cloudfrontDefaultCertificate: true },
		});

		const bucketPolicy = new DataAwsIamPolicyDocument(
			this,
			"bucket_policy_doc",
			{
				statement: [
					{
						sid: "CloudFrontOacRead",
						effect: "Allow",
						actions: ["s3:GetObject"],
						resources: [`${this.bucket.arn}/*`],
						principals: [
							{ type: "Service", identifiers: ["cloudfront.amazonaws.com"] },
						],
						condition: [
							{
								test: "StringEquals",
								variable: "AWS:SourceArn",
								values: [this.distribution.arn],
							},
						],
					},
				],
			},
		);

		new S3BucketPolicy(this, "bucket_policy", {
			bucket: this.bucket.id,
			policy: bucketPolicy.json,
		});
	}
}
