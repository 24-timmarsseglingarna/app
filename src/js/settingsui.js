/* -*- js -*- */

goog.provide('tf.ui.settings');

goog.require('tf.ui');
goog.require('tf.ui.alert');

tf.ui.settings.openPage = function() {
    if (tf.state.isLoggedIn) {
        $('#settings-login-block').hide();
        $('#settings-logout-block').show();
        $('#settings-logout-text').text('Du är inloggad som ' +
                                        tf.storage.getSetting('email'));
    } else {
        $('#settings-login-block').show();
        $('#settings-logout-block').hide();
    }

    tf.ui.pushPage(
        function() { $('#settings-page').modal({backdrop: 'static'}); },
        function() { $('#settings-page').modal('hide'); });
    document.activeElement.blur();
};

/**
 * Set up handlers for buttons and form input.
 */
$(document).ready(function() {
    $('#settings-login-btn').on('click', function() {
        tf.ui.popPage(function() {
            tf.ui.loginPage.openPage();
        });
        return false;
    });

    $('#settings-logout-btn').on('click', function() {
        tf.state.logout();
        tf.ui.popPage(function() {
            // after logout, go to login page
            tf.ui.loginPage.openPage();
        });
        return false;
    });

    $('#settings-update-btn').on('click', function() {
        tf.serverData.update(tf.storage.getSetting('userId'));
        return false;
    });

});

