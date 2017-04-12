/* -*- js -*- */

goog.provide('tf.ui.loginPage');

goog.require('tf.serverAPI');
goog.require('tf.ui');

tf.ui.loginPage.openPage = function() {
    $('#login-error-btn').hide();
    $('#login-submit').val('Login');
    $('#login-email').val(tf.storage.getSetting('email'));
    $('#login-password').val(tf.storage.getSetting('password'));
    $('#login-save-password').prop('checked',
                                   tf.storage.getSetting('savePassword'));
    tf.ui.pushPage(function() {
        $('#login-page')[0].close();
    });
    $('#login-page')[0].showModal();
    document.activeElement.blur();
};

tf.ui.loginPage.loginResponseFn = function(response) {
    $('#login-submit').val('Login');
    if (response) {
        props = {
            email: response.email,
            password: response.password,
            token: response.token,
            userId: response.userId,
            savePassword: $('#login-save-password').prop('checked')
        };
        if (!props.savePassword) {
            props.password = null;
        }
        console.log('set: ' + JSON.stringify(props));
        tf.storage.setSettings(props);
        tf.state.loggedIn();
        tf.ui.popPage();
    } else {
        $('#login-error-btn').val('Inloggningen misslyckades');
        $('#login-error-btn').show();
    }
};

$(document).ready(function() {
    $('#login-error-btn').on('click', function() {
        $('#login-error-btn').hide();
    });

    $('#login-submit').on('click', function() {
        $('#login-submit').val('Loggar in...');
        tf.serverAPI.login($('#login-email').val(),
                           $('#login-password').val(),
                           tf.ui.loginPage.loginResponseFn);
        return false;
    });
});
