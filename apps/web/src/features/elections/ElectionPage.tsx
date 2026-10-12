import type { ElectionResponse } from "@election/contracts";

type Props = { election: ElectionResponse };

export function ElectionPage({ election }: Props) {
	return (
		<>
			<h1>Liste candidats</h1>
			<ul>
				{election.lists.map((list) => (
					<li key={list.id}>{list.name}</li>
				))}
			</ul>
		</>
	);
}
