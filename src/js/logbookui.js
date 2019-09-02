/* -*- js -*- */

import {alert} from './alertui.js';
import {confirm} from './confirmui.js';
import {curState, setupLogin} from './state.js';
import {pushPage, popPage} from './pageui.js';
import {fmtInterrupt, fmtSails, fmtOther, openLogEntry} from './logentryui.js';
import {openPage as openAddLogEntryPage} from './addlogentryui.js';
import {getSetting, setSettings} from './storage.js';
import {setServerURL} from './serverapi.js';
import {getRaceP, getRegattaTeamsP,
        getTeamLogP, getTeamData, getTeamsData} from './serverdata.js';
import {Regatta} from './regatta.js';
import {Race} from './race.js';
import {LogBook} from './logbook.js';
import {isOfficerRights, isAdminRights, isTouch} from './util.js';

export function openLogBook(options) {
    refreshLogBook(options);
    pushPage(
        function() {
            $('#log-book-page').modal({backdrop: 'static'});
            $(document).on('keydown', keypressed);
        },
        function() {
            $(document).off('keydown', keypressed);
            $('#log-book-page').modal('hide');
        },
        options.mainPage);
    document.activeElement.blur();
};

function keypressed(e) {
    if (e.key == 'n' && e.altKey) {
        window.tfUiLogBookAddEntryClick();
        return false;
    }
};

function getTeam(teams, teamId) {
    for (var i = 0; i < teams.length; i++) {
        if (teams[i].id == teamId) {
            return teams[i];
        }
    }
};

function fmtTeam(teamid, teams, colortype) {
    var t = getTeam(teams, teamid);
    var s = '';
    var media = $('#tf-media').css('content');
    if (t) {
        s += '<span class="badge badge-pill badge-' + colortype +
        ' mr-1 align-middle">' + t.start_number + '</span>';
        s += t.boat_type_name + ' ';
        if (media == '"md+"') {
            s += (t.boat_sail_number || '') + ' ';
        }
        s += t.boat_name;
    }
    return s;
};

function getBoat(teams, startNo) {
    for (var i = 0; i < teams.length; i++) {
        if (teams[i].start_number == startNo) {
            return teams[i];
        }
    }
};

function fmtBoat(sn, teams, colortype) {
    var s = '<span class="badge badge-pill badge-' + colortype +
        ' mr-1 align-middle">' + sn + '</span>';
    var t = getBoat(teams, sn);
    var media = $('#tf-media').css('content');
    if (t) {
        s += t.boat_type_name + ' ';
        if (media == '"md+"') {
            s += (t.boat_sail_number || '') + ' ';
        }
        s += t.boat_name;
    }
    return s;
};

function isSkipper(logBook) {
    return (curState.loggedInPersonId.get() == logBook.teamData.skipper_id);
};

