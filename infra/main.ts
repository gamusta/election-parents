import { App } from "cdktn";
import { AppStack } from "./src/stacks/app";
import { BootstrapStack } from "./src/stacks/bootstrap";
import { DataStack } from "./src/stacks/data";

const stage = process.env.STAGE ?? "dev";

const app = new App();
new BootstrapStack(app, `${stage}-bootstrap`, {
	stage,
	githubSubPrefix: "gamusta@8771520/election-parents@1408060936",
});
const data = new DataStack(app, `${stage}-data`, { stage });
new AppStack(app, `${stage}-app`, {
	stage,
	table: data.table,
	corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
});

app.synth();
