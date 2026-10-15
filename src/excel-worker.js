import { readExcel } from "./excel-import.mjs";

self.onmessage = async ({ data }) => {
  try { self.postMessage({ dataset: await readExcel(data.buffer, data.fileName) }); }
  catch (error) { self.postMessage({ error: error.message }); }
};
