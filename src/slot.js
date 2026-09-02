/**
 * @name Slot
 * @version 1.0.0
 * @author Mahdi
 * @license MIT
 * @see https://github.com/mahdidevroom/slot.js
*/

/* --------------------------------------------
    Export Slot
-------------------------------------------- */
export default class {
    //--- Constructor -------------------------
    constructor(config) {
        this.version = '1.0.0';
        Object.assign(this.#CONFIG, config);
    }

    //--- Privet Values -----------------------
    #LOGS = [];
    #LOGLEVEL = 1;
    #CONFIG = {
        slot: '${TAG}',
        dynamic: '$(TAG)',
        block: '-$-BLOCK-$-',
        root: null,
        separator: ':',
        maxDeep: 20
    }
    get #REGEXP() {
        const es = (str) => str.replace(/[\\^$.|?*+()\[\]{}]/g, '\\$&');

        const slot = this.#CONFIG.slot.split('TAG').map(es).join('(?<content>.*?)');
        const dynamic = this.#CONFIG.dynamic.split('TAG').map(es).join('(?<content>.*?)');
        const block = this.#CONFIG.block.split('BLOCK').map(es).join('(?<content>.*?)');

        return {
            slot: new RegExp(slot, 'g'),
            dynamic: new RegExp(dynamic, 'g'),
            block: new RegExp(block, 'gs'),
            typeAndArg: new RegExp('^(\\w+)\\([\'\"](.*?)[\'\"]\\)'),
            chainMethod: new RegExp('\\.(\\w+)\\([\'\"]?(.*?)[\'\"]?\\)', 'g'),
        }
    }
    #VALIDTHIN = {
        isServer: () => typeof process !== 'undefined' && process.versions != null && process.versions.node != null,
        isClient: () => typeof window !== 'undefined' && typeof document !== 'undefined',
    }
    #MESSAGES = {
        E01: (val) => `Slot Error [SlotBlock]: invalid expression "${val}" - must start with "file()" or "text()"`,
        E02: (val) => `Slot Error [SlotBlock]: invalid function "${val}" - only "file" and "text" are allowed`,
        E03: (val) => `Slot Error [SlotBlock]: invalid method "${val}" - only "encode" and "decode" are allowed`,
        E04: (val) => `Slot Error [SlotBlock]: variable "${val}" not found in block declarations`,
        E05: (val) => `Slot Error [SlotBlock]: invalid encoding "${val}"`,
        E06: (val) => `Slot Error [Fetch]: file not found or unable to read "${val}"`,
        E07: (val) => `Slot Error [Fetch]: unexpected error "${val}"`,
        E08: (val) => `Slot Error [SlotDeep]: maximum depth exceeded (${val}) - possible circular reference`,
        E09: (val) => `Slot Error [LogLevel]: invalid log level "${val}"`,
        E10: (val) => `Slot Error [Save]: failed to save file "${val}"`,
        E11: (val) => `Slot Error [Save]: invalid input for save - expected string or buffer`,
    }

    //--- Privet Methods ----------------------
    #log(code, input) {
        const message = this.#MESSAGES[code]?.(input) || `Unknown error: ${input}`;

        if (this.#LOGLEVEL === 1) this.#LOGS.push(message);
        if (this.#LOGLEVEL === 2) throw new Error(message);
        if (this.#LOGLEVEL === 3) {
            console.error(message);
            process.exit(1);
        }
    }
    async #fetch(path) {
        try {
            if (this.#VALIDTHIN.isClient()) {
                const res = await fetch(path);
                if (!res.ok) {
                    this.#log('E06', path);
                    return null;
                }
                return res.text();
            }

            if (this.#VALIDTHIN.isServer()) {
                const fs = await import('fs');
                const { join } = await import('path');
                const fullPath = this.#CONFIG.root ? join(this.#CONFIG.root, path) : path;

                try {
                    return await fs.promises.readFile(fullPath, 'utf8');
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
        const matches = text.matchAll(this.#REGEXP.block);
        const variables = {};

        for (const match of matches) {
            const fullMatch = match[0];
            const content = match.groups.content;
            const parsed = this.#parseSlotBlock(content);

            Object.assign(variables, parsed);

            const lines = result.split('\n');
            const filtered = lines.filter(line => !line.includes(fullMatch));
            result = filtered.join('\n');
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

            const value = await this.#fetch(content);

            if (value === null) {
                const errorMsg = this.#MESSAGES.E06(content);
                result = result.replace(fullMatch, errorMsg);
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
                const errorMsg = this.#MESSAGES.E04(content);
                result = result.replace(fullMatch, errorMsg);
                continue;
            }

            let value;
            if (variable.type === 'file') {
                value = await this.#fetch(variable.arg);
                if (value === null) {
                    const errorMsg = this.#MESSAGES.E06(variable.arg);
                    result = result.replace(fullMatch, errorMsg);
                    continue;
                }
            } else if (variable.type === 'text') {
                value = variable.arg;
            } else {
                continue;
            }

            const indent = this.#getIndent(result, index);
            const indentedValue = this.#applyIndent(value, indent);

            result = result.replace(fullMatch, indentedValue);
        }

        return result;
    }

    //--- Logs Methods ------------------------
    set logLevel(level) {
        if (level === 1 || level === 2 || level === 3) {
            this.#LOGLEVEL = level;
        } else {
            this.#log('E09', level);
        }
    }
    get logLevel() {
        return this.#LOGLEVEL;
    }
    get logs() {
        return [...this.#LOGS];
    }
    clearLogs() {
        this.#LOGS.length = 0;
    }

    //--- Methods -----------------------------
    async render(input, depth = 0) {
        if (depth > this.#CONFIG.maxDeep) {
            this.#log('E08', this.#CONFIG.maxDeep);
            return input;
        }

        const text = typeof input === 'string' ? input : await input;

        let result = await this.#processDynamic(text);

        const blocks = this.#processBlocks(result);
        result = blocks.result;

        result = await this.#processSlots(result, blocks.variables);

        const hasDynamic = this.#REGEXP.dynamic.test(result);
        const hasSlot = this.#REGEXP.slot.test(result);

        if (hasDynamic || hasSlot) {
            return this.render(result, depth + 1);
        }

        return result;
    }
    fill(path) {
        return this.render(this.#fetch(path));
    }
    async save(input, filename = 'output.txt') {
        if (typeof input !== 'string' && !(input instanceof Buffer)) {
            this.#log('E11', typeof input);
            return { success: false, error: this.#MESSAGES.E11(typeof input) };
        }

        try {
            const content = typeof input === 'string' ? await this.render(input) : input;

            if (this.#VALIDTHIN.isClient()) {
                const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
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
                    filename: filename,
                    environment: 'client'
                };

            }

            if (this.#VALIDTHIN.isServer()) {
                const fs = await import('fs');
                const { join } = await import('path');

                const fullPath = this.#CONFIG.root
                    ? join(this.#CONFIG.root, filename)
                    : filename;

                await fs.promises.writeFile(fullPath, content, 'utf8');

                return {
                    success: true,
                    path: fullPath,
                    environment: 'server'
                };
            }

        } catch (err) {
            this.#log('E10', filename);
            return {
                success: false,
                error: err.message,
                filename: filename
            };
        }
    }
}