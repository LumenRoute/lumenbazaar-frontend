# Repository Governance

Changes to `main` use a pull request with the `check` CI job, one approving review, resolved
conversations, and code-owner review for owned paths. Stale approvals are dismissed when the head
changes. Administrators follow the same rule during ordinary work.

Releases use annotated or signed tags and a GitHub release that records the source commit, production
build, backend revision/URL, network flags, dependency policy result, external wallet evidence, and
changelog. A Vercel URL without a pinned commit is not release evidence.

An emergency exception is limited to an actively exploitable security issue or user/funds safety
incident. The maintainer records the reason and UTC time, uses the smallest change, runs all feasible
checks, restores protection immediately, and opens a retrospective pull request within one business
day. The exception never permits collecting or committing wallet secrets.
