/* -*- js -*- */

// Define 'observable' variables.
export function defineVariable(obj, name, val) {
    obj[name] = {
        'get': function() {
            return obj[name]._val;
        },
        'set': function(val) {
            if (obj[name]._val == val) {
                return;
            }
            obj[name]._val = val;
            var fns = obj[name]._onChangeFns;
            for (var i = 0; i < fns.length; i++) {
                fns[i](val);
            }
        },
        'onChange': function(fn) {
            obj[name]._onChangeFns.push(fn);
        },
        '_val': val,
        '_onChangeFns': []
    };
};

export function legName(pointA, pointB) {
    return [pointA, pointB].sort().join('-');
};

export function defaultClientId() {
    var clientId;
    if (isCordova) {
        clientId = device.platform + '-' + device.model + '-' + device.uuid;
    } else {
        clientId = uuid();
    }
    return clientId;
};

export function uuid() {
    var dt = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
        /[xy]/g,
        function(c) {
            var r = (dt + Math.random() * 16) % 16 | 0;
            dt = Math.floor(dt / 16);
            return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    return uuid;
};

export function numberToName(n) {
    return String.fromCharCode(64 + n);
};

export function isOfficerRights(role) {
    if (role == 'officer' || role == 'admin') {
        return true;
    } else {
        return false;
    }
};

export function isAdminRights(role) {
    if (role == 'admin') {
        return true;
    } else {
        return false;
    }
};

function nProperties(obj) {
    var n = 0;
    var k;
    for (k in obj) {
        // todo: use shorter syntax when it is supported everywhere
        // if (Object.hasOwn(obj, k)) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) {
            n++;
        }
    }
    return n;
};


export function objectsEqual(a, b) {
    var k;
    if (typeof(a) !== typeof(b)) {
        return false;
    }

    if (a instanceof Object && b instanceof Object) {
        if (nProperties(a) !== nProperties(b)) {
            return false;
        }
        for (k in a) {
            if (!objectsEqual(a[k], b[k])) {
                return false;
            }
        }
        return true;
    } else {
        return a === b;
    }
}

/**
 * Detect environment
 */

export var isCordova = 'cordova' in window;

export var isTouch = 'ontouchstart' in window || navigator.msMaxTouchPoints > 0;
