/* -*- js -*- */

goog.provide('tf.ui.activateRace');

goog.require('tf.serverAPI');
goog.require('tf.ui');
goog.require('tf.ui.alert');

tf.ui.activateRace.openPage = function() {

    // fill the list of races in which the user participates
    tf.ui.activateRace._populateRaces();
    tf.ui.pushPage(
        function() { $('#activate-race-page').modal({backdrop: 'static'}); },
        function() { $('#activate-race-page').modal('hide'); });
    document.activeElement.blur();
};

tf.ui.activateRace._populateRaces = function() {
    var races = tf.serverData.getMyRaces();
    var curActiveRaceId = 0;
    if (tf.state.curRace) {
        curActiveRaceId = tf.state.curRace.getId();
    }
    if (races.length == 0) {
        $('#activate-race-list').hide();
        $('#activate-race-no-races').show();
        $('#activate-race-register-link').attr('href', tf.serverAPI.URL);
    } else {
        $('#activate-race-list').show();
        $('#activate-race-no-races').hide();
        var s = '';
        s += '<button type="button" autocomplete="off"' +
             ' id="activate-race-button-0"' +
             ' onclick="tf.ui.activateRace.buttonClick(0)"' +
            ' class="list-group-item list-group-item-action' +
            ' align-items-start';
        if (curActiveRaceId == 0) {
            s += ' active';
        }
        s += '">' +
            '<strong>Ingen segling aktiverad</strong>' +
            '</button>';

        // FIXME: read pod from server
        var pod = tf.state.defaultPod;

        for (var i = 0; i < races.length; i++) {
            var r = races[i].raceData;
            var t = races[i].teamData;
            var isActive = (r.id == curActiveRaceId);
            s += '<button type="button" autocomplete="off"' +
                ' id="activate-race-button-' + r.id + '"' +
                ' onclick="tf.ui.activateRace.buttonClick(' + r.id + ')"' +
                ' class="list-group-item list-group-item-action' +
                ' align-items-start';
            if (isActive) {
                s += ' active';
            }
            s += '">' +
                '<strong>' + r.regatta_name + '</strong><br/>' +
                '<span class="small">' +
                r.organizer_name + '<br/>' +
                r.period + ' timmar, ';
            if (r.description) {
                s += r.description;
            }
            if (r.common_finish) {
                s += ', gemensamt mål ' + r.common_finish;
                var p = pod.getPoint(r.common_finish);
                if (p) {
                    s += ' ' + p.name;
                }
            } else {
                s += ', mål vid start';
            }
            s += '<br/>';

            s += 'Start: ' + r.start_from.format('dddd D MMMM [kl.] HH:mm');
            if (!r.start_from.isSame(r.start_to)) {
                s += ' - ';
                if (r.start_from.isSame(r.start_to, 'day')) {
                    s += r.start_to.format('HH:mm');
                } else {
                    s += r.start_to.format('dddd D MMMM [kl.] HH:mm');
                }
            }
            s += ' från ' + t.start_point;
            var p = pod.getPoint(t.start_point);
            if (p) {
                s += ' ' + p.name;
            }
            s += '<br/>';
            s += t.boat_type_name + ' ' + t.boat_sail_number + ' ' +
                t.boat_name;
            s += '</span></button>';
        }
        $('#activate-race-buttons').html(s);
    }
};

tf.ui.activateRace.buttonClick = function(raceId) {
    var id = '#activate-race-button-' + raceId;
    var btn = $(id);
    btn.parent().find('button').removeClass('active');
    btn.addClass('active');

    tf.state.activateRace(raceId);
};

/**
 * Set up handlers for buttons
 */
$(document).ready(function() {
    $('#activate-update-btn').on('click', function() {
        tf.serverData.update(tf.storage.getSetting('personId'),
                             function() {
                                 tf.ui.activateRace._populateRaces();
                             });
    })
});
