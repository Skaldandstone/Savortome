# Current Wispling alpha handoff

The active-alpha adaptation is implemented in the isolated worktree at `C:\Users\James\Documents\GitHub\.worktrees\wispling-alpha-secondbreakfast` on branch `codex/alpha-second-breakfast-handoff`. The canonical Wispling alpha checkout remains untouched.

The handoff is default-off, appears only after Wispling's existing explicit Food choice, uses a strict query allowlist, sends no health or completion information, falls back to the care website when the app is absent, and accepts only the fixed `wispling://care-return` route. Its generated Android manifest retains the alpha backup and cleartext protections.

Evidence and the nine-file patch are in the isolated worktree:

- `docs/second-breakfast-active-alpha-evidence.md`
- `docs/second-breakfast-active-alpha-files.json`
- `docs/second-breakfast-active-alpha.patch`

The patch SHA-256 is `a73928592d45345ded1a42341cd19728bdd2e6642b4aa0aedfb2308255185225`. TypeScript, all 185 Jest tests, 14 release-policy tests, Expo Android prebuild, forward apply-check, and reverse apply-check passed.

The isolated worktree also contains `artifacts/review/wispling-second-breakfast-x86_64-emulator.apk`, SHA-256 `63b78a0c83837aad4b4108b56327ec42032c0033c9da6462ec2776e3eb71fcce`. It is an x86_64, debug-signed local review copy of the alpha's non-debuggable unsigned release. Package, ABI, signature, privacy manifest settings, and packaged handoff markers were inspected. The host AVD still cannot boot because firmware virtualization is disabled, so emulator and physical-device behavior remain open acceptance gates.
