---
name: codebase-improvement-audit
description: Audit a mature codebase whose automated quality gates are all green, and turn findings into fixes that stay fixed. Use when asked to audit, review, or "find what's wrong with" a project that already has CI, linters, static gates or a large test suite; when a defect shipped despite passing checks; when proposing performance improvements; or when adding regression coverage after a production bug. Also triggers on "why did the gate not catch this", "is this codebase healthy", "where are the blind spots".
---

# Codebase Improvement Audit

Internal skill — for our own use, not for distribution. No attribution or
licence machinery on purpose; edit it freely as the method sharpens.

A way to audit codebases that already pass their own quality gates: find the
defects those gates structurally cannot see, and close each one so it cannot
ship again. Distilled from real audits of the isiLive addon and similar
gate-heavy projects.

## The stance

A fully-green gate suite is the **starting point** of an audit, not its result.
Gates encode the defect classes someone already thought of; the audit's value
lives in the complement of that set. "All checks pass, no findings" is not an
audit — it is a re-run of the checks.

So the first step after a green baseline is never "verify the gates again". It
is: **name what these gates structurally cannot see.**

## Phase 1 — Map the blind spots before reading any code

For each gate, linter or test category, write down what it *proves* and what it
*cannot* prove. Recurring blind spots, in rough order of yield:

- **Guard-clause-skipped mutations.** `if not <guard> then <mutate> end` with no
  deferred-replay path: while the guard holds, state goes stale and no static
  pattern and no happy-path test sees it. (isiLive: the combat-lockdown role
  marker, twice.)
- **Cross-event temporal gaps.** State correct at each event, wrong across the
  sequence.
- **Stale state after an early return.**
- **Structure-only validation of derived content.** A gate that checks that
  every translated key exists cannot see a value copied verbatim from the
  source. Ask "completeness of *what*, exactly?"
- **A rule scoped to known instances rather than to the property.** A gate whose
  rule set is a list of symbols certifies those symbols while reading as
  coverage of the whole class. See Phase 6. (isiLive: the secret-value gate was
  a watchlist of API names and never saw the masked *payload field* that
  crashed UNIT_AURA in 12.1.)

Record this list. It is the audit's search plan, and it is the deliverable the
maintainer cannot produce for themselves.

## Phase 2 — Find the defects

Four techniques, cheapest first.

**Use the test suite as an oracle for contract violations.** Compare *how tests
access* a structure with *how production accesses* it. Tests search where
production indexes; tests sort where production assumes order — that mismatch is
direct evidence of an unstated contract one side violates. Do this **before**
attempting empirical reproduction, which is slower and often blocked by harness
preconditions.

**Treat completeness claims in comments as audit targets, not context.** "All X
are handled", "this closes the gap", "every caller does Y" — enumerate the
actual set and diff it against the claim. Such comments document intent at
writing time and decay silently as code grows, always toward false confidence:
the stale comment makes the gap look intentional and discourages anyone from
checking. High yield for exactly that reason.

**Compare derived content by value, not by shape.** Where a completeness gate
covers structure only, run a value-equality comparison against the reference
source, filtered to items where identity is actually suspicious. Identical
anomaly counts across several independent targets indicate a systematic backlog
rather than noise.

**Chase guard clauses into their tests.** Having found a
guard-clause-skips-mutation shape, immediately search the corresponding
test/simulator for the guard's own symbol — the lockdown, permission or
feature-flag function name:

```
# production hits vs test hits for the guard's own symbol
<search> "<GuardSymbol>" <production-dirs>
<search> "<GuardSymbol>" <test-dirs>
```

A non-zero production count with a zero test count is the finding. Do this as a
standard follow-up: the thoroughness of the existing test file is not evidence
the guarded-out branch is covered — tests are written against the path the
author was thinking about, which is the path the guard permits, so the more
thorough the file looks, the more that absence gets mistaken for coverage.

## Phase 3 — Make the defect reachable in a test

**When a test cannot reach a branch, check how the dependency is bound before
stubbing harder.** A module-scope `local X = injected or fallback` freezes the
choice at load time. If the test's module list omits the provider, the permissive
fallback is captured permanently: setting the underlying global later changes
nothing, the branch is unreachable by construction, and every scenario silently
exercises the same path while appearing to test many. Control then comes from
the **module load list**, not from the environment at call time. When adding a
module to a load list for this reason, comment *why* — the next maintainer
trimming the list to "only what's needed" will otherwise restore the blind spot.
(isiLive's `roster_panel_render` captures `RI.IsCombatLockdownActive` at load;
the simulator has to load `roster_layout` or every scenario runs the
not-in-combat branch.)

