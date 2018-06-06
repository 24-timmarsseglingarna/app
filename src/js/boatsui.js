/* -*- js -*- */

goog.provide('tf.ui.boats');

goog.require('tf.ui');
goog.require('tf.ui.alert');

tf.ui.boats.openPage = function(options) {
    var regatta = options.regatta;

    $('#boats-page-name').text(regatta.getName());

    var fontclass = '';
    switch (tf.state.fontSize.get()) {
    case 'small':
        fontclass = 'tf-normal';
        break;
    case 'normal':
        fontclass = 'tf-large';
        break;
    case 'large':
        fontclass = 'tf-x-large';
        break;
    case 'x-large':
        fontclass = 'tf-xx-large';
        break;
    }

    tf.ui.boats._fillStartList(regatta, fontclass);

    tf.ui.boats._fillLeaderBoard(regatta, fontclass);

    if (options.adminView) {
        tf.ui.boats._fillResult(regatta, fontclass);
    } else {
        $('#boats-result-tab').hide();
    }

    var page = $('#boats-page')[0];
    page.tfOptions = options || {};
    tf.ui.pushPage(function() { $('#boats-page').modal({backdrop: 'static'}); },
                   function() { $('#boats-page').modal('hide'); });
    document.activeElement.blur();
};

tf.ui.boats._fillStartList = function(regatta, fontclass) {
    var races = tf.serverData.getRacesData(regatta.getId());
    races.sort(function(a, b) {
        if (a.start_from.isBefore(b.start_from)) {
            return -1;
        } else if (a.start_from.isSame(b.start_from)) {
            return 0;
        } else {
            return 1;
        }
    });
    var teams = tf.serverData.getTeamsData(regatta.getId());

    var html = '';

    for (var i = 0; i < races.length; i++) {
        var r = races[i];
        // check if there are any teams in this race; if not, don't show it
        var found = false;
        for (var j = 0; !found && j < teams.length; j++) {
            if (teams[j].race_id == r.id) {
                found = true;
            }
        }
        if (!found) {
            continue;
        }
        var padding = '';
        if (i > 0) {
            padding = ' pt-4';
        }
        html += '<div class="row' + padding + '"><div>' +
            '<div class="' + fontclass + '"><b>' + r.period + '-timmars';
        if (r.description) {
            html += ' ' + r.description;
        }
        html += '</b></div>';
        var startDateFrom = r.start_from.format('YYYY-MM-DD');
        var startTimeFrom = r.start_from.format('HH:mm');
        var startDateTo = r.start_to.format('YYYY-MM-DD');
        var startTimeTo = r.start_to.format('HH:mm');
        html +=
            '<p class="font-italic">Starttid: ' +
            startDateFrom + ' ' + startTimeFrom;
        if (startDateTo != startDateFrom) {
            html += ' - ' + startDateTo + ' ' + startTimeTo;
        } else if (startTimeTo != startTimeFrom) {
            html += ' - ' + startTimeTo;
        }
        html += '</p></div></div>';

        html += '<div class="table-responsive row">' +
            '<table class="table table-sm">' +
            '<colgroup>' +
            '<col class="tf-col-1"></col>' +
            '<col class="tf-col-4"></col>' +
            '<col class="tf-col-4"></col>' +
            '<col class="tf-col-2"></col>' +
            '<col class="tf-col-1"></col>' +
            '</colgroup>' +

            '<thead>' +
            '<tr>' +
            '<th>Nr</th>' +
            '<th>Båtnamm</th>' +
            '<th>Båttyp</th>' +
            '<th>Segelnr</th>' +
            '<th>SXK-tal</th>' +
            '</tr>' +
            '</thead>' +
            '<tbody>';

        var startPoints = {};
        for (var j = 0; j < teams.length; j++) {
            var t = teams[j];
            if (t.race_id != r.id) {
                continue;
            }
            if (t.start_point in startPoints) {
                startPoints[t.start_point].push(t);
            } else {
                startPoints[t.start_point] = [t];
            }
        }
        var points = Object.keys(startPoints).sort();
        for (var j = 0; j < points.length; j++) {
            var p = points[j];
            var ts = startPoints[p].sort(function(a, b) {
                return Number(a.start_number) - Number(b.start_number);
            });
            var point = regatta.getPod().getPoint(p);
            var name = '';
            if (point) {
                name = ' - ' + point.name;
            }
            html += '<tr><th class="font-italic" scope="row" colspan="5">' +
                'Startpunkt ' + p + name + '</th></tr>';
            for (var k = 0; k < ts.length; k++) {
                var t = ts[k];
                html += '<tr><td>' + t.start_number + '</td>' +
                    '<td>' + t.boat_name + '</td>' +
                    '<td>' + t.boat_type_name + '</td>' +
                    '<td>' + (t.boat_sail_number || '-') + '</td>' +
                    '<td>' + t.sxk_handicap + '</td></tr>';
            }
        }
        html += '</tbody></table></div>';
    }
    $('#boats-start').html(html);
};

