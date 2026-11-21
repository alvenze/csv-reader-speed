# csv-reader-speed

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/alvenze/csv-reader-speed/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/alvenze/csv-reader-speed/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in replacement for csv-reader 1.0.0, the reference CSV reader in make.fun's "Read broken CSV files faster" bounty. `run(input)` in solve.js returns exactly the reference's answer for every input, `{columns, rows, errors}` under its broken-row policy (BOM dropped, records end at LF or CRLF, blank lines are no records, stray CRs dropped with `stray_cr`, quoted fields with `""` escapes and CR/CRLF inside read as LF, junk after a closing quote appended with `quote_junk`, a quote that never closes read literally with `unterminated_quote`, rows padded or cut to the first record's width with `short_row` / `long_row`).

Where the reference reads one character at a time and builds every field character by character, this reader moves in slices: it jumps between delimiters with `indexOf` and cuts each clean run of text out with a single `slice`, assembling a field from slices only where the text is actually broken (a stray CR, a doubled quote, a CR inside quotes). Verified identical to the reference on the official practice set and on generated case sets from the bounty's own generator; about 3x less CPU on the practice set.

## Run it

```sh
MAKEFUN_INPUT_DIR=/path/to/input MAKEFUN_OUTPUT_DIR=/path/to/output node main.ts
```

`main.ts` is the house driver: it reads `cases.json` from the input directory, answers each case with `run()` from solve.js, and writes `answers.json` to the output directory.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
