/* -*- js -*- */

goog.provide('tf.Regatta');

goog.require('tf');

/**
 * Regatta data
 */


/**
 * @constructor
 */
tf.Regatta = function(racesData, pod) {
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
        var finish = racesData[i].start_to.add(racesData[i].period, 'hours');
        if (this.last_finish == null ||
            finish.isAfter(this.last_finish)) {
            this.last_finish = finish;
        }
    }
    this.timer = null;
};

tf.Regatta.prototype.getId = function() {
    return this.regattaData.id;
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
            window.setInterval(this._timeout, 60000, this);
        }
    }
};

tf.Regatta.prototype._timeout = function() {
};

tf.Regatta.prototype.isOngoing = function() {
    // treat as ongoing up to 24 hours after last finish, in order to
    // handle late finish, but also to handle late entries
    // FIXME: > first_start and isActive
    return moment().isBetween(this.first_start,
                              this.last_finish.add(24, 'hours'));
};