tf.ui.boats._fillLeaderBoard = function(regatta, fontclass) {
    var html = '';

    var pod = regatta.getPod();
    var leaderboard = regatta.getLeaderBoard();
    leaderboard.sort(function(a, b) { return b.netdist - a.netdist; });
    var updated = regatta.getLeaderBoardUpdatedTime();
    // clear 'updated' flag in the regatta in order to mark
    // that we've seen it.
    regatta.log_updated = false;
    $('#tf-nav-boats-badge').hide(); // and immediately hide the info badge
    for (var i = 0; i < leaderboard.length; i++) {
        var e = leaderboard[i];
        var logbook = e.logbook;

        var last = logbook.getLastPointAndTime();
        var lastPoint = '';
        var lastPointName = '';
        var lastTime = '';
        if (last) {
            lastPoint = last.point;
            var p = pod.getPoint(lastPoint);
            if (p) {
                lastPointName = p.name;
            }
            lastTime = last.time.format("HH:mm");
        }

        html += '<tr>' +
            '<td>' + e.netdist.toFixed(1) + '</td>' +
            '<td>' + lastPoint + ' <i>' + lastPointName + '</i></td>' +
            '<td>' + lastTime + '</td>' +
            '<td>' + logbook.teamData.boat_name + '</td>' +
            '<td>' + logbook.teamData.boat_type_name + '</td>' +
//            '<td>' + (logbook.teamData.boat_sail_number || '-') + '</td>' +
            '</tr>';
    }

    if (updated) {
        $('#boats-lb-updated').html(updated.format('YYYY-MM-DD HH:mm:ss'));
    }
    $('#boats-lb-tbody').html(html);
};

