import Slot from '../src/slot.js';

const S = new Slot({
    root: import.meta.dirname,
});

const fill = await S.fill('index.html');
const log = await S.save(fill, 'output.html');
