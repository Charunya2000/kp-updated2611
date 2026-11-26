import { Annotation, StateGraph, START, END } from "./langgraphs/langgraph-light.js";
import { validateAndAcquireToken } from './sharepointGetAccessToken.js';
import { getFilesInFolder } from './sharepointGetFilesInFolder.js';
import { setProcessEnvironment } from '../../scripts/configActions.js';

// Define the state annotations
const StateAnnotation = Annotation.Root({
  siteUrl: Annotation,
  folderRelativeUrl: Annotation,
  accessToken: Annotation,
  files: Annotation,
});

// Define the nodes
const configNode = async (state) => {
  console.log(`-----configNode-----`);
  await setProcessEnvironment();
  return {};
};

const getTokenNode = async (state) => {
  console.log(`-----getTokenNode-----`);
  const accessToken = await validateAndAcquireToken();
  console.log(`accessToken: ${accessToken}`);
  return { accessToken };
};

const getFilesNode = async (state) => {
  console.log(`-----getFilesNode-----`);
  // const files = await getFilesInFolder(state.accessToken, state.siteUrl, state.folderRelativeUrl);
  const files = ["file1.docx", "file2.xlsx"];
  return { files };
};

// Build the state graph
const graphBuilder = new StateGraph(StateAnnotation);

const graph = graphBuilder
  .addNode("configNode", configNode)
  .addNode("getTokenNode", getTokenNode)
  .addNode("getFilesNode", getFilesNode)
  .addEdge(START, "configNode")
  .addEdge("configNode", "getTokenNode")
  .addEdge("getTokenNode", "getFilesNode")
  .addEdge("getFilesNode", END)
  .compile();

// Function to process the SharePoint data
export async function processSharePointData({ siteUrl, folderRelativeUrl }) {
  const { files } = await graph.invoke({
    siteUrl: siteUrl,
    folderRelativeUrl: folderRelativeUrl,
  });
  return files;
}

// Example usage
(async () => {
  const siteUrl = 'https://sp-cloud.kp.org/sites/genAIPortalTestSite'; // Replace with your SharePoint site URL
  const folderRelativeUrl = 'Shared Documents'; // Replace with your folder's relative URL
  const files = await processSharePointData({ siteUrl, folderRelativeUrl });
  console.log(files);
})();