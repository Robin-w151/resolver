---
'@robinw151/resolver': minor
---

Require the constructor's global arguments whenever `TGlobalArgs` cannot be `undefined`. Task
functions and the resolve result declare the global arguments as `TGlobalArgs`, but the constructor
accepted no value at all, so `new Resolver<{ apiKey: string }>()` type checked while every task was
handed `undefined`.

This is a type level change only, the runtime behaviour is unchanged. `new Resolver()` and
`new Resolver(globalArgs)` keep working as before. If the global arguments are only supplied later
through `setGlobalArgs()` or `resolve({ globalArgs })`, include `undefined` in the type, for example
`new Resolver<{ apiKey: string } | undefined>()`.
