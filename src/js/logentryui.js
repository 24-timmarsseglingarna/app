/* -*- js -*- */

import {alert} from './alertui.js';
import {confirm} from './confirmui.js';
import {pushPage, popPage} from './pageui.js';
import {getTeamsData} from './serverdata.js';
import {isOfficerRights, isTouch} from './util.js';
import {getSetting} from './storage.js';

var onclose = undefined;

// FIXME: should not know anything about logbook. pass an entry
// instead, and a save function to be invoked.


export function fmtInterrupt(interrupt) {
    var s;
    if (interrupt == undefined) {
        return '';
    }
    switch (interrupt.type) {
    case 'done':
        s = 'Återupptar segling';
        break;
    case 'bridge':
        s = 'Broöppning';
        break;
    case 'anchor':
        s = 'Ankring';
        break;
    case 'engine':
        s = 'Motorgång';
        break;
    case 'visibility':
        s = 'Dålig sikt';
        break;
    case 'repair':
        s = 'Reparation';
        break;
    case 'rescue-time':
        s = 'Undsättning';
        break;
    case 'rescue-dist':
        s = 'Undsättning';
        break;
    }
    return s;
}

export function fmtSails(sails) {
    if (sails == undefined) {
        return '';
    }
    var s = [];
    if (sails.reef) {
        s.push('rev');
    } else if (sails.main) {
        s.push('stor');
    }
    if (sails.jib) {
        s.push('fock');
    } else if (sails.genoa) {
        s.push('genua');
    }
    if (sails.code) {
        s.push('code');
    } else if (sails.gennaker) {
        s.push('gennaker');
    } else if (sails.spinnaker) {
        s.push('spinnaker');
    }
    if (sails.other != undefined && sails.other != '') {
        s.push(sails.other);
    }
    return s.join(',');
}

export function fmtOther(e, state) {
    var s = [];
    if (e.lanterns == 'on') {
        s.push('Lanternor på');
    } else if (e.lanterns == 'off') {
        s.push('Lanternor av');
    }
    if (e.engine == 'on') {
        s.push('Motor på');
    } else if (e.engine == 'off') {
        s.push('Motor av');
    }
    if (e.type == 'endOfRace') {
        s.push('Segling slut');
    } else if (e.type == 'retire' && state == 'dns') {
        s.push('Startar inte (DNS)');
    } else if (e.type == 'retire') {
        s.push('Bryter seglingen (DNF)');
    } else if (e.finish) {
        s.push('Målgång');
    }
    if (e.type == 'sign') {
        s.push('Signerad');
    }
    return s.join(',');
}

/**
 * options:
 *  logBook - mandatory
 *  type :: 'round' | 'endOfRace'
 *        | 'seeOtherTeams' | 'protest' | 'interrupt'
 *        | 'changeSails' | 'engine' | 'lanterns'
 *        | 'retire' | 'sign'
 *        | 'other'
 *        | 'adminNote' | 'adminDSQ' | 'adminDist' | 'adminTime'
 *        | 'seeOtherBoats' // OBSOLETE, not used anymore
 *  index  -- either type or index MUST be given
 *  point
 *  onclose
 *  time :: Moment
*/
export function openLogEntry(options) {
    if (!options.logBook) {
        return;
    }
    // if the race hasn't started and this is the first log entry, ask
    // the user to confirm.
    if (options.logBook.getLog().length == 0 &&
        !options.logBook.getRace().hasStarted()) {
        var s = options.logBook.getRace().startTimes.start_from.format(
            'YYYY-MM-DD HH:mm:ss');
        confirm('<p>Seglingen startar ' + s +
                '. Vill du verkligen göra en loggboksanteckning?',
                'Nej',
                'Ja',
                null,
                function() {
                    openLogEntry2(options);
                });
    } else {
        openLogEntry2(options);
    }
}

