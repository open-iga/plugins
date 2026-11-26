import type { BunPlugin } from 'bun';

const BROWSER_XML_PARSER = /xml-builder[\\/]dist-es[\\/]xml-parser\.browser\.js$/;

// The wasm runtime has no DOMParser, so use the AWS SDK's own pure JS XML parser.
const xmlParserPlugin: BunPlugin = {
    name: 'xml-parser',
    setup(build) {
        build.onLoad({ filter: BROWSER_XML_PARSER }, () => ({
            loader: 'js',
            contents: "export { parseXML } from './xml-parser.js';",
        }));
    },
};

export default xmlParserPlugin;
