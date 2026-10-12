import type { ElectionResponse } from "@election/contracts";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ElectionPage } from "./ElectionPage";

const election: ElectionResponse = {
	id: "00000000-0000-4000-8000-000000000001",
	status: "open",
	opensAt: "2026-10-01T08:00:00Z",
	closesAt: "2026-10-15T18:00:00Z",
	seats: 3,
	lists: [
		{ id: "00000000-0000-4000-8000-0000000000a1", name: "Liste A" },
		{ id: "00000000-0000-4000-8000-0000000000b2", name: "Liste B" },
	],
};

it("affiche le nom des listes", () => {
	render(<ElectionPage election={election} />);
	expect(screen.getByText("Liste A")).toBeInTheDocument();
	expect(screen.getByText("Liste B")).toBeInTheDocument();
});
