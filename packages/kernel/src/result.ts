export type Result<T, E> = Ok<T> | Err<E>;

export interface Ok<T> {
	readonly ok: true;
	readonly value: T;
}

export interface Err<E> {
	readonly ok: false;
	readonly error: E;
}

export function ok(): Ok<void>;
export function ok<T>(value: T): Ok<T>;
export function ok<T>(value?: T): Ok<T | undefined> {
	return { ok: true, value };
}
// `const` keeps literal error codes ("invalid_seat_count") instead of widening to string.
export const err = <const E>(error: E): Err<E> => ({ ok: false, error });