function openLogEntry2(options) {
    var logEntryPage = $('#log-entry-page')[0];
    logEntryPage.logBook = options.logBook;
    logEntryPage.logEntryId = options.id;

    var type;
    var title;
    var isStart = false;
    var log = options.logBook.getLog();
    var index = undefined;
    var i, p;

    if (options.id) {
        for (i = 0; i < log.length; i++) {
            if (log[i].id == options.id || log[i].oldid == options.id) {
                index = i;
                break;
            }
        }
    }

    if (options.type) {
        type = options.type;
    } else if (index != undefined) {
        type = log[index].type;
    }

    var end;
    var hasStarted = false;
    if (index != undefined) {
        end = index;
    } else {
        end = log.length;
    }
    for (i = 0; i < end && !hasStarted; i++) {
        if (!log[i].deleted && log[i].type == 'round') {
            hasStarted = true;
        }
    }

    if (type == 'round' && !hasStarted) {
        isStart = true;
    }
    $('#log-entry-point').removeClass('is-invalid');
    $('#log-entry-time').removeClass('is-invalid');
    $('#log-entry-date').removeClass('is-invalid');
    $('#log-entry-admin-dist').removeClass('is-invalid');
    $('#log-entry-admin-time').removeClass('is-invalid');
    // if a point was clicked, make this field read-only
    if (options.point) {
        //$('#log-entry-point').prop('type', 'text');
        $('#log-entry-point').prop('readonly', true);
    } else {
        //$('#log-entry-point').prop('type', 'number');
        $('#log-entry-point').prop('readonly', false);
    }
    // hide everything except time and comment
    $('.log-entry-form').hide();
    $('#log-entry-form-time').show();
    $('#log-entry-form-comment').show();

    $('#log-entry-help').hide();
    $('#log-entry-admin-round-help').hide();
    if (options.logBook.standaloneUI && !isTouch) {
        $('#log-entry-help').show();
        if (type == 'round' && isOfficerRights(getSetting('role'))) {
            $('#log-entry-admin-round-help').show();
        }
    }

    var regattaId = options.logBook.getRace().getRegattaId();

    switch (type) {
    case 'round':
        title = 'Rundning';
        $('#log-entry-form-point').show();
        $('#log-entry-form-wind').show();
        initTeams(regattaId);
        $('#log-entry-form-teams').show();
        $('#log-entry-form-sail').show();
        $('#log-entry-form-sail2').show();
        if (isStart) {
            title = 'Start';
        } else {
            $('#log-entry-form-finish').show();
        }
        break;
    case 'endOfRace':
        title = 'Segelperioden slut';
        initGeoPosition();
        $('#log-entry-form-position').show();
        break;
    case 'seeOtherTeams':
        title = 'Siktar båtar';
        initTeams(regattaId);
        initGeoPosition();
        $('#log-entry-form-teams').show();
        $('#log-entry-form-position').show();
        break;
    case 'protest':
        title = 'Observation regelbrott';
        initGeoPosition();
        initProtest(regattaId);
        $('#log-entry-form-protest').show();
        $('#log-entry-form-position').show();
        break;
    case 'interrupt':
        title = 'Avbrott i seglingen';
        initGeoPosition();
        $('#log-entry-form-interrupt').show();
        $('#log-entry-form-position').show();
        break;
    case 'changeSails':
        title = 'Segelskifte';
        $('#log-entry-form-sail').show();
        $('#log-entry-form-sail2').show();
        $('#log-entry-form-wind').show();
        break;
    case 'engine':
        title = 'Motor för laddning';
        $('#log-entry-form-engine').show();
        break;
    case 'lanterns':
        title = 'Lanternor';
        initGeoPosition();
        $('#log-entry-form-lanterns').show();
        $('#log-entry-form-position').show();
        break;
    case 'retire':
        if (hasStarted) {
            title = 'Bryter seglingen (DNF)';
        } else {
            title = 'Startar inte (DNS)';
        }
        initGeoPosition();
        $('#log-entry-form-position').show();
        break;
    case 'other':
        title = 'Annat';
        break;
    case 'adminNote':
        title = 'Notering';
        break;
    case 'adminDist':
        title = 'Distansavdrag';
        $('#log-entry-form-admin-dist').show();
        break;
    case 'adminTime':
        title = 'Tidstillägg';
        $('#log-entry-form-admin-time').show();
        break;
    case 'adminDSQ':
        title = 'Ogiltig segling';
        break;
    }

    $('#log-entry-title-type').text(title);

    $('#log-entry-conflict').hide();

    if (index != undefined) {
        /* open an existing log entry */
        var entry = log[index];

        if (entry.state == 'conflict') {
            var user = entry.user || '&lt;okänd>';
            var client = entry.client || '&lt;okänd>';

            $('#log-entry-user').html('&nbsp;' + user + '&nbsp;');
            $('#log-entry-client').html('&nbsp;' + client);
            $('#log-entry-conflict').show();
        }

        var dt = moment(entry.time);
        $('#log-entry-timepicker').datetimepicker('date', dt);
        $('#log-entry-datepicker').datetimepicker('date', dt);

        if (entry.point != undefined) {
            $('#log-entry-point').val(entry.point);
            p = options.logBook.getRace().getPod().getPoint(entry.point);
            if (p) {
                $('#log-entry-point-name').html(p.name);
            } else {
                $('#log-entry-point-name').html('');
            }
        }
        if (entry.finish != undefined) {
            $('#log-entry-finish').prop('checked', entry.finish);
        }

        if (entry.wind != undefined) {
            initWind(entry.wind);
        }

        if (entry.interrupt != undefined) {
            switch (entry.interrupt.type) {
            case 'done':
                $('#log-entry-interrupt-done').prop('checked', true);
                break;
            case 'bridge':
                $('#log-entry-interrupt-bridge').prop('checked', true);
                break;
            case 'anchor':
                $('#log-entry-interrupt-anchor').prop('checked', true);
                break;
            case 'engine':
                $('#log-entry-interrupt-engine').prop('checked', true);
                break;
            case 'visibility':
                $('#log-entry-interrupt-visibility').prop('checked', true);
                break;
            case 'repair':
                $('#log-entry-interrupt-repair').prop('checked', true);
                break;
            case 'rescue-time':
                $('#log-entry-interrupt-rescue-time').prop('checked', true);
                break;
            case 'rescue-dist':
                $('#log-entry-interrupt-rescue-distance').prop('checked', true);
                break;
            }
        }

        if (entry.lanterns != undefined) {
            switch (entry.lanterns) {
            case 'on':
                $('#log-entry-lanterns-on').prop('checked', true);
                break;
            case 'off':
                $('#log-entry-lanterns-off').prop('checked', true);
                break;
            }
        }

        if (entry.engine != undefined) {
            switch (entry.engine) {
            case 'on':
                $('#log-entry-engine-on').prop('checked', true);
                break;
            case 'off':
                $('#log-entry-engine-off').prop('checked', true);
                break;
            }
        }

        if (entry.admin_dist != undefined) {
            $('#log-entry-admin-dist').val(entry.admin_dist);
        }

        if (entry.admin_time != undefined) {
            $('#log-entry-admin-time').val(entry.admin_time);
        }

        var teamElement;
        if (entry.protest != undefined) {
            teamElement = $('#log-entry-protest-team')[0];
            teamElement.options[0].selected = true;
            for (i = 1; i < teamElement.options.length; i++) {
                if (teamElement.options[i].value == entry.protest.team) {
                    teamElement.options[i].selected = true;
                }
            }
        }

        if (entry.sails != undefined) {
            initSails(entry.sails);
        }

        var teamsElement;
        if (entry.teams != undefined) {
            teamsElement = $('#log-entry-teams')[0];
            for (i = 0; i < teamsElement.options.length; i++) {
                var val = teamsElement.options[i].value;
                if ($.inArray(val, entry.teams) != -1) {
                    teamsElement.options[i].selected = true;
                }
            }
            $('#log-entry-teams').selectpicker('render');
        }

        if (entry.position != undefined) {
            $('#log-entry-position').val(entry.position);
        }

        if (entry.comment != undefined) {
            $('#log-entry-comment').val(entry.comment);
        } else {
            $('#log-entry-comment').val('');
        }
    } else {
        var point = options.point || '';
        $('#log-entry-point').val(point);
        p = options.logBook.getRace().getPod().getPoint(point);
        if (p) {
            $('#log-entry-point-name').html(p.name);
        } else {
            $('#log-entry-point-name').html('');
        }

        var time;
        if (options.time) {
            time = options.time;
        } else {
            time = moment();
        }
        $('#log-entry-timepicker').datetimepicker('date', time);
        $('#log-entry-datepicker').datetimepicker('date', time);
        // reset some fields to empty
        $('#log-entry-finish').prop('checked', false);
        $('#log-entry-comment').val('');
        $('#log-entry-position').val('');

        var found = false;
        if (type == 'changeSails' || type == 'round') {
            found = false;
            for (i = log.length - 1; !found && i >= 0; i--) {
                // if we find a wind observation from some other entry, use it
                if (!log[i].deleted && log[i].wind) {
                    initWind(log[i].wind);
                    found = true;
                }
            }
        }
        if (type == 'changeSails') {
            found = false;
            for (i = log.length - 1; !found && i >= 0; i--) {
                if (!log[i].deleted && log[i].sails) {
                    initSails(log[i].sails);
                    found = true;
                }
            }
        }
        if (type == 'round') {
            initSails({});
        }
        if (type == 'engine') {
            if (options.logBook.getEngine(options.beforeId)) {
                $('#log-entry-engine-off').prop('checked', true);
            } else {
                $('#log-entry-engine-on').prop('checked', true);
            }
        }
        if (type == 'lanterns') {
            if (options.logBook.getLanterns(options.beforeId)) {
                $('#log-entry-lanterns-off').prop('checked', true);
            } else {
                $('#log-entry-lanterns-on').prop('checked', true);
            }
        }
        if (type == 'interrupt') {
            if (options.logBook.getInterrupt(options.beforeId)) {
                $('#log-entry-interrupt-done').prop('checked', true);
            } else {
                $('#log-entry-interrupt-done').prop('checked', false);
            }
        }
    }

    onclose = options.onclose;
    logEntryPage.logEntryType = type;
    if (isStart) {
        logEntryPage.logEntryType = 'start';
    }
    pushPage(
        function() {
            $('#log-entry-page').modal({backdrop: 'static'});
            // We pass round and data from our keypressed function.
            if (options.type == 'round' && options.data) {
                $('#log-entry-round-toast-number').html(options.data);
                //$('#log-entry-round-toast').toast('hide');
                $('#log-entry-round-toast').toast('show');
            }
            $(document).on('keydown', keypressed);
        },
        function() {
            $(document).off('keydown', keypressed);
            closeLogEntry();
        });
    document.activeElement.blur();
    if (isTouch) {
        if (options.time) {
            // if a time was given, show the time picker b/c the given time
            // was probably not correct.
            $('#log-entry-timepicker').datetimepicker('show');
        }
    } else {
        $('#log-entry-time').focus().select();
    }
}

