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
    var racesData = tf.serverData.getMyRacesData();
    var curActiveRaceId = 0;
    if (tf.state.curRace) {
        curActiveRaceId = tf.state.curRace.getId();
    }
    if (racesData.length == 0) {
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
            '<p>Ingen segling aktiverad</p>' +
            '</button>';

        for (var i = 0; i < racesData.length; i++) {
            var isActive = (racesData[i].id == curActiveRaceId);
            var r = racesData[i];
            s += '<button type="button" autocomplete="off"' +
                ' id="activate-race-button-' + r.id + '"' +
                ' onclick="tf.ui.activateRace.buttonClick(' + r.id + ')"' +
                ' class="list-group-item list-group-item-action' +
                ' align-items-start';
            if (isActive) {
                s += ' active';
            }
            s += '">' +
                '<p>' + r.organizer_name + '</p>' +
                '<p>' + r.regatta_name + '</p>' +
                '<p>' + r.period + ' timmar. ';
            if (r.description) {
                s += r.description + '. ';
            }
            s += 'Start: ' + r.start_from.format('dddd D MMMM [kl.] HH:mm');
            if (!r.start_from.isSame(r.start_to)) {
                s += ' - ';
                if (r.start_from.isSame(r.start_to, 'day')) {
                    s += r.start_to.format('HH:mm');
                } else {
                    s += r.start_to.format('dddd D MMMM [kl.] HH:mm');
                }
            }
            s += '</p></button>';
        }
        $('#activate-race-buttons').html(s);
    }
};

tf.ui.activateRace.buttonClick = function(raceId) {
    var id = '#activate-race-button-' + raceId;
    var btn = $(id);
    btn.parent().find('button').removeClass('active');
    btn.addClass('active');

    tf.state.setActiveRace(raceId, function() { tf.ui.logBookChanged(); });
};
