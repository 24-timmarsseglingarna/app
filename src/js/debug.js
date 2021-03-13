/* -*- js -*- */

export var debugInfo = {};
export var debugLog = [];

var maxLogLen = 50;

window.onerror = function(errorMsg, url, lineNumber, column) {
    addLog(['ERR: ' + errorMsg + ' ' + url + ':' + lineNumber + ':' + column]);
};

export function dbg() {
    addLog(arguments);
    console.log.apply(console, arguments);
};

function addLog(args) {
    if (maxLogLen == 0) {
        return;
    }
    debugLog.push({time: moment(),
                   args: args});
    if (debugLog.length > maxLogLen) {
        debugLog.shift();
    }
};

export function setDebugMaxLogLen(val) {
    maxLogLen = val;
    if (maxLogLen == 0) {
        debugLog = [];
    }
    while (debugLog.length > maxLogLen) {
        debugLog.shift();
    }
};
