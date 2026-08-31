import Slot from '../src/slot.js';

const S = new Slot();

const log = await S.fill('test/playground.txt');
console.log(log);