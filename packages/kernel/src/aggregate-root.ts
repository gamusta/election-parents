import type { DomainEvent } from "./domain-event";

/** Records domain events; the application pulls them after saving. */
export abstract class AggregateRoot<E extends DomainEvent> {
	private pending: E[] = [];

	protected record(event: E): void {
		this.pending.push(event);
	}

	pullEvents(): E[] {
		const events = this.pending;
		this.pending = [];
		return events;
	}
}
