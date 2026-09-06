# OpenIGA Plugins

OpenIGA aims to provide a developer-first IGA that helps support connector development for any
internal tool. Connectors run securely inside a WASM sandbox.

To improve DX and abstract the underlying WASM details, connectors are written in plain TypeScript
against the connector SDK, which compiles them to WASM modules using [Extism](https://extism.org).

## Layout

This is a [Bun workspaces](https://bun.sh/docs/install/workspaces) monorepo.

| Path                     | Package                   | Role                                                                             |
| ------------------------ | ------------------------- | -------------------------------------------------------------------------------- |
| `packages/connector-sdk` | `@open-iga/connector-sdk` | Build toolchain + runtime that connector authors depend on; compiles TS to WASM. |
| `connectors/aws`         | `aws`                     | AWS connector built on the SDK — account actions (IAM users) and entitlements.   |

## Getting started

```sh
bun install        # install workspace dependencies
bun run test       # build + test every workspace (via turbo)
```

Per connector (e.g. `connectors/aws`):

```sh
bun run compile    # compile the connector to a .wasm module (open-iga compile)
bun run test       # compile, then run the test suite
bun run typecheck  # type-check app and test sources
```

## Writing a connector

A connector is plain TypeScript that defines its capabilities against `@open-iga/connector-sdk` and
is compiled to WASM by the same toolchain. It declares:

- **Account actions** — lifecycle operations on a managed resource (`create`, `read`, `update`,
  `enable`, `disable`, `delete`).
- **Entitlements** — `discover`, `grant`, and `revoke` for assignable permissions (e.g. IAM roles).

See `connectors/aws` for a complete reference implementation.
