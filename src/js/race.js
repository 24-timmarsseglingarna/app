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
    this.endp = 'start'; // :: "start" | ExplicitNameOfEndPoint
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

// FIXME: allowed_start_point not set in server!
tf.Race.prototype.getAllowedStartPoint = function() {
    return this.raceData.allowed_start_point;
};

/**
 * @return {?tf.Point}
 */
tf.Race.prototype.mandatoryCommonFinish = function() {
    return this.raceData.period;
};

