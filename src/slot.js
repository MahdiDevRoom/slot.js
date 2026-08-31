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
const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;
const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';

export default class {
    //--- Constructor -------------------------
    constructor() {
        this.version = '1.0.0';
    }

    //--- Privet Values -----------------------
    #VALIDTHIN = {
        isServer: ()=> typeof process !== 'undefined' && process.versions != null && process.versions.node != null,
        isClient: ()=> typeof window !== 'undefined' && typeof document !== 'undefined',
    }

    //--- Privet Methods ----------------------
    async #CFill(path) {
        const res = await fetch(path);
        return res.text();
    }
    async #SFill(path) {
        const fs = await import('fs');
        const result = fs.promises.readFile(path, { encoding: "utf8" });
        return result;
    }

    //--- Methods -----------------------------
    fill(path) {
        if (this.#VALIDTHIN.isClient()) return this.#CFill(path);
        if (this.#VALIDTHIN.isServer()) return this.#SFill(path);
    }
}