function saveAndClose(continuefn) {
    if (!logEntrySave()) {
        return false;
    }
    popPage(continuefn);
};

function keypressed(e) {
    if (e.key == 's' && e.altKey) {
        saveAndClose();
        return false;
    } else if (e.key == 'r' && e.altKey) {
        var point = $('#log-entry-point').val();
        if (point) {
            // Alt-r applies only when a round is logged; then it
            // saves the logentry and opens a new of type round.
            document.activeElement.blur();
            saveAndClose(function() {
                window.tfUiLogBookAddEntryClick({type: 'round',
                                                 data: point});
            });
            return false;
        }
    }
};

function initGeoPosition() {
    /* NOTE: the HTML and this code assumes lat N and long E */
    if ($('#log-entry-position').val() == '' &&
        navigator && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(pos) {
                var lat = pos.coords.latitude.toFixed(4);
                var lng = pos.coords.longitude.toFixed(4);
                if (pos.coords.longitude > 0) {
                    if (pos.coords.longitude < 10) {
                        lng = '00' + lng;
                    } else if (pos.coords.longitude < 100) {
                        lng = '0' + lng;
                    }
                }
                // check that the position is still unset - we don't
                // want to overwrite the user's input
                if ($('#log-entry-position').val() == '') {
                    var s = 'N ' + lat + '  E ' + lng;
                    $('#log-entry-position').val(s);
                }
            },
            function() {
                //alert('geo-error: ' + error.code);
            },
            {
                timeout: 1 * 60 * 1000,   // 1 minute
                maximumAge: 2 * 60 * 1000 // 2 minutes old is ok
            }
        );
    }
}

