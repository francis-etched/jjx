import { render } from "preact";
import { App, initVsCodeApi } from "./app";
import "./styles/global.css";

initVsCodeApi();
render(<App />, document.getElementById("root")!);
