/* -*- js -*- */

/**
 * Define a namespace for the "24-timmars" application.
 */
goog.provide('tf');

// Define 'observable' variables.
tf.defineVariable = function(obj, name, val) {
    obj[name] = {
        'get': function() {
            return obj[name]._val;
        },
        'set': function(val) {
            obj[name]._val = val;
            fns = obj[name]._onChangeFns;
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

tf.legName = function(pointA, pointB) {
    return [pointA, pointB].sort().join('-');
};

tf.uuid = function() {
    var dt = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
            /[xy]/g,
        function(c) {
            var r = (dt + Math.random()*16)%16 | 0;
            dt = Math.floor(dt/16);
            return (c=='x' ? r :(r&0x3|0x8)).toString(16);
        });
    return uuid;
};