function getTeamsOptions(regattaId) {
    var teams = getTeamsData(regattaId);
    var logEntryPage = $('#log-entry-page')[0];
    var myId = logEntryPage.logBook.teamData.id;
    teams.sort(function(a, b) {
        return Number(a.start_number) - Number(b.start_number);
    });
    var teamsOptions = '';
    for (var i = 0; teams && i < teams.length; i++) {
        var id = teams[i].id;
        var sn = teams[i].start_number;
        var bn = teams[i].boat_name;
        var bcn = teams[i].boat_type_name;
        var bsn = teams[i].boat_sail_number;
        if (id == myId) {
            // don't add ourselves
            continue;
        }
        teamsOptions +=
            '<option title="' + bn + '" value="' + id + '">' +
            sn + ' - ' + bn + ', ' + bcn;
        if (bsn) {
            teamsOptions += ', ' + bsn;
        }
        teamsOptions += '</option>';
    }
    return teamsOptions;
}

function initTeams(regattaId) {
    var teamsElement = $('#log-entry-teams')[0];
    // populate 'teams' with list of teams from current regatta, -1 means reset
    if (regattaId == -1) {
        teamsElement.innerHTML = '';
    } else {
        teamsElement.innerHTML = getTeamsOptions(regattaId);
        $('#log-entry-teams').selectpicker('refresh');
    }
}

