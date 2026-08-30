import { describe, it, expect } from 'bun:test';
import { validateConfigPlaceHolder, validateAndGenerateConnectorManifest } from './manifest.ts';
import { OpenIgaConnector } from '../../iga/connector/builder.ts';
import type { ConnectorConfig } from '../../iga/connector/validation-schema/connector.config.schema.ts';
import type { PluginAccountAction } from '../../iga/connector/validation-schema/connector.account-action.schema.ts';

const config = (entries: { name: string; required: boolean }[]): ConnectorConfig =>
    entries.map(({ name, required }) => ({ name, description: name, required }));

const endpoints = (urls: string[]): PluginAccountAction['endpoints'] =>
    urls.map((url) => ({ method: 'GET', url, description: 'endpoint' }));

describe('validateConfigPlaceHolder', () => {
    it('should throw error if the config in placeholder is missing the config', () => {
        expect(() =>
            validateConfigPlaceHolder({
                endpoints: endpoints(['https://site.{{ REGION }}.domain.com']),
                config: config([]),
            }),
        ).toThrow(/REGION.*is missing in the config/);
    });

    it('should throw error if the config in placeholder is defined but not required', () => {
        expect(() =>
            validateConfigPlaceHolder({
                endpoints: endpoints(['https://site.{{ REGION }}.domain.com']),
                config: config([{ name: 'REGION', required: false }]),
            }),
        ).toThrow(/must be marked as required/);
    });

    it('should not throw an error if the config in placeholder is available in the config', () => {
        expect(() =>
            validateConfigPlaceHolder({
                endpoints: endpoints(['https://site.{{ REGION }}.domain.com']),
                config: config([{ name: 'REGION', required: true }]),
            }),
        ).not.toThrow();
    });

    it('should not throw an error when the url has no placeholders', () => {
        expect(() =>
            validateConfigPlaceHolder({
                endpoints: endpoints(['https://site.domain.com']),
                config: config([]),
            }),
        ).not.toThrow();
    });
});

describe('validateAndGenerateConnectorManifest', () => {
    it('should throw error when the default export is not a connector instance', () => {
        expect(() => validateAndGenerateConnectorManifest({})).toThrow(/should be an instance of OpenIgaConnector/);
    });

    it('should throw error when connector settings is invalid', () => {
        const connector = new OpenIgaConnector({
            // Invalid: name must be a non-empty string
            name: '',
            description: 'desc',
            config: [],
            allowedDomains: ['domain.com'],
        });

        expect(() => validateAndGenerateConnectorManifest(connector)).toThrow(/Validation Failed for Plugin setting/);
    });

    it('should throw error when connector action details are invalid', () => {
        const connector = new OpenIgaConnector({
            name: 'connector',
            description: 'desc',
            config: [{ name: 'REGION', description: 'region', required: true }],
            allowedDomains: ['domain.com'],
        }).registerAccountActions('iam-user', {
            type: 'create',
            description: 'create user',
            // Invalid: url must start with http:// or https://
            endpoints: [{ method: 'POST', url: 'ftp://domain.com', description: 'endpoint' }],
            handler: () => ({}) as never,
        });

        expect(() => validateAndGenerateConnectorManifest(connector)).toThrow(
            /Validation failed for action type create in the managed resource iam-user/,
        );
    });

    it('should generate a manifest for a valid connector', () => {
        const connector = new OpenIgaConnector({
            name: 'connector',
            description: 'desc',
            config: [{ name: 'REGION', description: 'region', required: true }],
            allowedDomains: ['domain.com'],
        }).registerAccountActions('iam-user', {
            type: 'create',
            description: 'create user',
            endpoints: [{ method: 'POST', url: 'https://site.{{ REGION }}.domain.com', description: 'endpoint' }],
            handler: () => ({}) as never,
        });

        const manifest = validateAndGenerateConnectorManifest(connector);

        expect(manifest.name).toBe('connector');
        expect(manifest.description).toBe('desc');
        expect(manifest.allowedDomains).toEqual(['domain.com']);
        expect(manifest.actions).toHaveLength(1);
        expect(manifest.actions[0]).toMatchObject({
            id: 'iam-user.account-action.create',
            description: 'create user',
        });
    });
});
