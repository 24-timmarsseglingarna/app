/* -*- js -*- */

goog.provide('tf.Race');

goog.require('tf');

/**
 * Race data
 */


/**
 * @constructor
 */
tf.Race = function(regatta, raceData) {
    this.regatta = regatta;
    this.raceData = raceData;
    this.startTimes = {
        start_from: raceData.start_from,
        start_to: raceData.start_to
    },
    this.plans = {};
};

tf.Race.prototype.getId = function() {
    return this.raceData.id;
};

tf.Race.prototype.getRegattaId = function() {
    return this.raceData.regatta_id;
};

tf.Race.prototype.getRegatta = function() {
    return this.regatta;
};

tf.Race.prototype.getPod = function() {
    return this.regatta.getPod();
};

tf.Race.prototype.getRaceLengthHours = function() {
    return this.raceData.period;
};

tf.Race.prototype.getMinimumRaceLengthHours = function() {
    return this.raceData.min_period;
};

tf.Race.prototype.getStartTimes = function() {
    return this.startTimes;
};

tf.Race.prototype.getPlan = function(name) {
    if (!this.plans[name]) {
        this.plans[name] = new tf.Plan(name, this.regatta.getPod(), undefined);
    }
    return this.plans[name];
};

tf.Race.prototype.hasStarted = function() {
    return moment().isAfter(this.startTimes.start_from);
};
