import { Testing } from "cdktn";
import { beforeAll, describe, expect, it } from "vitest";
import { DataStack } from "./data";

describe("DataStack", () => {
	let raw: string;
	let table: Record<string, unknown>;

	beforeAll(() => {
		process.env.TF_STATE_BUCKET = "test-state-bucket";
		const app = Testing.app();
		raw = Testing.synth(new DataStack(app, "test-data", { stage: "test" }));
		// resource.<type>.<logical id> → the only table in the stack.
		[table] = Object.values(JSON.parse(raw).resource.aws_dynamodb_table);
	});

	it("creates the election table", () => {
		expect(table).toMatchObject({
			name: "test-election",
			billing_mode: "PAY_PER_REQUEST",
			hash_key: "pk",
			range_key: "sk",
			stream_view_type: "NEW_AND_OLD_IMAGES",
		});
	});

	it("declares the gsi1 index", () => {
		expect(table.global_secondary_index).toEqual([
			expect.objectContaining({
				name: "gsi1",
				key_schema: [
					{ attribute_name: "gsi1pk", key_type: "HASH" },
					{ attribute_name: "gsi1sk", key_type: "RANGE" },
				],
			}),
		]);
	});

	it("contains no wildcard", () => {
		expect(raw).not.toMatch(/"\*"|:\*"/);
	});
});
