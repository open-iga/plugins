/**
 * Pick a connector's declared config out of the per-invocation values the Host sent in the
 * dispatch envelope. Config is delivered per call (not ambient) so an operation only ever sees
 * the keys the Host scoped to it — e.g. an entitlement never receives the account-action role ARN.
 */
export const buildConfig = (
    configSpec: { name: string; required: boolean }[],
    provided: Record<string, string>,
): Record<string, string | null> => {
    // Null-prototype + own-property check: `provided` comes from the Host as JSON, so inherited
    // names like `toString`/`__proto__` would otherwise resolve to Object.prototype members and
    // let a function pass the required check and reach the handler as a non-string.
    const config: Record<string, string | null> = Object.create(null);
    for (const { name, required } of configSpec) {
        const value = Object.hasOwn(provided, name) ? provided[name] : null;

        if (required && !value) {
            throw new Error(`Config "${name}" is required but missing from the Host config`);
        }

        config[name] = value;
    }
    return config;
};