**Write the failing test even when reading already proved the defect.** It is
not ceremony. It quantifies severity into a number usable in the changelog and
commit message, and it forces the under-specified parts of the fix into the
open. Use it to pin the *shape* of correct behaviour, not just its absence: ask
what a lazy fix could do that still passes, and assert against that too. For a
bound, assert *which* items survive; for a sort, assert the order; for a fix
that hides bad state, assert that the good state returns.

## Phase 4 — Performance findings must carry their own evidence

Never ship "this looks O(n·m), here is a faster way". Required, in order:

1. **Measure** to find the real hotspot instead of inferring it from code shape.
2. **Implement** the proposed alternative against the real project data.
3. **Assert equivalence** between current and proposed, and report the diff
   count alongside the speed-up.

A proposal without a measured before/after and an equivalence check is a
hypothesis, not a finding. An optimisation that changes behaviour is a bug, so
"same output" is part of the claim, not an afterthought.

**Keep the original implementation as the oracle.** Run old and new side by side
over the *real corpus*, asserting agreement per item, and include
known-negative inputs so the harness proves the check can still fail. "The gate
is still green" only samples today's all-clean state and cannot show negative
cases still trigger. A behaviour-preserving rewrite is a claim about all inputs.

Rewrites of a scanning predicate deserve one extra look: semantics that are
inert under a repeated per-item probe can become position-advancing under a
single extraction pass, so re-examine every anchor and terminator. (isiLive: a
`gmatch` terminator class consumed the character that started the next match and
reported a live locale key as dead.)

## Phase 5 — Fix without redefining what already worked

A defensive fallback is a behaviour change for **every** input that reaches it,
not only the one that motivated it.

When a fix introduces a fallback for a newly-unreadable or newly-failing input,
enumerate every input that lands on the same sentinel — `nil`, absent, error,
default — and ask: *which of these already had a correct answer, and does my
fallback still give them that answer?* Where a guarded reader collapses states
that are actually distinguishable (present-but-unreadable vs absent), add the
narrower predicate rather than widening the fallback. Reading a sentinel as
evidence of one specific cause is the error. (isiLive: a masked `isFullUpdate`
must infer a full update; an *absent* one must keep its pre-12.1 answer — hence
`IsSecretField` alongside `ReadPlainField`.)

## Phase 6 — Make it un-shippable, and prove it

**Define the invariant before writing the check.** Name the property the gate
enforces, then enumerate the channels through which a violating value can enter:
function returns, event/callback arguments, fields of externally-supplied
structures, iterator values, library callbacks. Cover each channel, or record in
the check's header which channels are deliberately out of scope and why. A gate
whose rule set is a list of known symbols should be reviewed as incomplete by
default.

**Verify new regression coverage against the defect's own revision.** Passing on
the fixed tree and firing on hand-written fixtures establishes nothing that
matters: fixtures are written by whoever just internalised the fix, so they
reproduce the defect as understood *after* the fact, in the shape the new rule
expects. Version control makes the real check nearly free:

```
# feed the pre-fix revision into the new check
<vcs> show <pre-fix-rev>:<path> > <scratch-copy>
<run the new check / scenario against the scratch copy>
```

Record **both** outcomes: what the new coverage catches, and what it
demonstrably still misses. The misses belong in the check's header as declared
scope — undeclared blind spots are exactly what let the previous gate read as
coverage. (isiLive: the extended secret-value gate, run against the shipped
revision, fired on the crashing line plus three same-class lines nobody had
reported, and produced zero hits on one file — surfacing that the rule is
line-local.)

**When a defect appears in a class that already has a gate, "why did the gate
not see this?" is a required finding**, separate from and reported alongside the
fix.

## Pre-flight — run before delivering the audit

Re-read this list and check the output against it. Rules in a skill are not
reliably followed during analysis; this step is the enforcement.

1. Does the report say what the existing gates **cannot** see, not just what
   they do?
2. Is every finding traced to a specific location, with a concrete failure
   scenario — inputs/state leading to wrong output?
3. Does every performance claim carry a measured before/after **and** an
   equivalence result?
4. For each fix: which other inputs reach the new fallback, and do they keep
   their previous answer?
5. For each new check: which entry channels are covered, which are declared out
   of scope, and was it run against the defect's own revision?
6. For each guard-clause finding: was the corresponding test searched for the
   guard's own symbol?
7. Is anything reported as fixed actually verified, with the command output to
   show it?
