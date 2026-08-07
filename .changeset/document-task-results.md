---
'@robinw151/resolver': patch
---

Document how a task's result is derived from what its function returns. For an `Observable` the
first emitted value becomes the result and the subscription is closed afterwards, so later emissions
never occur and the source is cancelled. The `Task` type, `register()` and the README now describe
this, including how to use `last()` or `toArray()` when a different value is needed.
