/* -*- js -*- */

/**
 * HTML-based alert function.  Does not use window.alert().
 */

goog.provide('tf.ui.alert');

goog.require('tf.ui');

tf.ui.alert = function(html) {
    $('#alert-body').html(html);
    tf.ui.pushPage(function() {
        $('#alert-page')[0].close();
    });
    $('#alert-page')[0].showModal();
};

$(document).ready(function() {
    $('#alert-ok').on('click', function() {
        tf.ui.popPage();
        return false;
    });
});
