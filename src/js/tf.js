/* -*- js -*- */

/**
 * Define a namespace for the "24-timmars" application.
 */
goog.provide('tf');

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
