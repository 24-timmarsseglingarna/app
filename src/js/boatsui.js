/* -*- js -*- */

goog.provide('tf.ui.boats');

goog.require('tf.ui');
goog.require('tf.ui.alert');

tf.ui.boats.openPage = function(options) {
    var page = $('#boats-page')[0];
    page.tfOptions = options || {};
    tf.ui.pushPage(function() {
        page.close();
    });
    page.showModal();
    document.activeElement.blur();
};
