/* -*- js -*- */

goog.provide('tf.ui.addLogEntry');

goog.require('tf.serverAPI');
goog.require('tf.ui');
goog.require('tf.ui.alert');

tf.ui.addLogEntry.openPage = function(options) {

    /* Modify the text depending on current state */
    if (!tf.state.boatState.lanterns) {
        $('#tf-log-lanterns').text('Tänder lanternor');
    } else {
        $('#tf-log-lanterns').text('Släcker lanternor');
    }
    if (!tf.state.boatState.engine) {
        $('#tf-log-engine').text('Startar motor för laddning');
    } else {
        $('#tf-log-engine').text('Stänger av motor för laddning');
    }
    if (!tf.state.activeInterrupt) {
        $('#tf-log-interrupt').text('Avbrott i seglingen');
    } else {
        $('#tf-log-interrupt').text('Återupptar segling');
    }

    var page = $('#add-log-entry-page')[0];
    page.tfOptions = options || {};
    tf.ui.pushPage(
        function() { $('#add-log-entry-page').modal({backdrop: 'static'}); },
        function() { $('#add-log-entry-page').modal('hide'); });
    document.activeElement.blur();
};

/**
 * Set up handlers for buttons and form input.
 */
$(document).ready(function() {
    $('.tf-log-item').on('click', function(event) {
        // remove the addLogEntry page from page stack
        var page = $('#add-log-entry-page')[0];
        tf.ui.popPage(function() {
            tf.ui.logEntry.openLogEntry({
                logBook: tf.state.curLogBook,
                time: page.tfOptions.time,
                onclose: page.tfOptions.onclose,
                type: $(event.target).data('type') // html5 data-type attribute
            });
        });
        return false;
    });
});
