# ACME Salary Manager

## Goal and user

ACME’s HR manager needs one place to manage current base salaries for 10,000 employees across multiple countries and answer questions about how ACME pays people. Today that work is spread across spreadsheets. The first release should let HR find a person, explain a salary change, and see its impact on the compensation report in one session.

## Scope

| HR workflow | First-release capability |
| --- | --- |
| Find employees | Search by name or employee ID, filter by country and department, and browse a paginated directory. |
| Review and update pay | View current annual gross base salary in local currency. Save a new amount with a reason and review dated change history. |
| Understand compensation | Filter by country and department and review headcount, total annual base pay, and median salary. Show each currency separately. |
| Access the workspace | Sign in to an HR workspace. Seed 10,000 clearly synthetic employee records for reviewers. |

## Acceptance criteria

- An authorized HR manager can find an employee, save a valid salary change, and see the previous amount, new amount, reason, actor, and time in the history.
- The amount and its history entry commit together. Bad input and stale edits leave the database unchanged. An HR manager can reload a stale record and review the latest amount before trying again.
- Reports use the latest saved salaries. INR and USD amounts remain in separate groups, even when multiple countries are selected.
- Employee and salary APIs require an HR session. The review deployment contains synthetic data only.
- A reviewer can start the seeded app with Docker Compose, open a deployed demo, and follow the same workflow in a short video.

## Deliberately deferred

Payroll, taxes, bonuses, and equity require separate rules and ownership. FX conversion requires an agreed source and rate date. Spreadsheet imports, approvals, and future-dated changes are follow-up work after HR validates the basic workflow. The first release has one HR persona and one organization.