function refreshLogBook(options) {
    var logBook = options.logBook;
    var isReadOnly = logBook.isReadOnly();
    var boatName = logBook.teamData.boat_name;
    var startNo = logBook.teamData.start_number;
    var sxk = logBook.teamData.sxk_handicap;
    var log = logBook.getLog();
    var pod = logBook.race.getPod();
    var prev;
    var rows = '';

    $('#log-book-help').hide();
    if (logBook.standaloneUI && !isTouch) {
        $('#log-book-cancel').hide();
        if (logBook.signed != 'signed-sync') {
            $('#log-book-help').show();
        }
        $('.log-book-extra-data').show();
    } else {
        $('#log-book-cancel').show();
        $('.log-book-extra-data').hide();
    }
    if (logBook.hasConflict()) {
        $('#log-book-conflict').show();
    } else {
        $('#log-book-conflict').hide();
    }
    if (logBook.signed == 'signed') {
        $('#log-book-signed').show();
    } else {
        $('#log-book-signed').hide();
    }
    if (logBook.signed == 'signed-sync') {
        $('#log-book-signed-sync').show();
    } else {
        $('#log-book-signed-sync').hide();
    }
    $('#log-book-early-elem').hide();
    $('#log-book-late-elem').hide();
    $('#log-book-comp-elem').hide();
    $('#log-book-approved-elem').hide();
    $('#log-book-admin-dist-elem').hide();
    $('#log-book-plaque-elem').hide();
    $('#log-book-net-elem2').hide();

    // no header and no arrow in the popup
    var popover_template = '<div class=\'popover log-book-edit-popover\'' +
        ' role=\'tooltip\'>' +
        '<div class=\'popover-body\'></div></div>';

    for (var i = 0; i < log.length; i++) {
        var e = log[i];
        if (e.deleted) continue;
        var distance = '';
        var distTD = '<td>';
        var distPost = '';
        var pointColor = 'secondary';
        if (e.point && prev) {
            distance = pod.getDistance(prev.point, e.point);
            if (distance == -1) {
                distance = 0;
            }
            if (e._legStatus) {
                distTD = '<td class="log-book-invalid-dist text-danger">';
                distPost = '<span class="pl-1 icon-exclamation-circle"></span>';
                pointColor = 'danger';
                distance = 0;
            }
            prev = e;
        } else if (e.point) {
            prev = e;
        }
        var edit_button_html = '<div class=\'row log-book-edit-buttons\'' +
            ' data-logid=\'' + e.id + '\'>' +
            '<button class=\'btn btn-secondary\' id=\'log-book-btn-edit\'>' +
            'Ändra</button>' +
            '<button class=\'btn btn-secondary\' id=\'log-book-btn-add\'>' +
            'Infoga</button>' +
            '<button class=\'btn btn-warning\' id=\'log-book-btn-del\'>' +
            'Radera</button>' +
            '</div>';

        var point = e.point || '';
        var pointName = '';
        var media = $('#tf-media').css('content');
        if (e.point && (media == '"sm"' || media == '"md+"')) {
            var p = pod.getPoint(point);
            if (p) {
                pointName = p.name;
            }
        }

        var wind = '';
        if (e.wind) {
            if (e.wind.dir == '-' && e.wind.speed == '-') {
                wind = '-';
            } else {
                wind = e.wind.dir + '&nbsp;' + e.wind.speed;
            }
        }
        var boats = '';
        var teams = getTeamsData(logBook.race.getRegattaId());
        if (e.teams != undefined) {
            var res = [];
            for (var j = 0; j < e.teams.length; j++) {
                res.push(fmtTeam(e.teams[j], teams, 'success'));
            }
            boats = res.join('<br/>');
        }
        // OBSOLETE
        if (e.boats != undefined) {
            var bres = [];
            for (var k = 0; k < e.boats.length; k++) {
                bres.push(fmtBoat(e.boats[k], teams, 'success'));
            }
            boats = bres.join('<br/>');
        }
        var notes = [];
        var sails = fmtSails(e.sails);
        var other = fmtOther(e);
        if (e.position) {
            notes.push(e.position);
        }
        if (e.interrupt) {
            var interrupt = '';
            if (e._interruptStatus) {
                interrupt += '<span class="log-book-invalid-interrupt ' +
                    'text-danger">';
            }
            if (e.interrupt && e.interrupt.type != 'done') {
                interrupt += 'Avbrott - ';
            }
            interrupt += fmtInterrupt(e.interrupt);
            if (e._interruptStatus) {
                interrupt += '<span class="pl-1 icon-exclamation-circle">' +
                    '</span></span>';
            }
            notes.push(interrupt);
        }
        if (e.protest) {
            var protest = 'Protest mot<br/>' +
                fmtTeam(e.protest.team, teams, 'danger');
            notes.push(protest);
        }
        if (boats) {
            notes.push(boats);
        }
        if (sails != '') {
            notes.push(sails);
        }
        if (other != '') {
            notes.push(other);
        }
        if (e.class == 'AdminLog') {
            var s = '';
            if (e.type == 'adminDist') {
                s += 'Avdrag plakettdistans: ' + e.admin_dist + 'M<br/>';
            } else if (e.type == 'adminTime') {
                s += 'Tidstillägg: ' + e.admin_time + ' minuter<br/>';
            } else if (e.type == 'adminDSQ') {
                s += 'Ogiltig segling<br/> ';
            }
            if (e.comment) {
                s += e.comment;
            }
            notes.push('<em>' + s + '</em>');
        } else if (e.comment) {
            notes.push(e.comment);
        }
        var note = notes.join('<br/>');

        var conflict = '';
        if (e.state == 'conflict') {
            conflict = '<span class="text-danger' +
                ' icon-exclamation-circle"></span>';
        }

        rows += '<tr data-logid="' + e.id + '">';
        if (isReadOnly &&
            !(e.class == 'AdminLog' && hasOfficerRights()) &&
            !hasAdminRights()) {
            // An officer can edit Admin entries, and an admin can edit
            // everything
            rows += '<td></td>';
        } else {
            rows +=
                '<td><a tabindex="0" class="log-book-edit"' +
                ' role="button"' +
                ' data-toggle="popover"' +
                ' data-animation="false"' +
                ' data-trigger="click"' + // FIXME: with "focus", outside clicks
                                          // removes the popup, but the buttons
                                          // don't work :(
                ' data-container="#log-book-entries"' +
                ' data-placement="top"' +
                ' data-viewport="#log-book-entries"' +
                ' data-html="true"' +
                ' data-content="' + edit_button_html + '"' +
                ' data-template="' + popover_template + '"' +
                '><span class="icon-pencil">' + conflict + '</span></a></td>';
        }
        var ts = '';
        if (e.class != 'AdminLog') {
            ts = e.time.format('HH:mm DD MMM').replace(/\s/g, '&nbsp;');
        }
        rows +=
            '<td>' + ts + '</td>' +
            distTD + '<span class="badge badge-pill badge-' + pointColor +
            ' mr-2 align-middle">' +
            point + '</span>' + pointName + '</td>' +
            distTD + distance + distPost + '</td>' +
            '<td class="d-none d-sm-table-cell">' + wind + '</td>' +
            '<td>' + note + '</td>' +
            '</tr>';
    }
    if (!isReadOnly || hasOfficerRights()) {
        // An officer can modify a signed loggbook by adding
        // entries of type 'admin'
        var args = '';
        if (isReadOnly) {
            args = '{type: \'admin\'}';
        }
        rows += '<tr>' +
            '<td><a tabindex="0" class="log-book-add-entry"' +
            ' role="button"' +
            ' onclick="tfUiLogBookAddEntryClick(' + args + ');"' +
            '><span class="icon-plus tf-x-large"></span></a></td>' +
            '</tr>';
    }
    var dist = logBook.getSailedDistance();
    var netdist = logBook.getNetDistance();
    var earlydist = logBook.getEarlyStartDistance();
    var earlytime = logBook.getEarlyStartTime();
    var latedist = logBook.getLateFinishDistance();
    var latetime = logBook.getLateFinishTime();
    var compdist = logBook.getCompensationDistance();
    var admindist = logBook.getAdminDistance();
    var approveddist = logBook.getApprovedDistance();
    var plaquedist = logBook.getPlaqueDistance();
    var speed = logBook.getAverageSpeed();

    if (earlydist > 0) {
        $('#log-book-early-elem').show();
        $('#log-book-approved-elem').show();
    }
    if (latedist > 0) {
        $('#log-book-late-elem').show();
        $('#log-book-approved-elem').show();
    }
    if (compdist > 0) {
        $('#log-book-comp-elem').show();
        $('#log-book-approved-elem').show();
    }
    if (admindist != 0) {
        $('#log-book-admin-dist-elem').show();
    }
    if (logBook.state == 'finished' ||
        logBook.state == 'finished-early' ||
        logBook.state == 'retired') {
        $('#log-book-plaque-elem').show();
    } else {
        $('#log-book-net-elem2').show();
    }

    if (isSkipper(logBook) || hasOfficerRights()) {
        $('#log-book-sign').show();
    } else {
        $('#log-book-sign').hide();
    }
    $('#log-book-sign').removeClass('disabled');
    if (!(logBook.state == 'finished' ||
          logBook.state == 'finished-early' ||
          logBook.state == 'retired') ||
        logBook.hasConflict()) {
        $('#log-book-sign').addClass('disabled');
    }
    $('#log-book-delete-all').show();
    if (isReadOnly) {
        $('#log-book-delete-all').hide();
        $('#log-book-sign').hide();
    }
    $('#log-book-send').hide();
    if (logBook.signed == 'signed') {
        $('#log-book-send').show();
    }

    $('#log-book-plaque-reason').hide();
    if (logBook.state == 'finished-early') {
        $('#log-book-plaque-reason').show();
        $('#log-book-plaque-reason').html('(för kort segling)');
    } else if (logBook.state == 'retired') {
        $('#log-book-plaque-reason').show();
        $('#log-book-plaque-reason').html('(seglingen bruten)');
    }

    if (logBook.standaloneUI) {
        var r = logBook.race.raceData;
        $('#log-book-race').text(r.regatta_name + ' ' +
                                 r.period + '-timmars');
        var startStr = r.start_from.format('YYYY-MM-DD HH:mm');
        if (!r.start_from.isSame(r.start_to)) {
            startStr += r.start_to.format('-HH:mm');
        }
        $('#log-book-start-time').text(startStr);
        $('#log-book-skipper').text(logBook.teamData.skipper_first_name + ' ' +
                                    logBook.teamData.skipper_last_name);
        var sp = pod.getPoint(logBook.teamData.start_point);
        var startPointName = '';
        if (sp) {
            startPointName = sp.name;
        }
        $('#log-book-start-point').text(logBook.teamData.start_point + ' ' +
                                        startPointName);
    }

    $('#log-book-boat').text(boatName);
    $('#log-book-startno').text(startNo);
    $('#log-book-sxk').text(sxk);
    // header
    $('#log-book-sailed-dist').text(dist.toFixed(1) + ' M');
    $('#log-book-net-dist').text(netdist.toFixed(1) + ' M');
    // footer
    $('#log-book-sailed-dist2').text(dist.toFixed(1) + ' M');
    $('#log-book-net-dist2').text(netdist.toFixed(1) + ' M');
    $('#log-book-early-dist').text(earlydist.toFixed(1) + ' M' +
                                  ' (' + earlytime + ' min)');
    $('#log-book-late-dist').text(latedist.toFixed(1) + ' M' +
                                  ' (' + latetime + ' min)');
    $('#log-book-comp-dist').text(compdist.toFixed(1) + ' M');
    $('#log-book-approved-dist').text(approveddist.toFixed(1) + ' M');
    $('#log-book-admin-dist').text(admindist.toFixed(1) + ' M');
    $('#log-book-plaque-dist').text(plaquedist.toFixed(1) + ' M');
    $('#log-book-speed').text(speed.toFixed(1) + ' kn');
    $('#log-book-entries').html(rows);
    $('.log-book-edit').popover();
    $('.log-book-invalid-dist').off(); // remove all handlers
    $('.log-book-invalid-dist').on('click', function(event) {
        logBookInvalidDistClick(event.currentTarget);
    });
    $('.log-book-invalid-interrupt').off(); // remove all handlers
    $('.log-book-invalid-interrupt').on('click', function(event) {
        logBookInvalidInterruptClick(event.currentTarget);
    });
    if (options.scroll) {
        window.setTimeout(function() {
            $('#log-book-footer')[0].scrollIntoView();
        }, 1);
    }
    var logBookPage = $('#log-book-page')[0];
    // save the current logBook in the page
    logBookPage.logBook = logBook;
};

