/* -*- js -*- */

import {Plan} from './plan.js';

/**
 * Race data
 */

/**
 * @constructor
 */
export var Race = function(regatta, raceData) {
    this.regatta = regatta;
    this.raceData = raceData;
    this.startTimes = {
        start_from: raceData.start_from,
        start_to: raceData.start_to
    },
    this.plans = {};
};

Race.prototype.getId = function() {
    return this.raceData.id;
};

Race.prototype.getRegattaId = function() {
    return this.raceData.regatta_id;
};

Race.prototype.getRegatta = function() {
    return this.regatta;
};

Race.prototype.getPod = function() {
    return this.regatta.getPod();
};

Race.prototype.getRaceLengthHours = function() {
    return this.raceData.period;
};

Race.prototype.getMinimumRaceLengthHours = function() {
    return this.raceData.min_period;
};

Race.prototype.getStartTimes = function() {
    return this.startTimes;
};

Race.prototype.getPlan = function(name) {
    if (!this.plans[name]) {
        this.plans[name] = new Plan(name, this.regatta.getPod(), undefined);
    }
    return this.plans[name];
};

Race.prototype.hasStarted = function() {
    return moment().isAfter(this.startTimes.start_from);
};
