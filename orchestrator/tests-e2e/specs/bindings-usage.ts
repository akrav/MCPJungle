// types are included via tsconfig include of artifacts/types.d.ts
type _Check = Parameters<typeof tools.sample__calculate>[0];
const x: _Check = { expression: '2+2' };
console.log(x);