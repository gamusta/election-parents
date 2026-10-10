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
const appStack = new AppStack(app, `${stage}-app`, {
	stage,
});
// No cross-stack reference yet: make the deploy order explicit.
appStack.addDependency(data);

app.synth();
