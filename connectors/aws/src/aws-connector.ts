import { OpenIgaConnector } from '@open-iga/connector-sdk';
import { registerAccountActionCreation } from './account-actions/create.ts';
import { registerAccountActionDisable } from './account-actions/disable.ts';
import { registerAccountActionEnable } from './account-actions/enable.ts';
import { registerAccountActionDelete } from './account-actions/delete.ts';
import { registerAccountActionRead } from './account-actions/read.ts';

export const awsConnector = new OpenIgaConnector({
    name: 'aws',
    description: 'AWS plugin for OpenIGA core',
    config: [
        { name: 'AWS_REGION', description: 'AWS region', required: true },
        {
            name: 'AWS_ACCESS_KEY_ID',
            description: 'Base access key id used by the host. Handler level roles are assumed with this access key.',
            required: true,
        },
        {
            name: 'AWS_SECRET_ACCESS_KEY',
            description:
                'Base secret access key used to call STS. Handler level roles are assumed with this access key.',
            required: true,
        },
    ],
    allowedDomains: ['*.amazonaws.com'],
});

registerAccountActionCreation(awsConnector);
registerAccountActionDisable(awsConnector);
registerAccountActionEnable(awsConnector);
registerAccountActionDelete(awsConnector);
registerAccountActionRead(awsConnector);

export default awsConnector;
