import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { getElection } from "../../api/elections";
import { ElectionPage } from "../../features/elections/ElectionPage";

export const Route = createFileRoute("/elections/$id")({
	component: ElectionRoute,
});

function ElectionRoute() {
	const { id } = Route.useParams();
	const { data, isPending, isError } = useQuery({
		queryKey: ["election", id],
		queryFn: () => getElection(id),
	});

	if (isPending) return <p>Chargement…</p>;
	if (isError) return <p>Erreur de chargement.</p>;
	if (data === null) return <p>Élection introuvable.</p>;
	return <ElectionPage election={data} />;
}
