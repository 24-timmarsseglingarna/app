/* -*- js -*- */

/**
 * Confirm (Cancel/Continue) dialog.
 */

goog.provide('tf.ui.confirm');

goog.require('tf.ui');

tf.ui.confirm = function(html, cancelLabel, continueLabel, continueFn) {
    $('#confirm-body').html(html);
    $('#confirm-cancel').prop('value', cancelLabel);
    $('#confirm-continue').prop('value', continueLabel);
    $('#confirm-continue').on('click', function() {
        tf.ui.popPage(continueFn);
        return false;
    });
    tf.ui.pushPage(
        function() { $('#confirm-page').modal({backdrop: 'static'}); },
        function() { $('#confirm-page').modal('hide'); });
};

$(document).ready(function() {
    $('#confirm-cancel').on('click', function() {
        tf.ui.popPage();
        return false;
    });
});
