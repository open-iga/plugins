import { installRequest } from './request.ts';
import { installWebCryptoHmac } from './webcrypto.ts';

export const installRuntimePolyfills = (): void => {
    installRequest();
    installWebCryptoHmac();
};
