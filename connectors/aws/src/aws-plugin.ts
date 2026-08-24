import { OpenIgaPlugin } from '@open-iga/connector-sdk';
import { registerAccountActionCreation } from './account-actions/create.ts';

export const awsPlugin = new OpenIgaPlugin({
    name: 'aws',
    description: 'AWS plugin for OpenIGA core',
    config: [
        { name: 'AWS_REGION', description: 'AWS region', required: true },
        {
            name: 'AWS_ACCESS_KEY_ID',
            description: 'Base access key id used by the host. Handler level roles are assumed with this access key. ',
            required: true,
        },
        { name: 'AWS_SECRET_ACCESS_KEY', description: 'Base secret access key used to call STS', required: true },
        { name: 'AWS_ENDPOINT_URL', description: 'Override AWS endpoint (e.g. a local emulator)', required: false },
    ],
});

registerAccountActionCreation(awsPlugin);

export default awsPlugin;
