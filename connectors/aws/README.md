# AWS

AWS connector for open-iga. Uses `@open-iga/connector-sdk` to define capabilities; compiled to WASM by the same.

Manages **IAM users** (account lifecycle) and **IAM user-group membership** (entitlements).

## How it works

Base credentials call STS to **assume a least-privilege role per handler** (grant/discover/user-management), then hit the IAM Query API (SigV4-signed, `us-east-1` — IAM is global).
Never returns secrets: a created user's temp password is delivered via the host email capability (only for now. phishing attack vector is high and email capability might be removed soon), not the action output.

## Config (connector-level)

| Key                     | Required | Purpose                                 |
| ----------------------- | -------- | --------------------------------------- |
| `AWS_REGION`            | yes      | Region for the STS endpoint             |
| `AWS_ACCESS_KEY_ID`     | yes      | Base key; assumes handler roles via STS |
| `AWS_SECRET_ACCESS_KEY` | yes      | Base secret                             |

Allowed upstream: `*.amazonaws.com`.

## Account actions — resource `iam-user`

| Action    | Does                                                                                             | Extra config                                             |
| --------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `create`  | Create IAM user + console login profile (temp password, reset-on-first-login), email credentials | `AWS_USER_MANAGEMENT_ROLE`, `AWS_PASSWORD_PATTERN` (opt) |
| `read`    | Report `exists` + `enabled` (has login profile) — drift detection                                | `AWS_USER_MANAGEMENT_ROLE`                               |
| `enable`  | Restore console access (new temp password, emailed)                                              | `AWS_USER_MANAGEMENT_ROLE`                               |
| `disable` | Remove login profile (revoke console access; idempotent)                                         | `AWS_USER_MANAGEMENT_ROLE`                               |
| `delete`  | Delete the user (login profile removed first)                                                    | `AWS_USER_MANAGEMENT_ROLE`                               |

Account `id` = the user ARN.

## Entitlements — resource `iam-user-group`

> [!NOTE]
> Entitlement = membership in a pre-existing IAM group (groups are provisioned out-of-band; a group's own policy decides what it grants, e.g. cross-account role assumption)
> Group creation util in this connector is purely for testing and is not exposed outside

| Action     | Description                                                         | Extra config                                                   |
| ---------- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| `discover` | List assignable groups (`ListGroups`), minus operator-excluded ones | `AWS_GROUP_DISCOVERY_ROLE`, `AWS_GROUP_EXCLUDE_PATTERNS` (opt) |
| `grant`    | Add user to group (`AddUserToGroup`)                                | `AWS_ENTITLEMENT_MANAGEMENT_ROLE`                              |
| `revoke`   | Remove user from group (`RemoveUserFromGroup`; idempotent)          | `AWS_ENTITLEMENT_MANAGEMENT_ROLE`                              |
| `read`     | List the user's groups (`ListGroupsForUser`) — drift detection      | `AWS_ENTITLEMENT_MANAGEMENT_ROLE`                              |

> [!Warning]
> `AWS_GROUP_EXCLUDE_PATTERNS`: `;`-separated regex; a group is excluded if any pattern matches its name or path (e.g. `^ci-;/infra/`).
> There will runtime errors if the patters is not regex

Note: AWS hard-caps a user at **10 groups** — grants past that fail with `LimitExceeded`.

## Develop

```sh
bun run compile     # build .wasm (open-iga compile)
bun run test        # compile, then run tests (needs Docker for MiniStack)
bun run typecheck
```