function initProtest(regattaId) {
    var teamElement = $('#log-entry-protest-team')[0];
    teamElement.innerHTML =
        '<option value="-1">-- ingen båt vald --</option>' +
        '<option value="0">Okänd båt</option>' +
        getTeamsOptions(regattaId);
    teamElement.options[0].selected = true;
}

function initSails(sails) {
    $('#log-entry-sail-main').prop('checked', sails.main);
    $('#log-entry-sail-reef').prop('checked', sails.reef);
    $('#log-entry-sail-jib').prop('checked', sails.jib);
    $('#log-entry-sail-genoa').prop('checked', sails.genoa);
    $('#log-entry-sail-code').prop('checked', sails.code);
    $('#log-entry-sail-gennaker').prop('checked', sails.gennaker);
    $('#log-entry-sail-spinnaker').prop('checked', sails.spinnaker);
    $('#log-entry-sail-other').val(sails.other);
}

function initWind(wind) {
    $('#log-entry-wind-dir').val(wind.dir);
    $('#log-entry-wind-speed').val(wind.speed);
}

function closeLogEntry() {
    $('#log-entry-timepicker').datetimepicker('hide');
    $('#log-entry-datepicker').datetimepicker('hide');
    $('#log-entry-page').modal('hide');
    if (onclose != undefined) {
        onclose();
        onclose = undefined;
    }
}

function getInterrupt() {
    var type = $('#log-entry-form-interrupt input:checked').val();
    if (type == undefined) {
        return undefined;
    } else {
        var interrupt = {
            type: type
        };
        return interrupt;
    }
}

function getProtest() {
    var teamElement = $('#log-entry-protest-team')[0];
    var team = undefined;
    for (var i = 0; i < teamElement.options.length; i++) {
        if (teamElement.options[i].selected &&
            teamElement.options[i].value != -1) {
            team = teamElement.options[i].value;
        }
    }
    if (team == undefined) {
        return undefined;
    } else {
        var protest = {
            team: team
        };
        return protest;
    }
}

function getSails() {
    var main = $('#log-entry-sail-main').prop('checked');
    var reef = $('#log-entry-sail-reef').prop('checked');
    var jib = $('#log-entry-sail-jib').prop('checked');
    var genoa = $('#log-entry-sail-genoa').prop('checked');
    var code = $('#log-entry-sail-code').prop('checked');
    var gennaker = $('#log-entry-sail-gennaker').prop('checked');
    var spinnaker = $('#log-entry-sail-spinnaker').prop('checked');
    var other = $('#log-entry-sail-other').val();
    var sails = {
        main: main,
        reef: reef,
        jib: jib,
        genoa: genoa,
        code: code,
        gennaker: gennaker,
        spinnaker: spinnaker,
        other: other
    };
    return sails;
};