window.tfUiLogBookAddEntryClick = function(r) {
    var logBookPage = $('#log-book-page')[0];
    var e = logBookPage.logBook.getLastLogEntry();
    var time = null;
    if (e) {
        time = e.time;
    }
    if (r && r.type == 'admin') {
        openAddLogEntryPage({
            type: 'admin',
            logBook: logBookPage.logBook,
            onclose: function() {
                refreshLogBook({logBook: logBookPage.logBook,
                                scroll: true});
            }
        });
    } else if (r && r.type == 'round') {
        openLogEntry({
            logBook: logBookPage.logBook,
            time: time,
            onclose: function() {
                refreshLogBook({logBook: logBookPage.logBook,
                                scroll: true});
            },
            type: r.type,
            data: r.data
        });
    } else {
        openAddLogEntryPage({
            type: 'team',
            logBook: logBookPage.logBook,
            onclose: function() {
                refreshLogBook({logBook: logBookPage.logBook,
                                scroll: true});
            },
            time: time
        });
    }
};

function logBookInvalidDistClick(col) {
    var logBookPage = $('#log-book-page')[0];
    var text = '';
    var logBook = logBookPage.logBook;
    var e = logBook.getLogEntry(col.parentElement.dataset.logid);
    switch (e._legStatus) {
    case 'invalid-round':
        text = 'Punkt ' + e.point +
            ' har rundats mer än två gånger. ' +
            'Sträckan räknas därför inte (se 7.3, 13.1.3 i RR-2018)';
        break;
    case 'invalid-leg':
        text = 'Sträckan ' + e._invalidLeg +
            ' har seglats mer än två gånger. ' +
            'Sträckan räknas därför inte (se 7.5, 13.1.2 i RR-2018)';
        break;
    case 'no-leg':
        text = 'Mellan ' + e._invalidLeg + ' och ' + e.point +
            ' finns ingen giltig sträcka.';
        break;
    }
    alert('<p>' + text + '</p>');
};

