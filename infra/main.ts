import { App } from "cdktn";
import { BootstrapStack } from "./src/stacks/bootstrap";

const stage = process.env.STAGE ?? "dev";

const app = new App();
new BootstrapStack(app, `${stage}-bootstrap`, { stage, githubSubPrefix: "gamusta@8771520/election-parents@1408060936" });
app.synth();