function logEntrySave() {
    var logEntryPage = $('#log-entry-page')[0];
    var type = logEntryPage.logEntryType;
    if (type == 'start') {
        type = 'round';
    }
    var point = $('#log-entry-point').val();
    var finish = $('#log-entry-finish').prop('checked');
    var time = $('#log-entry-timepicker').datetimepicker('date');
    var date = $('#log-entry-datepicker').datetimepicker('date');
    var windDir = $('#log-entry-wind-dir').val();
    var windSpeed = $('#log-entry-wind-speed').val();
    var wind = {
        dir: windDir,
        speed: windSpeed
    };
    var teamsElement = $('#log-entry-teams')[0];
    var lanterns = $('#log-entry-form-lanterns input:checked').val();
    var engine = $('#log-entry-form-engine input:checked').val();
    var comment = $('#log-entry-comment').val();
    var position = $('#log-entry-position').val();
    var teams = [];
    for (var i = 0; i < teamsElement.options.length; i++) {
        if (teamsElement.options[i].selected) {
            teams.push(teamsElement.options[i].value);
        }
    }
    var interrupt = getInterrupt();
    var protest = getProtest();
    var sails = getSails();

    if (!time) {
        alert('<p>Du måste ange en tidpunkt.</p>');
        return false;
    }
    if (!date) {
        alert('<p>Du måste ange ett datum.</p>');
        return false;
    }

    // combine the date with the time
    var t = time.toObject();
    var d = date.toObject();
    t.years = d.years;
    t.months = d.months;
    t.date = d.date;

    var logEntry = {
        type: type,
        class: getLogClass(type),
        time: moment(t),
    };

    if (comment != '') {
        logEntry.comment = comment;
    }

    switch (type) {
    case 'round':
        logEntry.point = point;
        // validate point
        if (point == '') {
            alert('<p>Du måste fylla i en punkt.</p>');
            return false;
        }
        if (!logEntryPage.logBook.getRace().getPod().getPoint(point)) {
            alert('<p>Punkten "' + point +
                  '" finns inte.</p>');
            return false;
        }
        logEntry.wind = wind;
        logEntry.sails = sails;
        logEntry.teams = teams;
        logEntry.finish = finish;
        break;
    case 'endOfRace':
        logEntry.position = position;
        break;
    case 'seeOtherTeams':
        logEntry.position = position;
        logEntry.teams = teams;
        if (teams.length == 0 && comment == '') {
            alert('<p>Du måste notera vilken båt som siktades.</p>');
            return false;
        }
        break;
    case 'protest':
        logEntry.position = position;
        logEntry.protest = protest;
        if (protest == undefined && comment == '') {
            alert('<p>Du måste notera vilken båt protesten gäller.</p>');
            return false;
        }
        break;
    case 'interrupt':
        logEntry.position = position;
        logEntry.interrupt = interrupt;
        if (interrupt == undefined && comment == '') {
            alert('<p>Du måste notera vilket avbrott som gjordes.</p>');
            return false;
        }
        break;
    case 'changeSails':
        logEntry.wind = wind;
        logEntry.sails = sails;
        break;
    case 'engine':
        logEntry.engine = engine;
        break;
    case 'lanterns':
        logEntry.lanterns = lanterns;
        logEntry.position = position;
        break;
    case 'retire':
        logEntry.position = position;
        break;
    case 'other':
        break;
    case 'adminNote':
        break;
    case 'adminDSQ':
        break;
    case 'adminDist':
        var dist = parseInt($('#log-entry-admin-dist').val());
        if (isNaN(dist)) {
            alert('<p>Du måste ange ett distansavdrag.</p>');
            return false;
        }
        logEntry.admin_dist = dist;
        break;
    case 'adminTime':
        var atime = parseInt($('#log-entry-admin-time').val());
        if (isNaN(atime)) {
            alert('<p>Du måste ange ett tidstillägg som' +
                  ' ett tal (minuter).</p>');
            return false;
        }
        logEntry.admin_time = atime;
        break;
    }

    // save the current logbook in the page
    logEntryPage.logBook.saveToLog(logEntry, logEntryPage.logEntryId);
    return true;
};

var adminLog = {
    'adminNote': true,
    'adminDSQ': true,
    'adminDist': true,
    'adminTime': true
};

function getLogClass(type) {
    if (adminLog[type]) {
        return 'AdminLog';
    } else {
        return 'TeamLog';
    }
}

function sailChanged(element) {
    var checked = element.checked;
    var radioLikeGroups =
        [['log-entry-sail-jib', 'log-entry-sail-genoa'],
         ['log-entry-sail-code', 'log-entry-sail-gennaker',
          'log-entry-sail-spinnaker']];

    var found = false;

    switch (element.id) {
    case 'log-entry-sail-main':
        if (!checked) {
            $('#log-entry-sail-reef')[0].checked = false;
        }
        found = true;
        break;
    case 'log-entry-sail-reef':
        if (checked) {
            $('#log-entry-sail-main')[0].checked = true;
        }
        found = true;
        break;
    }
    for (var u = 0; !found && u < radioLikeGroups.length; u++) {
        found = updateRadioLikeGroup(element, radioLikeGroups[u]);
    }
};