function logBookInvalidInterruptClick(span) {
    var logBookPage = $('#log-book-page')[0];
    var logBook = logBookPage.logBook;
    var e = logBook.getLogEntry(span.parentElement.parentElement.dataset.logid);
    var text = '';
    switch (e._interruptStatus) {
    case 'no-done':
        text = 'Du verkar ha glömt att logga att seglingen har ' +
            'återupptagits.';
        break;
    }
    alert('<p>' + text + '</p>');
};

function openLogEntryFromPage(options) {
    var logBookPage = $('#log-book-page')[0];
    options.logBook = logBookPage.logBook;
    options.onclose = function() {
        refreshLogBook({logBook: logBookPage.logBook,
                        scroll: true});
    };
    openLogEntry(options);
};

/**
 * Set up handlers for buttons and form input.
 */
$(document).ready(function() {
    $('[data-toggle="popover"]').popover();
    $('#log-book-cancel').on('click', function() {
        popPage();
        return false;
    });

    $('#log-book-delete-all').on('click', function() {
        confirm('<p>Är du säker att du vill radera hela loggboken?' +
                '</p>',
                'Nej',
                'Ja',
                function() {
                    var logBookPage = $('#log-book-page')[0];
                    var logBook = logBookPage.logBook;
                    logBook.deleteAllLogEntries();
                    refreshLogBook({
                        logBook: logBookPage.logBook});
                });
        return false;
    });
    $('#log-book-sign').on('click', function() {
        var logBookPage = $('#log-book-page')[0];
        var logBook = logBookPage.logBook;
        if (!(logBook.state == 'finished' ||
              logBook.state == 'finished-early' ||
              logBook.state == 'retired')) {
            alert('<p>För att kunna signera loggboken måste du ha' +
                  ' loggat målgång på den sista rundningen, eller loggat att' +
                  ' du har brutit seglingen.</p>');
        } else if (logBook.hasConflict()) {
            alert('<p>Loggboken har ändringar gjorda av någon annan.' +
                  ' Dessa måste lösas genom att klicka på pennan' +
                  ' vid den markerade raden och välja Ändra.</p>');
        } else {
            confirm('<p>Kontrollera noggrant att loggboken är korrekt' +
                    ' ifylld.</p>' +
                    '<p>När loggboken är signerad går det inte att' +
                    ' göra fler ändringar.</p>' +
                    '<p>Är du säker på att du vill signera' +
                    ' loggboken?</p>',
                    'Avbryt',
                    'Signera',
                    function() {
                        logBook.sign();
                        logBook.sendToServer(function(result) {
                            if (result) {
                                alert('<p>Loggboken är nu signerad och' +
                                      ' inskickad.</p>',
                                      function() {
                                          refreshLogBook({
                                              logBook: logBook
                                          });
                                      });
                            }
                            refreshLogBook({
                                logBook: logBook
                            });
                        });
                    });
        }
    });
    $('#log-book-send').on('click', function() {
        var logBookPage = $('#log-book-page')[0];
        var logBook = logBookPage.logBook;
        logBook.sendToServer(function() {
            refreshLogBook({
                logBook: logBook
            });
        });
    });
    $(document).on('click', '#log-book-btn-edit', function(event) {
        var id = $(event.currentTarget.parentElement).data('logid');
        $('.log-book-edit').popover('hide');
        openLogEntryFromPage({id: id});
    });
    $(document).on('click', '#log-book-btn-add', function(event) {
        var id = $(event.currentTarget.parentElement).data('logid');
        var logBookPage = $('#log-book-page')[0];
        var logBook = logBookPage.logBook;
        var cur = logBook.getLogEntry(id);
        var next = logBook.getNextLogEntry(id);
        var addSeconds;
        var nextId;
        if (next) {
            addSeconds = next.time.diff(cur.time) / 2000;
            nextId = next.id;
        } else {
            addSeconds = 3600;
        }
        var new_ = moment(cur.time).add(addSeconds, 'seconds');
        $('.log-book-edit').popover('hide');
        openAddLogEntryPage({
            logBook: logBook,
            time: new_,
            beforeId: nextId,
            onclose: function() {
                refreshLogBook({logBook: logBookPage.logBook,
                                scroll: true});
            }
        });
    });
    $(document).on('click', '#log-book-btn-del', function(event) {
        // delete the log entry
        var id = $(event.currentTarget.parentElement).data('logid');
        var logBookPage = $('#log-book-page')[0];
        logBookPage.logBook.deleteLogEntry(id);
        // re-open the log book
        $('.log-book-edit').popover('hide');
        refreshLogBook({logBook: logBookPage.logBook,
                        scroll: true});
    });
});

