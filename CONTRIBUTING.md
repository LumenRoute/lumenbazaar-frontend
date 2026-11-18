# Contributing

Keep changes scoped to one issue-sized unit and include tests or focused validation evidence with
each pull request.

## Local Flow

```bash
pnpm install
pnpm check
```

Enable the repository hook and run the dependency-free malware checks before pushing:

```bash
pnpm security:install-hooks
pnpm security:malware-scan
pnpm security:malware-test
```

## Pull Requests

- Explain the user-facing behavior being changed.
- Include screenshots for UI changes when possible.
- Keep wallet and payment logic non-custodial.
- Do not claim official Stellar, SDF, or SCF endorsement.
