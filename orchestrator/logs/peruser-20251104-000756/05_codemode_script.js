
  const id = await codemode["context7__resolve-library-id"]({ libraryName: "lodash" });
  const docs = await codemode["context7__get-library-docs"]({ context7CompatibleLibraryID: "/lodash/lodash", tokens: 2000 });
  return { id, docs };
