/* -*- js -*- */

goog.provide('tf.ui.activateRace');

goog.require('tf.ui');
goog.require('tf.ui.alert');
goog.require('tf.serverAPI');

tf.ui.activateRace.openPage = function() {

    // fill the list of races in which the user participates
    tf.ui.activateRace._populateRaces();

    var page = document.getElementById('activate-race-page');
    page.showModal();
    tf.ui.pushPage(function() {
        page.close();
    });
    document.activeElement.blur();
};

tf.ui.activateRace._populateRaces = function() {
    var racesData = tf.serverData.getRacesData();
    var curActiveRaceId = tf.storage.getSetting('activeRaceId');
    if (racesData.length == 0) {
        $('#activate-race-list').hide();
        $('#activate-race-no-races').show();
        $('#activate-race-register-link').attr('href', tf.serverAPI.URL);
    } else {
        $('#activate-race-list').show();
        $('#activate-race-no-races').hide();
        var s = '';
        for (var i = 0; i < racesData.length; i++) {
            var isActive = (racesData[i].id == curActiveRaceId);
            // FIXME: print organizer as well?
            var r = racesData[i];
            s += '<button type="button" autocomplete="off"' +
                ' id="activate-race-button-' + r.id + '"' +
                ' onclick="tf.ui.activateRace.buttonClick(' + r.id + ')"' +
                ' class="list-group-item';
            if (isActive) {
                s += ' active';
            }
            s += '">' +
                // FIXME: get regatta name from server
                '<p>' + 'Svenska Kryssarklubbens Testkrets' + '</p>' +
                '<p>' + 'Testseglingen 2017' + '</p>' +
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
            s += '</p></button></div>';
        }
        $('#activate-race-buttons').html(s);
    }
};

tf.ui.activateRace.buttonClick = function(raceId) {
    console.log('button clicked: ' + raceId);
    var id = '#activate-race-button-' + raceId;
    var btn = $(id);
    btn.parent().find('button').removeClass('active');
    btn.addClass('active');

    tf.state.setActiveRace(raceId);
};
