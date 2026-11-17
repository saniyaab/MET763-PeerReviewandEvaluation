<!-- AI_USAGE_LOG -->
## AI Usage Log

| Item | Value |
|---|---|
| AI tool / model | Claude (Anthropic) agent, Claude Code / Agent SDK harness, `claude-opus-5-5` |
| Conceptual AI contribution | **100% AI generated / 0% human** (downloaded the run log with `gh run view --log` and wrote this index) |
| Session link | https://claude.ai/code/session_01Mj79JHpoGSSrKQhMcsCbL5 |
| Student prompts (verbatim) | [`/.ai_logs/pa2-session-log.md`](../../.ai_logs/pa2-session-log.md) |

---
<!-- /AI_USAGE_LOG -->
# PA2 pipeline logs

| File | Run | Commit | Result |
|---|---|---|---|
| [`pa2-run-44004909266.log`](pa2-run-44004909266.log) | [GitHub Actions run 44004909266](https://github.com/saniyaab/MET763-PeerReviewandEvaluation/actions/runs/44004909266) | `AI: fix Content-Disposition assertion in report integration test` | ✅ success |
| [`pa2-run-44027046164.log`](pa2-run-44027046164.log) | [GitHub Actions run 44027046164](https://github.com/saniyaab/MET763-PeerReviewandEvaluation/actions/runs/44027046164) (manual re-run) | `caf67b5` (same application code) | ✅ success. First run after fixing SonarCloud's branch setup; its SonarQube result is the one used in the triage report. Unit 5/5, integration 20/20, Semgrep 0, Trivy unchanged |

What the log shows (search the file for these lines):

| Job | Result in the log |
|---|---|
| Build & Docker image | `npm ci`, TypeScript build, unit tests `# pass 5 / # fail 0`, multi-stage image built, compose stack up (`/health/ready` → database up), API integration tests `# tests 20 / # pass 20 / # fail 0` |
| Semgrep SAST (non-blocking) | `Ran 136 rules on 19 files: 0 findings.` (rulesets: typescript, nodejs, expressjs, dockerfile, secrets, security-audit; SARIF + JSON reports uploaded as the `semgrep-report` artifact) |
| SonarQube Cloud SAST (non-blocking) | `ANALYSIS SUCCESSFUL` / `EXECUTION SUCCESS`. Run 44004909266's analysis was inconclusive (branch misconfiguration); run 44027046164 is the valid SonarQube analysis (1 issue, see `../sast-triage-report.md` section 2.2) |
| Trivy (non-blocking) | App dependency (`package-lock.json`) scan clean. Image scan: `alpine 3.24.4` 1 MEDIUM; `Node.js (node-pkg)` 23 (10 HIGH, 12 MEDIUM, 1 LOW) in packages bundled with npm in the `node:22-alpine` base image (e.g. `brace-expansion`, `glob`, `@sigstore/core`) |

The previous run, [44004585834](https://github.com/saniyaab/MET763-PeerReviewandEvaluation/actions/runs/44004585834), failed 19/20 integration tests because of a wrong assertion in the agent's test (see the session log). It is not saved here.
