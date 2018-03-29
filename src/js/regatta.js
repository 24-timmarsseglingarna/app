/* -*- js -*- */

goog.provide('tf.Regatta');

goog.require('tf');

/**
 * Regatta data
 */


/**
 * @constructor
 */
tf.Regatta = function(id, racesData, pod) {
    this.id = id;
    this.racesData = racesData;
    this.pod = pod;
    this.plans = {};
    this.first_start = null;
    this.last_finish = null;
    for (var i = 0; i < racesData.length; i++) {
        if (this.first_start == null ||
            racesData[i].start_from.isBefore(this.first_start)) {
            this.first_start = racesData[i].start_from;
        }
        var finish = moment(racesData[i].start_to);
        finish.add(racesData[i].period, 'hours');
        if (this.last_finish == null ||
            finish.isAfter(this.last_finish)) {
            this.last_finish = finish;
        }
    }
    this.timer = null;
    this.logs = {};
    this.last_log_update = null;
};

tf.Regatta.prototype.getId = function() {
    return this.id;
};

tf.Regatta.prototype.getPod = function() {
    return this.pod;
};

tf.Regatta.prototype.setActive = function(active) {
    if (!active) {
        window.clearInterval(this.timer);
    } else {
        if (this.isOngoing()) {
            this._timeout();
            this.times = window.setInterval(function(r) { t._timeout(); },
                                            60000, this);
        }
    }
};

tf.Regatta.prototype.updateLogFromServer = function(continueFn) {
    var regatta = this;
    var lastUpdate = null;
    if (this.last_log_update) {
        lastUpdate = this.last_log_update.toISOString();
    }
    tf.serverData.getNewRegattaLog(
        this.id, lastUpdate,
        function(log) {
            for (var i = 0; i < log.length; i++) {
                id = log[i].id;
                teamId = log[i].team_id;
                if (!regatta.logs[teamId]) {
                    regatta.logs[teamId] = {};
                }
                regatta.logs[teamId][id] = log[i];
                if (regatta.last_log_update == null ||
                    log[i].updated_at.isAfter(regatta.last_log_update)) {
                    regatta.last_log_update = log[i].updated_at;
                }
            }
            continueFn();
        });
};


tf.Regatta.prototype._timeout = function() {
};

tf.Regatta.prototype.isOngoing = function() {
    // treat as ongoing up to 24 hours after last finish, in order to
    // handle late finish, but also to handle late entries
    // FIXME: > first_start and isActive
    var maxTime = moment(this.last_finish).add(24, 'hours')
    return moment().isBetween(this.first_start, maxTime);
};
