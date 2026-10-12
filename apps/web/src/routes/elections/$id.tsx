import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/elections/$id")({
	component: ElectionPage,
});

function ElectionPage() {
	const { id } = Route.useParams();
	return <h1>Élection {id}</h1>;
}
