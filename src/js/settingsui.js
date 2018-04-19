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
    $('#settings-plans').removeClass('is-invalid');
    $('#settings-plans').val(tf.state.numberOfPlans.get());
    $('#settings-client-id').val(tf.state.clientId.get());
    $('#settings-poll-interval').removeClass('is-invalid');
    $('#settings-poll-interval').val(tf.state.pollInterval.get());
    $('#settings-font-size').val(tf.state.fontSize.get());
    $('#settings-immediate-log-send').prop(
        'checked', tf.state.immediateSendToServer.get());

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

    $('#settings-clear-state-btn').on('click', function() {
        tf.state.reset(true);
        return false;
    });

    $('#settings-show-debug-btn').on('click', function() {
        html = '<ul class="list-group">';
        for (var key in tf.state.debugInfo) {
            html += '<li class="list-group-item">' +
                key + ': ' + tf.state.debugInfo[key] + '</li>';
        }
        html += '</ul>';
        tf.ui.alert(html);
        return false;
    });

    $('#settings-client-id').blur(function() {
        if ($('#settings-client-id').val().trim() == '') {
            $('#settings-client-id').val(tf.state.defaultClientId);
        }
    });

    $('#settings-save-btn').on('click', function() {
        if ($('#settings-plans').hasClass('is-invalid') ||
            $('#settings-poll-interval').hasClass('is-invalid')) {
            return false;
        }
        var numberOfPlans = parseInt($('#settings-plans').val());
        tf.state.numberOfPlans.set(numberOfPlans);
        var pollInterval = parseInt($('#settings-poll-interval').val());
        tf.state.pollInterval.set(pollInterval);
        tf.state.clientId.set($('#settings-client-id').val().trim());
        tf.state.fontSize.set($('#settings-font-size').val());
        tf.state.immediateSendToServer.set(
            $('#settings-immediate-log-send').prop('checked'));
        tf.ui.popPage();
        return false;
    });

    $('#settings-plans').blur(function() {
        var plans = parseInt($('#settings-plans').val());
        if (plans >= 1 && plans <= 9) {
            $('#settings-plans').removeClass('is-invalid');
            //tf.state.numberOfPlans.set(plans);
        } else {
            $('#settings-plans').addClass('is-invalid');
        }
    });

    $('#settings-poll-interval').blur(function() {
        var pollInterval = parseInt($('#settings-poll-interval').val());
        if (pollInterval >= 0 && pollInterval <= 3600) {
            $('#settings-poll-interval').removeClass('is-invalid');
            //tf.state.pollInterval.set(pollInterval);
        } else {
            $('#settings-poll-interval').addClass('is-invalid');
        }
    });

});

