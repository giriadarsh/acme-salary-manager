# AI collaboration log

ChatGPT was used as an agentic coding assistant for the assessment. This log records the actual collaboration and checks performed during implementation.

| Stage | Input or instruction | Decision and verification |
| --- | --- | --- |
| Product framing | “You are SDE 2 like me, i want the possible assignment,” with Incubyte’s full brief. | Centered the work on search, one salary edit, history, and reporting. Deferred Excel import and FX conversion. Committed `REQUIREMENTS.md` first. |
| Stack and delivery | “for database we can use postgresql, lets create a git repo and complete this assignment end end. with all the details given in the requirement. and we can use dockerised container which can help anyone to start easily” | Switched the suggested database from SQLite to PostgreSQL. Used Node, TypeScript, and React to match the assessed role. Added a Compose setup, production image, and a deployment blueprint. |
| Implementation | The assistant translated the acceptance criteria into routes, SQL, UI, and test cases and inspected each step through tool output. | Kept salary and audit writes atomic. Added version checks so one simultaneous edit cannot silently overwrite another. Used currency-specific metrics and integer money storage. |
| Review | The assistant ran TypeScript, unit and PostgreSQL checks, then exercised the real UI with Chromium. | The compiler caught a nullable session cookie in the test harness and an overly specific error property. Updated the test narrowing and the server log. The first local PostgreSQL launch failed on a Unix socket restriction. The verification harness used a loopback-only TCP listener. Browser checks also exposed a mobile overflow from a screen-reader-only table label and an ambiguous filter label. The table scroll container and labels were corrected, then verified in Chromium. |

This repository’s documentation and code were drafted with AI assistance. The acceptance criteria and database choice trace back to the conversation above. The demo shows runtime behaviour against the synthetic dataset.
