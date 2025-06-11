declare module 'pdfjs-dist/build/pdf' {
  export const GlobalWorkerOptions: { workerSrc: string };

  interface PDFPageProxy {
    getTextContent(): Promise<{ items: Array<{ str: string }> }>;
    // Define other methods/properties of PDFPageProxy if needed
  }

  interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
    // Define other methods/properties of PDFDocumentProxy if needed
  }

  interface PDFLoadingTask {
    promise: Promise<PDFDocumentProxy>;
  }

  export function getDocument(src: string | URL | Uint8Array | { data: Uint8Array } | { url: string }): PDFLoadingTask;
}

declare module 'pdfjs-dist/build/pdf.worker.mjs?url' {
  const pdfjsWorker: string;
  export default pdfjsWorker;
}
