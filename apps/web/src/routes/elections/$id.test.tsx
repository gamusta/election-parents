import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { routeTree } from "../../routeTree.gen";

vi.mock("../../api/elections", () => ({
	getElection: vi.fn(async () => null),
}));

it("affiche « introuvable » quand l'API répond 404", async () => {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: ["/elections/42"] }),
	});
	render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);
	expect(await screen.findByText("Élection introuvable.")).toBeInTheDocument();
});
