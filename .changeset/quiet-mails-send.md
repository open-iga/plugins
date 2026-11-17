---
'@open-iga/connector-sdk': minor
'@open-iga/aws': minor
---

sendEmail now takes a structured credentials payload (system, loginUrl, username, password, passwordChangeRequired) instead of free-form subject/body. The Host renders the wording from a fixed template and validates the same schema, so connectors can't use it for phishing.
