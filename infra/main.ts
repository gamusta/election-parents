import { App } from "cdktn";
import { BootstrapStack } from "./src/stacks/bootstrap";

const stage = process.env.STAGE ?? "dev";

const app = new App();
new BootstrapStack(app, `${stage}-bootstrap`, { stage });
app.synth();