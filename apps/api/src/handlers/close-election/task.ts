import { ElectionTaskSchema } from "@election/contracts";
import type { closeElection } from "@election/voting";
import { logger } from "../../http/log";
import { TaskError } from "../../workflow/task-error";

type Deps = { close: ReturnType<typeof closeElection>; now: () => Date };

export const buildTask =
	({ close, now }: Deps) =>
	async (event: unknown) => {
		const input = ElectionTaskSchema.safeParse(event);
		if (!input.success) throw new TaskError("invalid_input");
		const { electionId } = input.data;

		const result = await close(electionId, now());
		if (!result.ok) {
			logger.warn("close refused", { electionId, error: result.error });
			throw new TaskError(result.error);
		}
		logger.info("election closed", { electionId, outcome: result.value });
		// Output = next state's input: identifiers only (256 KiB state limit).
		return { electionId, outcome: result.value };
	};
