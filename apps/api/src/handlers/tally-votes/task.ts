import { ElectionTaskSchema } from "@election/contracts";
import type { tallyVotes } from "@election/voting";
import { logger } from "../../http/log";
import { TaskError } from "../../workflow/task-error";

type Deps = { tally: ReturnType<typeof tallyVotes> };

export const buildTask =
	({ tally }: Deps) =>
	async (event: unknown) => {
		const input = ElectionTaskSchema.safeParse(event);
		if (!input.success) throw new TaskError("invalid_input");
		const { electionId } = input.data;

		const result = await tally(electionId);
		if (!result.ok) {
			logger.warn("tally refused", { electionId, error: result.error });
			throw new TaskError(result.error);
		}
		// Aggregated counts only (public results): never a ballot.
		logger.info("votes tallied", {
			electionId,
			totalVotes: result.value.totalVotes,
		});
		return { electionId, totalVotes: result.value.totalVotes };
	};
