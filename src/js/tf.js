/* -*- js -*- */

/**
 * Define a namespace for the "24-timmars" application.
 */
goog.provide('tf');

tf.legName = function(pointA, pointB) {
    return [pointA, pointB].sort().join('-');
};
