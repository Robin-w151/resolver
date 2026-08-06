---
'@robinw151/resolver': patch
---

Fix tasks not being cancelled when a resolution using `withLoadingState` is unsubscribed while the
loading state is emitted. Consuming only the loading state (for example via `take(1)` or
`firstValueFrom`) left the running tasks without a teardown, so they kept executing, dependent tasks
still started, and never completing tasks stayed subscribed indefinitely.
