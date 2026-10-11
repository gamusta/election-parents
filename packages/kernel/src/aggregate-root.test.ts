import { describe, expect, it } from "vitest";
import { AggregateRoot } from "./aggregate-root";
import type { DomainEvent } from "./domain-event";

type Pinged = DomainEvent<"Pinged">;

class Probe extends AggregateRoot<Pinged> {
	ping(at: Date) {
		this.record({ type: "Pinged", version: 1, occurredAt: at });
	}
}

describe("AggregateRoot", () => {
	it("starts with no pending events", () => {
		expect(new Probe().pullEvents()).toEqual([]);
	});

	it("returns recorded events in order", () => {
		const probe = new Probe();
		probe.ping(new Date(1));
		probe.ping(new Date(2));

		expect(probe.pullEvents().map((e) => e.occurredAt.getTime())).toEqual([
			1, 2,
		]);
	});

	it("clears events once pulled, so they are published once", () => {
		const probe = new Probe();
		probe.ping(new Date(1));
		probe.pullEvents();

		expect(probe.pullEvents()).toEqual([]);
	});
});
