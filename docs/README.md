# Docs

Index of the repository's documentation. Each entry says when to read it. Where each kind of doc belongs is in [processes/documentation.md](processes/documentation.md). Use when you are looking for how to do something, why something is the way it is, or how work is done here.

## Guides

How to set up or do something; read while doing it.

| Guide                                                                     | Use when …                                                                                                                       |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [how-to-setup-web-app.md](guides/how-to-setup-web-app.md)                 | you run the app locally for the first time, deploy it, or work on queues and cron                                                |
| [how-to-setup-auth.md](guides/how-to-setup-auth.md)                       | you set secrets, change sign-in methods, add Google, or regenerate the auth tables                                               |
| [how-to-setup-d1.md](guides/how-to-setup-d1.md)                           | you create the databases, change the schema, or apply migrations                                                                 |
| [how-to-setup-r2.md](guides/how-to-setup-r2.md)                           | you set up file storage, presigned URLs or bucket CORS                                                                           |
| [how-to-setup-email.md](guides/how-to-setup-email.md)                     | you set up sending, onboard a sender domain, or enable email verification                                                        |
| [how-to-setup-mcp.md](guides/how-to-setup-mcp.md)                         | you add an MCP tool or connect Claude to an environment                                                                          |
| [how-to-setup-logging.md](guides/how-to-setup-logging.md)                 | you change `LOG_SINK`, add log lines, look up a request's logs by its id, or connect Datadog or OpenTelemetry                    |
| [how-to-setup-error-reporting.md](guides/how-to-setup-error-reporting.md) | you change `ERROR_REPORTER`, handle an unexpected error in server code, find a report from a user's reference, or connect Sentry |
| [how-to-setup-ci.md](guides/how-to-setup-ci.md) | you change CI, set up the deploy workflow and its secrets, or run self-hosted runners in Docker |
| [how-to-setup-container.md](guides/how-to-setup-container.md)             | you run or deploy the Container demo                                                                                             |
| [how-to-define-branding.md](guides/how-to-define-branding.md)             | you give a project its own name, logo, accent, fonts or radius                                                                   |
| [how-to-use-storybook.md](guides/how-to-use-storybook.md)                 | you build or review components in Storybook, write their tests, or change who can open `/_storybook/`                            |

## Architecture

Contracts and principles that hold regardless of the current code.

| Doc                                                        | Use when …                                                                                                                                                                  |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [architecture/overview.md](architecture/overview.md)       | you plan or review a change, need to know where code belongs, or extend the system (feature, table, procedure, route, binding, queue message, cron job, component, env var) |
| [architecture/testing.md](architecture/testing.md)         | you decide which tests a change needs, write them, or review whether they are enough                                                                                        |
| [architecture/performance.md](architecture/performance.md) | you set performance targets, add a performance check, review a change to queries, bundles or request paths, or handle a regression                                          |

## Processes

How work is planned, reviewed, documented and decided, and how dependencies are kept current.

| Doc                                                      | Use when …                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [processes/development.md](processes/development.md)     | you start any change, write a plan for an agent, or check whether a change is done         |
| [processes/code-review.md](processes/code-review.md)     | you review a diff, respond to findings, or decide whether to use an independent reviewer   |
| [processes/documentation.md](processes/documentation.md) | you write, move or delete a doc, or run the docs audit                                     |
| [processes/adrs.md](processes/adrs.md)                   | a change makes or reverses a decision others will build on                                 |
| [processes/dependencies.md](processes/dependencies.md)   | you update dependencies, respond to a security advisory, run `bun audit`, or add a package |

## Decisions

| Doc                                        | Use when …                                                                              |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| [decisions/README.md](decisions/README.md) | you want to know why something is built the way it is, or before proposing to change it |

## Elsewhere

| Doc                                                            | Use when …                                                                                |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [../README.md](../README.md)                                   | you start a new project from the starter or need the list of scripts                      |
| [../AGENTS.md](../AGENTS.md)                                   | you are an agent starting work here                                                       |
| [../packages/ui/CONVENTIONS.md](../packages/ui/CONVENTIONS.md) | you write or review a UI component or its stories                                         |
| [../packages/ui/README.md](../packages/ui/README.md)           | you need the UI package layout and imports                                                |
| [../apps/web/README.md](../apps/web/README.md)                 | you work in the web app                                                                   |
| [../.claude/skills/](../.claude/skills/)                       | you are an agent setting up auth (`setup-auth`), D1 (`setup-d1`) or email (`setup-email`) |
