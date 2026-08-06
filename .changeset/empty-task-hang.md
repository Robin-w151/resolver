---
'@robinw151/resolver': patch
---

Fix resolution hanging forever when a task's Observable completes without emitting a value. Such
tasks now resolve with an `EmptyTaskError` instead of leaving the whole task graph pending.
