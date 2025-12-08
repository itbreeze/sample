export const DEFAULT_DOC_VERSION = '001';

export const getDocumentKey = (docId, docVr = DEFAULT_DOC_VERSION) => {
  if (!docId) return null;
  const version = docVr || DEFAULT_DOC_VERSION;
  return `${docId}:${version}`;
};

export const getDocumentKeyFromFile = (file = {}) => {
  const docId = file.DOCNO || file.docno || file.docId || file.DOCID || null;
  const docVr =
    file.DOCVR ||
    file.docVr ||
    file.DOCVER ||
    file.docVer ||
    file.docversion ||
    file.DOCVERSION ||
    DEFAULT_DOC_VERSION;
  return getDocumentKey(docId, docVr);
};
