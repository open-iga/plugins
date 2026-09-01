import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false });

/**
 * AWS Query protocol response parsing, via a pure-JS XML parser (QuickJS has no
 * DOMParser). Values are kept as strings (parseTagValue: false) so ids/tokens/dates
 * aren't coerced to numbers; attributes are ignored — AWS Query responses carry
 * data in element text.
 * */
export const parseXml = (xml: string): unknown => parser.parse(xml);

/**
 * First value found for `key` anywhere in the parsed tree (depth-first). AWS Query
 * fields are uniquely named (AccessKeyId, UserId, Message, …), so a name lookup is
 * unambiguous and avoids hard-coding response paths.
 * */
export const findValue = (node: unknown, key: string): string => {
    if (node === null || typeof node !== 'object') {
        return '';
    }

    const obj = node as Record<string, unknown>;
    if (key in obj && typeof obj[key] !== 'object') {
        return String(obj[key]);
    }

    for (const value of Object.values(obj)) {
        const found = findValue(value, key);
        if (found) {
            return found;
        }
    }
    return '';
}