/*
 * A radioLikeGroup behaves like radio buttons, except that all items
 * in a group can be turned off.
 */
function updateRadioLikeGroup(element, g) {
    var found = false;
    for (var i = 0; !found && i < g.length; i++) {
        if (element.id == g[i]) {
            found = true;
            for (var j = 0; j < g.length; j++) {
                if (i != j) {
                    document.getElementById(g[j]).checked = false;
                }
            }
        }
    }
    return found;
};


/*
function setPosition(id, pos) {
    var lat = pos.coords.latitude.toFixed(4);
    var lng = pos.coords.longitude.toFixed(4);
    if (pos.coords.longitude > 0) {
        if (pos.coords.longitude < 10) {
            lng = '00' + lng;
        } else if (pos.coords.longitude < 100) {
            lng = '0' + lng;
        }
    }
    // check that the position is still unset - we don't
    // want to overwrite the user's input
    if ($(id).val() == '') {
        var s = 'N ' + lat + '  O ' + lng;
        $(id).val(s);
    }
};
*/

/**
 * Set up handlers for buttons and form input.
 */
$(document).ready(function() {
    var logEntryPage = $('#log-entry-page')[0];
    var icons = {
        date: 'icon-calendar',
        time: 'icon-clock',
        up: 'icon-angle-up',
        down: 'icon-angle-down',
        previous: 'icon-angle-left',
        next: 'icon-angle-right',
        close: 'icon-close'
    };
    $('#log-entry-timepicker').datetimepicker({
        format: 'HH:mm',
        stepping: 1,
        icons: icons,
        widgetPositioning: {
            horizontal: 'left',
            vertical: 'bottom'
        },
        focusOnShow: false,
        locale: 'sv',
        toolbarPlacement: 'top',
        buttons: {
            showClose: true
        }
    });
    $('#log-entry-datepicker').datetimepicker({
        // NOTE: if we don't use YYYY (or YY), tempusdominus will
        // use the current year.
        format: 'DD MMM YYYY',
        icons: icons,
        widgetPositioning: {
            horizontal: 'right',
            vertical: 'bottom'
        },
        focusOnShow: false,
        locale: 'sv',
        toolbarPlacement: 'top',
        buttons: {
            showClose: true
        }
    });

    $('#log-entry-cancel').on('click', function() {
        popPage();
        return false;
    });
    $('#log-entry-save').on('click', function() {
        saveAndClose();
        return false;
    });

    $('.log-entry-sail').change(function(event) {
        sailChanged(event.target);
    });

    $('#log-entry-point').blur(function() {
        var point = $('#log-entry-point').val();
        var p = logEntryPage.logBook.getRace().getPod().getPoint(point);
        if (!p) {
            $('#log-entry-point-name').html('');
            $('#log-entry-point').addClass('is-invalid');
        } else {
            $('#log-entry-point-name').html(p.name);
            $('#log-entry-point').removeClass('is-invalid');
        }
    });
    $('#log-entry-time').blur(function() {
        var time = $('#log-entry-timepicker').datetimepicker('date');
        if (!time) {
            $('#log-entry-time').addClass('is-invalid');
        } else {
            $('#log-entry-time').removeClass('is-invalid');
        }
    });
    $('#log-entry-date').blur(function() {
        var time = $('#log-entry-datepicker').datetimepicker('date');
        if (!time) {
            $('#log-entry-date').addClass('is-invalid');
        } else {
            $('#log-entry-date').removeClass('is-invalid');
        }
    });
    $('#log-entry-admin-dist').blur(function() {
        var dist = parseInt($('#log-entry-admin-dist').val());
        if (isNaN(dist)) {
            $('#log-entry-admin-dist').addClass('is-invalid');
        } else {
            $('#log-entry-admin-dist').removeClass('is-invalid');
        }
    });
    $('#log-entry-admin-time').blur(function() {
        var atime = parseInt($('#log-entry-admin-time').val());
        if (isNaN(atime)) {
            $('#log-entry-admin-time').addClass('is-invalid');
        } else {
            $('#log-entry-admin-time').removeClass('is-invalid');
        }
    });
});
