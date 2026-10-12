import {
	type ElectionResponse,
	ElectionResponseSchema,
} from "@election/contracts";
import { config } from "../lib/config";

export async function getElection(
	id: string,
): Promise<ElectionResponse | null> {
	const res = await fetch(
		`${config.apiUrl}/elections/${encodeURIComponent(id)}`,
	);
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`GET /elections/${id} failed: ${res.status}`);
	return ElectionResponseSchema.parse(await res.json());
}
