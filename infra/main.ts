import { App } from "cdktn";
import { AppStack } from "./src/stacks/app";
import { BootstrapStack } from "./src/stacks/bootstrap";

const stage = process.env.STAGE ?? "dev";

const app = new App();
new BootstrapStack(app, `${stage}-bootstrap`, {
	stage,
	githubSubPrefix: "gamusta@8771520/election-parents@1408060936",
});
new AppStack(app, `${stage}-app`, {
	stage,
});

app.synth();
