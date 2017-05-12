/* -*- js -*- */

goog.provide('tf.Race');

goog.require('tf');

/**
 * Race data
 */


/**
 * @constructor
 */
tf.Race = function(regatta, raceData, pod) {
    this.regatta = regatta;
    this.raceData = raceData;
    this.pod = pod;
};

tf.Race.prototype.getId = function() {
    return this.raceData.id;
};

tf.Race.prototype.getRegattaId = function() {
    return this.raceData.regatta_id;
};

tf.Race.prototype.getPod = function() {
    return this.pod;
};

tf.Race.prototype.getRaceLengthHours = function() {
    return this.raceData.period;
};
