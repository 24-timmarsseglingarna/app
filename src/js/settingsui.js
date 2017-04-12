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

    var page = document.getElementById('settings-page');
    page.showModal();
    tf.ui.pushPage(function() {
        page.close();
    });
    document.activeElement.blur();
};

/**
 * Set up handlers for buttons and form input.
 */
$(document).ready(function() {
    $('#settings-login-btn').on('click', function() {
        tf.ui.popPage();
        tf.ui.loginPage.openPage();
        return false;
    });

    $('#settings-logout-btn').on('click', function() {
        tf.state.logout();
        props = {
            email: null,
            password: null,
            token: null,
            userId: null
        };
        tf.storage.setSettings(props);
        tf.ui.popPage();
        // after logout, go to login page
        tf.ui.loginPage.openPage();
        return false;
    });
});