// initialize a complete UI for filling in the logbook
export function initLogbookUI(url, email, token, raceId, personId, teamId) {
    setServerURL(url);
    var props = {
        email: email,
        token: token,
        personId: personId,
        activeRaceId: raceId,
        pollInterval: 0
    };
    setSettings(props);

    $('#map').hide();
    $('#tf-spinner').removeClass('tf-spinner-hide');
    var r = {};
    setupLogin()
        .catch(function(error) {
            alert('<p>Kunde inte logga in, vilket tyder på att något ' +
                  'har gått fel!</p>' +
                  '<p>Fel: ' + error + '</p>' +
                  '<p>Kontakta arrangören.</p>');
            throw 'handled';
        })
        .then(function() {
            // get the race data for this race
            return getRaceP(raceId);
        })
        .then(function(raceData) {
            // get all teams in this regatta
            r['raceData'] = raceData;
            return getRegattaTeamsP(raceData.regatta_id);
        })
        .then(function() {
            // get current logbook for this team
            return getTeamLogP(teamId);
        })
        .then(function(log) {
            var tmpPod = curState.defaultPod;
            var curRegatta = new Regatta(r.raceData.regatta_id,
                                         r.raceData.regatta_name,
                                         [], tmpPod);
            var curRace = new Race(curRegatta, r.raceData);
            // get our team data from app storage
            var teamData = getTeamData(r.raceData.regatta_id, teamId);
            var curLogBook = new LogBook(teamData, curRace, [], false);
            curLogBook.addLogFromServer(log);
            curLogBook.standaloneUI = true;
            curLogBook.onLogUpdate(function(logBook, reason) {
                // communicate with server if the logBook has changed,
                // but not if the update was triggered by server communication!
                if (reason != 'syncError' && reason != 'syncDone') {
                    logBook.sendToServer(function() {});
                }
            }, 120);
            $('#tf-spinner').hide();
            openLogBook({
                mainPage: true,
                logBook: curLogBook
            });
        })
        .catch(function(error) {
            $('#tf-spinner').hide();
            if (error != 'handled') {
                alert('<p>Kunde inte hämta data från servern.</p>' +
                      '<p>Fel: ' + error + '</p>' +
                      '<p>Kontakta arrangören.</p>');
            }
        });
};

function hasOfficerRights() {
    return isOfficerRights(getSetting('role'));
};

function hasAdminRights() {
    return isAdminRights(getSetting('role'));
};