tf.ui.boats._fillResult = function(regatta, fontclass) {
    var html = '';

    var result = regatta.getResult();
    result.sort(function(a, b) {
        if (a.plaquedist == 0 && b.plaquedist == 0) {
            if (a.logbook.signed && !b.logbook.signed) {
                return -1;
            }
            if (!a.logbook.signed && b.logbook.signed) {
                return 1;
            }
            if (a.logbook.log.length > 0 && b.logbook.log.length == 0) {
                return -1;
            }
            if (a.logbook.log.length == 0 && b.logbook.log.length > 0) {
                return 1;
            }
            return a.logbook.teamData.start_number -
                b.logbook.teamData.start_number;
        } else {
            return b.plaquedist - a.plaquedist;
        }
    });

    $('#tf-nav-boats-badge').hide(); // and immediately hide the info badge
    tf.ui.boats._regatta = regatta;
    for (var i = 0; i < result.length; i++) {
        var e = result[i];
        var logbook = e.logbook;

        var status = '';
        var color = '';

/*
        if (logbook.signed) {
            color = 'bg-success'; // green
            status = 'klar';
        } else {
            status = 'inte signerad';
            color = 'bg-warning'; // yellow
        }

        switch (logbook.state) {
        case 'finished':
            status = '';
            break;
        case 'finished-early':
        case 'retired':
            status = 'DNF';
            break;
        default:
            color = 'bg-danger';
            status = 'ofullständig';
        }
*/
        if (logbook.signed) {
            switch (logbook.state) {
            case 'finished':
                status = 'OK';
                break;
            case 'finished-early':
            case 'retired':
                status = 'DNF';
                break;
            }
        } else if (logbook.log.length == 0) {
            status = 'Saknar loggbok';
        } else {
            switch (logbook.state) {
            case 'finished':
                status = 'Osignerad';
                break;
            case 'finished-early':
            case 'retired':
                status = 'DNF - osignerad';
                break;
            default:
                status = 'Ofullständig';
            }
        }

        html += '<tr onclick="tf.ui.boats.select(' + logbook.teamData.id +
            ')">' +
            '<td class="' + color + '">' + status + '</td>' +
            '<td>' + e.plaquedist.toFixed(1) + '</td>' +
            '<td>' + logbook.getNetDistance().toFixed(1) + '</td>' +
            '<td>' + logbook.teamData.start_number + '</td>' +
            '<td>' + logbook.teamData.boat_name + '</td>' +
            '<td>' + logbook.teamData.boat_type_name + '</td>' +
            '</tr>';
    }

    $('#boats-result-tbody').html(html);
};

tf.ui.boats.select = function(teamId) {
    var logbook = tf.ui.boats._regatta.getTeamLogbook(teamId);
    tf.state.curLogBook = logbook;
    tf.ui.updateAll();
    tf.ui.popPage();

/*
    tf.ui.logBook.openLogBook({
        logBook: logbook
    });
*/
    return false;
};





/* compare w/ pdf startlist
   sort on period, startpoint, startnumber

   print period, startpoint, startnumber, boatname, boattype, sail number

   tap (i) symbol to get skippers name and number, and same for team members.

   ---

   leaderboard


   ---

   first select layout: startlist / leaderboard / boatlist

   different layouts:

   Period/Race  <period>-timmars[ <description>]
     Startpoint
       Startnumber Boatname  BoatType Sailnumber SXK-tal
       Startnumber Boatname  BoatType Sailnumber SXK-tal
       Startnumber Boatname  BoatType Sailnumber SXK-tal
     Startpoint
       Startnumber Boatname  BoatType Sailnumber SXK-tal
       Startnumber Boatname  BoatType Sailnumber SXK-tal
       Startnumber Boatname  BoatType Sailnumber SXK-tal

   Period/Race
     Startpoint
       Startnumber Boatname  BoatType Sailnumber SXK-tal
       Startnumber Boatname  BoatType Sailnumber SXK-tal
       Startnumber Boatname  BoatType Sailnumber SXK-tal

   maybe option to view only one specific race?  all/72/48/24skutor/24/12

   tap row or (i) to get more info.  maybe don't print start/sail
   number on small screen?


   Another layout - this one should be sortable on all columns

   Startnumber Boatname BoatType Sailnumber SXK-tal Startpoint Race
   Startnumber Boatname BoatType Sailnumber SXK-tal Startpoint Race
   Startnumber Boatname BoatType Sailnumber SXK-tal Startpoint Race
   Startnumber Boatname BoatType Sailnumber SXK-tal Startpoint Race
   Startnumber Boatname BoatType Sailnumber SXK-tal Startpoint Race



   Leaderboard:

   Period/Race
     Distance Startnumber Boatname  BoatType Sailnumber SXK-tal Startpoint
     Distance Startnumber Boatname  BoatType Sailnumber SXK-tal Startpoint
     Distance Startnumber Boatname  BoatType Sailnumber SXK-tal Startpoint
     Distance Startnumber Boatname  BoatType Sailnumber SXK-tal Startpoint



*/
