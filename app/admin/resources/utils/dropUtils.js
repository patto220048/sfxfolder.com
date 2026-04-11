/**
 * Utilities for handling file drops, especially for directory scanning.
 */

export const getFilesFromDataTransfer = async (dataTransfer) => {
  const items = dataTransfer.items;
  if (!items) return Array.from(dataTransfer.files);

  const entries = [];
  for (const item of items) {
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry();
      if (entry) entries.push(entry);
    }
  }

  return await getFilesFromEntries(entries);
};

export const getFilesFromEntries = async (entries) => {
  const files = [];
  const queue = [...entries];

  const readEntriesPromise = (directoryReader) => {
    return new Promise((resolve, reject) => {
      directoryReader.readEntries(resolve, reject);
    });
  };

  const getFilePromise = (fileEntry) => {
    return new Promise((resolve, reject) => {
      fileEntry.file(resolve, reject);
    });
  };

  while (queue.length > 0) {
    const entry = queue.shift();
    if (!entry) continue;

    if (entry.isFile) {
      const file = await getFilePromise(entry);
      // We can attach fullPath if needed
      Object.defineProperty(file, 'fullPath', {
        value: entry.fullPath.substring(1),
        writable: false,
      });
      files.push(file);
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      let readResult;
      do {
        readResult = await readEntriesPromise(dirReader);
        queue.push(...readResult);
      } while (readResult.length > 0);
    }
  }

  return files;
};
