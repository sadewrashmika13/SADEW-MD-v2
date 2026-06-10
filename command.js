// command.js
var commands = [];

function cmd(info, func) {
    var data = Object.assign({}, info);
    data.function = func;

    // ✅ FIX: pattern can be RegExp or string — don't call .toLowerCase() on RegExp
    if (typeof info.pattern === 'string') {
        data.pattern = info.pattern.toLowerCase();
    } else if (info.pattern instanceof RegExp) {
        data.pattern = info.pattern; // keep RegExp as-is
    } else {
        data.pattern = info.pattern || '';
    }

    data.alias = info.alias || [];
    data.react = info.react || '';
    data.on = info.on || 'command';
    if (!data.dontAddCommandList) data.dontAddCommandList = false;
    if (!info.desc) info.desc = '';
    if (!data.fromMe) data.fromMe = false;
    if (!info.category) data.category = 'misc';
    if (!info.filename) data.filename = "Not Provided";

    // ✅ DUPLICATE PREVENTION: same pattern already registered naa kiyala check karanna
    const patternStr = data.pattern instanceof RegExp
        ? data.pattern.toString()
        : String(data.pattern || '');

    const isDuplicate = commands.some(existing => {
        const existingStr = existing.pattern instanceof RegExp
            ? existing.pattern.toString()
            : String(existing.pattern || '');
        return existingStr === patternStr && patternStr !== '';
    });

    if (isDuplicate) {
        // Existing registration overwrite karanna (hot-reload safe)
        const idx = commands.findIndex(existing => {
            const existingStr = existing.pattern instanceof RegExp
                ? existing.pattern.toString()
                : String(existing.pattern || '');
            return existingStr === patternStr;
        });
        if (idx !== -1) commands.splice(idx, 1);
    }

    commands.push(data);
    return data;
}

module.exports = { cmd, AddCommand: cmd, Function: cmd, Module: cmd, commands };
