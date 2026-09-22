/**
 * @name Slot
 * @version 1.0.0
 * @author Mahdi
 * @license MIT
 * @see https://github.com/mahdidevroom/slot.js
*/

/* --------------------------------------------
    Export
-------------------------------------------- */
export default class {
    //--- Constructor -------------------------
    constructor(config = {}) {
        this.version = '1.0.0';
        this.#init(config);
    }

    //--- Private Values -----------------------
    #LOGS = [];
    #DEFAULT_CONFIG = {
        slot: '${TAG}',
        dynamic: '$(TAG)',
        block: '-$-BLOCK-$-',
        error: '[!ERROR!]',
        root: null,
        separator: ':',
        maxDeep: 20,
        logLevel: 1,
    }
    #CONFIG = { ...this.#DEFAULT_CONFIG }
    #ENCODINGS = [
        'utf8',
        'utf-8',
        'base64',
        'base64url',
        'hex',
        'ascii',
        'binary'
    ];
    #MIME = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon',
        'txt': 'text/plain',
        'html': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript',
        'json': 'application/json',
        'xml': 'application/xml',
        'md': 'text/markdown',
        'woff': 'font/woff',
        'woff2': 'font/woff2',
        'ttf': 'font/ttf',
        'otf': 'font/otf',
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'zip': 'application/zip',
        'pdf': 'application/pdf',
    }
    get #REGEXP() {
        const es = (str) => str.replace(/[\\^$.|?*+()\[\]{}]/g, '\\$&');

        const slot = this.#CONFIG.slot.split('TAG').map(es).join('(?<content>.*?)');
        const dynamic = this.#CONFIG.dynamic.split('TAG').map(es).join('(?<content>.*?)');
        const block = this.#CONFIG.block.split('BLOCK').map(es).join('(?<content>.*?)');
        const error = es(this.#CONFIG.error);

        return {
            slot: new RegExp(slot, 'g'),
            dynamic: new RegExp(dynamic, 'g'),
            block: new RegExp(block, 'gs'),
            error: new RegExp(error, 'g'),
            typeAndArg: new RegExp('^(\\w+)\\([\'\"](.*?)[\'\"]\\)'),
            chainMethod: new RegExp('\\.(\\w+)\\([\'\"]?(.*?)[\'\"]?\\)', 'g'),
        }
    }
    #VALIDATION = {
        isServer: () => typeof process !== 'undefined' && process.versions != null && process.versions.node != null,
        isClient: () => typeof window !== 'undefined' && typeof document !== 'undefined',
        encoding: (input) => this.#ENCODINGS.includes(input),
        isBinaryExtension: (ext) => {
            const binaryTypes = [
                'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svg',
                'mp4', 'webm', 'mp3', 'wav',
                'pdf', 'zip', 'rar', '7z',
                'woff', 'woff2', 'ttf', 'otf',
                'exe', 'dll', 'bin'
            ];
            return binaryTypes.includes(ext);
        },
        isConfigKey: (key) => Object.keys(this.#DEFAULT_CONFIG).includes(key),
        isConfigValue: (key, value) => {
            if (key === 'root') return value === null || typeof value === 'string';
            if (key === 'separator') return typeof value === 'string' && value.length > 0;
            if (key === 'maxDeep') return typeof value === 'number' && value > 0;
            if (key === 'logLevel') return value === 0 || value === 1 || value === 2 || value === 3;
            if (key === 'slot' || key === 'dynamic' || key === 'block' || key === 'error') {
                return typeof value === 'string' && value.length > 0;
            }
            return false;
        },
    }
    #MESSAGES = {
        E01: (val) => `Slot Error [SlotBlock]: invalid expression "${val}" - must start with "file()" or "text()"`,
        E02: (val) => `Slot Error [SlotBlock]: invalid function "${val}" - only "file" and "text" are allowed`,
        E03: (val) => `Slot Error [SlotBlock]: invalid method "${val}" - only "encode" and "decode" are allowed`,
        E04: (val) => `Slot Error [SlotBlock]: variable "${val}" not found in block declarations`,
        E05: (val) => `Slot Error [SlotBlock]: invalid encoding "${val}" - valid encodings: utf8, base64, base64url, hex, ascii, binary`,
        E06: (val) => `Slot Error [Fetch]: file not found or unable to read "${val}"`,
        E07: (val) => `Slot Error [Fetch]: unexpected error "${val}"`,
        E08: (val) => `Slot Error [SlotDeep]: maximum depth exceeded (${val}) - possible circular reference`,
        E09: (val) => `Slot Error [LogLevel]: invalid log level "${val}" - must be 0, 1, 2, or 3`,
        E10: (val) => `Slot Error [Save]: failed to save file "${val}"`,
        E11: (val) => `Slot Error [Save]: invalid input for save - expected string, buffer or blob`,
        E12: (val) => `Slot Error [Config]: unknown config key "${val}"`,
        E13: (val) => `Slot Error [Config]: invalid value for "${val}"`,
        E14: (val) => `Slot Error [Config]: duplicate syntax detected - "${val}" syntaxes must be unique`,
    }

    //--- Private Methods ----------------------
    #log(code, input) {
        let message = this.#MESSAGES[code]?.(input) || `Unknown error: ${input}`;

        if (this.#CONFIG.error) {
            message = `${this.#CONFIG.error} ${message} ${this.#CONFIG.error}`;
        }

        if (this.#CONFIG.logLevel === 1) this.#LOGS.push(message);
        if (this.#CONFIG.logLevel === 2) throw new Error(message);
        if (this.#CONFIG.logLevel === 3) {
            console.error(message);
            if (this.#VALIDATION.isServer()) {
                process.exit(1);
            }
        }
    }
    #init(config) {
        if (config.logLevel !== undefined) {
            if (this.#VALIDATION.isConfigValue('logLevel', config.logLevel)) {
                this.#CONFIG.logLevel = config.logLevel;
            } else {
                this.#log('E09', config.logLevel);
            }
            delete config.logLevel;
        }

        for (const [key, value] of Object.entries(config)) {
            if (!this.#VALIDATION.isConfigKey(key)) {
                this.#log('E12', key);
                continue;
            }
            if (!this.#VALIDATION.isConfigValue(key, value)) {
                this.#log('E13', key);
                continue;
            }
            this.#CONFIG[key] = value;
        }

        const syntaxes = [
            { name: 'slot', value: this.#CONFIG.slot },
            { name: 'dynamic', value: this.#CONFIG.dynamic },
            { name: 'block', value: this.#CONFIG.block },
        ];

        for (let i = 0; i < syntaxes.length; i++) {
            for (let j = i + 1; j < syntaxes.length; j++) {
                if (syntaxes[i].value === syntaxes[j].value) {
                    this.#log('E14', syntaxes[i].name);
                }
            }
        }
    }
    #error(code, input) {
        return `${this.#CONFIG.error} ${this.#MESSAGES[code]?.(input) || input} ${this.#CONFIG.error}`;
    }
    async #fetch(path, asBinary = false) {
        try {
            if (this.#VALIDATION.isClient()) {
                const res = await fetch(path);
                if (!res.ok) {
                    this.#log('E06', path);
                    return null;
                }
                if (asBinary) {
                    const blob = await res.blob();
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = () => reject(reader.error);
                        reader.readAsDataURL(blob);
                    });
                }
                return res.text();
            }

            if (this.#VALIDATION.isServer()) {
                const fs = await import('fs');
                const { join } = await import('path');
                const fullPath = this.#CONFIG.root ? join(this.#CONFIG.root, path) : path;

                try {
                    const buffer = await fs.promises.readFile(fullPath);
                    if (asBinary) {
                        const ext = path.split('.').pop().toLowerCase();
                        const mime = this.#MIME[ext] || 'application/octet-stream';
                        return `data:${mime};base64,${buffer.toString('base64')}`;
                    }
                    return buffer.toString('utf8');
                } catch (err) {
                    this.#log('E06', fullPath);
                    return null;
                }
            }
        } catch (err) {
            this.#log('E07', err.message);
            return null;
        }
    }
    #getIndent(text, position) {
        const before = text.substring(0, position);
        const lines = before.split('\n');
        const lastLine = lines[lines.length - 1];
        const indent = lastLine.match(/^\s*/)[0];
        return indent;
    }
    #applyIndent(content, indent) {
        const lines = content.split('\n');
        return lines.map((line, index) => {
            if (index === 0) return line;
            return indent + line;
        }).join('\n');
    }
    #parseExpression(expr) {
        const result = {
            type: null,
            arg: null,
            encode: null,
            decode: null
        };

        const typeMatch = expr.match(this.#REGEXP.typeAndArg);
        if (!typeMatch) {
            this.#log('E01', expr);
            return result;
        }

        const type = typeMatch[1];
        const arg = typeMatch[2];

        if (type !== 'file' && type !== 'text') {
            this.#log('E02', type);
            return result;
        }

        result.type = type;
        result.arg = arg;

        const matches = expr.matchAll(this.#REGEXP.chainMethod);

        for (const match of matches) {
            const method = match[1];
            const methodArg = match[2] || null;

            if (method === 'encode') result.encode = methodArg || null;
            else if (method === 'decode') result.decode = methodArg || null;
            else {
                this.#log('E03', method);
                return result;
            }
        }

        return result;
    }
    #parseSlotBlock(content) {
        const result = {};
        const [key, ...parts] = content.split(this.#CONFIG.separator).map(s => s.trim());
        const expression = parts.join(this.#CONFIG.separator);
        const parsed = this.#parseExpression(expression);

        result[key] = {
            type: parsed.type,
            arg: parsed.arg || null,
            encode: parsed.encode || null,
            decode: parsed.decode || null,
            raw: expression,
        };

        return result;
    }
    #processBlocks(text) {
        let result = text;
        const matches = [...text.matchAll(this.#REGEXP.block)];
        const variables = {};

        for (const match of matches) {
            const fullMatch = match[0];
            const content = match.groups.content;
            const parsed = this.#parseSlotBlock(content);

            Object.assign(variables, parsed);
            result = result.split('\n').filter(line => !line.includes(fullMatch)).join('\n');
        }

        return { result, variables };
    }
    async #processDynamic(text) {
        const matches = text.matchAll(this.#REGEXP.dynamic);
        let result = text;

        for (const match of matches) {
            const fullMatch = match[0];
            const index = match.index;
            const content = match.groups.content;

            const ext = content.split('.').pop().toLowerCase();
            const asBinary = this.#VALIDATION.isBinaryExtension(ext);

            const value = await this.#fetch(content, asBinary);

            if (value === null) {
                result = result.replace(fullMatch, this.#error('E06', content));
                continue;
            }

            const indent = this.#getIndent(result, index);
            const indentedValue = this.#applyIndent(value, indent);

            result = result.replace(fullMatch, indentedValue);
        }

        return result;
    }
    async #processSlots(text, variables) {
        const matches = text.matchAll(this.#REGEXP.slot);
        let result = text;

        for (const match of matches) {
            const fullMatch = match[0];
            const index = match.index;
            const content = match.groups.content;
            const variable = variables[content];

            if (!variable) {
                result = result.replace(fullMatch, this.#error('E04', content));
                continue;
            }

            let value;
            if (variable.type === 'file') {
                const ext = variable.arg.split('.').pop().toLowerCase();
                const isBinaryExt = this.#VALIDATION.isBinaryExtension(ext);

                const isBinary = isBinaryExt ||
                    variable.encode === 'base64' ||
                    variable.encode === 'base64url' ||
                    variable.decode === 'base64' ||
                    variable.decode === 'base64url';

                value = await this.#fetch(variable.arg, isBinary);

                if (value === null) {
                    result = result.replace(fullMatch, this.#error('E06', variable.arg));
                    continue;
                }

                if (isBinary && typeof value === 'string' && value.startsWith('data:')) {
                    value = value.split(',')[1];

                    if (!variable.encode && !variable.decode) {
                        variable.encode = 'base64';
                    }
                }
            } else if (variable.type === 'text') {
                value = variable.arg;
            } else {
                continue;
            }

            if (variable.decode) {
                if (!this.#VALIDATION.encoding(variable.decode)) {
                    result = result.replace(fullMatch, this.#error('E05', variable.decode));
                    continue;
                }
                value = this.#decode(value, variable.decode);
            }

            if (variable.encode) {
                if (!this.#VALIDATION.encoding(variable.encode)) {
                    result = result.replace(fullMatch, this.#error('E05', variable.encode));
                    continue;
                }
                value = this.#encode(value, variable.encode);
            }

            const indent = this.#getIndent(result, index);
            const indentedValue = this.#applyIndent(value, indent);

            result = result.replace(fullMatch, indentedValue);
        }

        return result;
    }
    #encode(content, encoding) {
        const enc = encoding || 'utf8';

        if (this.#VALIDATION.isServer()) {
            return Buffer.from(content, 'utf8').toString(enc);
        }

        switch (enc) {
            case 'base64': {
                const bytes = new TextEncoder().encode(content);
                const binaryString = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
                return btoa(binaryString);
            }
            case 'base64url': {
                const bytes = new TextEncoder().encode(content);
                const binaryString = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
                return btoa(binaryString)
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=/g, '');
            }
            case 'hex':
                return Array.from(new TextEncoder().encode(content))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
            case 'ascii':
                return Array.from(new TextEncoder().encode(content))
                    .map(b => String.fromCharCode(b & 0x7F))
                    .join('');
            case 'binary':
                return Array.from(new TextEncoder().encode(content))
                    .map(b => b.toString(2).padStart(8, '0'))
                    .join('');
            case 'utf8':
            case 'utf-8':
            default:
                return content;
        }
    }
    #decode(content, encoding) {
        const enc = encoding || 'utf8';

        if (this.#VALIDATION.isServer()) {
            return Buffer.from(content, enc).toString('utf8');
        }

        switch (enc) {
            case 'base64': {
                const binaryString = atob(content);
                const bytes = Uint8Array.from(binaryString, m => m.codePointAt(0));
                return new TextDecoder().decode(bytes);
            }
            case 'base64url': {
                let base64 = content.replace(/-/g, '+').replace(/_/g, '/');
                while (base64.length % 4) {
                    base64 += '=';
                }
                const binaryString = atob(base64);
                const bytes = Uint8Array.from(binaryString, m => m.codePointAt(0));
                return new TextDecoder().decode(bytes);
            }
            case 'hex': {
                const bytes = content.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) || [];
                return new TextDecoder().decode(new Uint8Array(bytes));
            }
            case 'ascii': {
                const bytes = Array.from(content).map(c => c.charCodeAt(0) & 0x7F);
                return new TextDecoder().decode(new Uint8Array(bytes));
            }
            case 'binary': {
                const bytes = content.match(/.{1,8}/g)?.map(b => parseInt(b, 2)) || [];
                return new TextDecoder().decode(new Uint8Array(bytes));
            }
            case 'utf8':
            case 'utf-8':
            default:
                return content;
        }
    }
    async #render(text, depth = 0) {
        if (depth > this.#CONFIG.maxDeep) {
            this.#log('E08', this.#CONFIG.maxDeep);
            return text;
        }

        let result = await this.#processDynamic(text);

        const blocks = this.#processBlocks(result);
        result = blocks.result;

        result = await this.#processSlots(result, blocks.variables);

        const cleanResult = result.replace(this.#REGEXP.error, '');
        const hasDynamic = this.#REGEXP.dynamic.test(cleanResult);
        const hasSlot = this.#REGEXP.slot.test(cleanResult);

        if (hasDynamic || hasSlot) {
            return this.#render(result, depth + 1);
        }

        return result;
    }

    //--- Logs Methods ------------------------
    set logLevel(level) {
        if (level === 0 || level === 1 || level === 2 || level === 3) {
            this.#CONFIG.logLevel = level;
        } else {
            this.#log('E09', level);
        }
    }
    get logLevel() {
        return this.#CONFIG.logLevel;
    }
    get logs() {
        return [...this.#LOGS];
    }
    clearLogs() {
        this.#LOGS.length = 0;
    }

    //--- Methods -----------------------------
    async fill(path) {
        const text = await this.#fetch(path);
        if (text === null) {
            this.#log('E06', path);
            return this.#error('E06', path);
        }
        return this.#render(text);
    }
    async save(path, filename = 'output.txt') {
        const content = await this.fill(path);
        if (!content) {
            return { success: false, error: this.#error('E06', path) };
        }

        const ext = filename.split('.').pop().toLowerCase();
        const mimeType = this.#MIME[ext] || 'application/octet-stream';

        try {
            if (this.#VALIDATION.isClient()) {
                const blob = new Blob([content], { type: mimeType });
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                URL.revokeObjectURL(url);

                return {
                    success: true,
                    filename,
                    mimeType,
                    environment: 'client'
                };
            }

            if (this.#VALIDATION.isServer()) {
                const fs = await import('fs');
                const { join } = await import('path');

                const fullPath = this.#CONFIG.root
                    ? join(this.#CONFIG.root, filename)
                    : filename;

                await fs.promises.writeFile(fullPath, content, 'utf8');

                return {
                    success: true,
                    path: fullPath,
                    mimeType,
                    environment: 'server'
                };
            }
        } catch (err) {
            this.#log('E10', filename);
            return {
                success: false,
                error: err.message,
                filename
            };
        }
    }
    async inject(path, options = {}) {
        if (!this.#VALIDATION.isClient()) {
            return {
                success: false,
                error: 'Inject method is only available in browser environment.',
                environment: 'server'
            };
        }

        const content = await this.fill(path);
        if (!content) {
            return { success: false, error: this.#error('E06', path) };
        }

        const { type, id = `slot-inject-${Date.now()}` } = options;

        try {
            const existingElement = document.getElementById(id);
            if (existingElement) {
                if (existingElement.href && existingElement.href.startsWith('blob:')) {
                    URL.revokeObjectURL(existingElement.href);
                }
                existingElement.remove();
            }

            const mimeType = type === 'css' ? 'text/css' : 'application/javascript';
            const blob = new Blob([content], { type: mimeType });
            const objectUrl = URL.createObjectURL(blob);

            const element = type === 'css'
                ? document.createElement('link')
                : document.createElement('script');

            element.id = id;

            if (type === 'css') {
                element.rel = 'stylesheet';
                element.href = objectUrl;
            } else {
                element.src = objectUrl;
                element.type = 'application/javascript';
            }

            document.head.appendChild(element);

            return new Promise((resolve, reject) => {
                element.onload = () => {
                    resolve({ success: true, id, type, environment: 'client' });
                };
                element.onerror = (err) => {
                    URL.revokeObjectURL(objectUrl);
                    reject({ success: false, error: `Failed to load injected ${type}`, details: err });
                };
            });

        } catch (err) {
            return { success: false, error: err.message, environment: 'client' };
        }
    }
}
