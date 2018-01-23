/* -*- js -*- */

/**
 * HTML-based alert function.  Does not use window.alert().
 */

goog.provide('tf.ui.alert');

goog.require('tf.ui');

tf.ui.alert = function(html) {
    $('#alert-body').html(html);
    tf.ui.pushPage(function() { $('#alert-page').modal({backdrop: 'static'}); },
                   function() { $('#alert-page').modal('hide'); });
};

$(document).ready(function() {
    $('#alert-ok').on('click', function() {
        tf.ui.popPage();
        return false;
    });
});
