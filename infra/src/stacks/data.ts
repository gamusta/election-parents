import { DynamodbTable } from "@cdktn/provider-aws/lib/dynamodb-table";
import { AwsProvider } from "@cdktn/provider-aws/lib/provider";
import { S3Backend, TerraformOutput, TerraformStack } from "cdktn";
import type { Construct } from "constructs";

export interface DataStackProps {
	stage: string;
}

export class DataStack extends TerraformStack {
	readonly table: DynamodbTable;

	constructor(scope: Construct, id: string, props: DataStackProps) {
		super(scope, id);

		const stateBucketName = process.env.TF_STATE_BUCKET;
		if (!stateBucketName) {
			throw new Error("TF_STATE_BUCKET is not set");
		}

		this.table = new DynamodbTable(this, "election_table", {
			name: `${props.stage}-election`,
			billingMode: "PAY_PER_REQUEST",
			hashKey: "pk",
			rangeKey: "sk",
			// Only key attributes are declared; everything else is schemaless.
			attribute: [
				{ name: "pk", type: "S" },
				{ name: "sk", type: "S" },
				{ name: "gsi1pk", type: "S" },
				{ name: "gsi1sk", type: "S" },
			],
			// Sparse: only Election items carry gsi1pk/gsi1sk (elections by school).
			globalSecondaryIndex: [
				{
					name: "gsi1",
					keySchema: [
						{ attributeName: "gsi1pk", keyType: "HASH" },
						{ attributeName: "gsi1sk", keyType: "RANGE" },
					],
					projectionType: "ALL",
				},
			],
			ttl: { attributeName: "expiresAt", enabled: true },
			streamEnabled: true,
			streamViewType: "NEW_AND_OLD_IMAGES",
			// enabled without kmsKeyArn = AWS managed key (aws/dynamodb).
			serverSideEncryption: { enabled: true },
			// ~0.20 USD/GB-month; table is a few MB → negligible.
			pointInTimeRecovery: { enabled: true },
		});

		new TerraformOutput(this, "table_name", { value: this.table.name });
		new TerraformOutput(this, "table_arn", { value: this.table.arn });
		new TerraformOutput(this, "table_stream_arn", {
			value: this.table.streamArn,
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
			key: `${props.stage}/data.tfstate`,
			region: "eu-west-1",
			encrypt: true,
			useLockfile: true,
		});
	}
}
