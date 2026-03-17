---
name: feedback_no_git
description: User handles all git operations themselves — do not commit, push, or run git commands on their behalf
type: feedback
---

Do not run git commit, git push, or other git write operations. The user manages all git operations themselves.

**Why:** User preference — they want full control over their git history.

**How to apply:** When dispatching subagents, explicitly instruct them NOT to commit. Skip all commit steps in plans. Only use git for read operations (log, diff, status, rev-parse) when needed for context.
