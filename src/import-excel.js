export async function importExcelFile(file, source = "operations") {
  if (!/\.xlsx$/i.test(file.name)) throw Error("Selecione um arquivo Excel no formato .xlsx.");
  const buffer = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./excel-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => {
      worker.terminate();
      if (data.error) reject(Error(data.error));
      else resolve(data.dataset);
    };
    worker.onerror = () => {
      worker.terminate();
      reject(Error("Não foi possível processar a planilha. Tente novamente com um arquivo .xlsx válido."));
    };
    worker.postMessage({ buffer, fileName: file.name, source }, [buffer]);
  });
}
