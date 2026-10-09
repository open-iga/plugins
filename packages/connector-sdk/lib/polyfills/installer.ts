import { installFetch } from './fetch.ts';
import { installHeaders } from './headers.ts';
import { installRequest } from './request.ts';
import { installWebCrypto } from './webcrypto.ts';

export const installRuntimePolyfills = (): void => {
    // Headers must come first: the Request polyfill constructs `new Headers(...)`.
    installHeaders();
    installRequest();
    installFetch();
    installWebCrypto();
};
