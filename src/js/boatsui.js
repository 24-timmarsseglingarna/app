/* -*- js -*- */

goog.provide('tf.ui.boats');

goog.require('tf.ui');
goog.require('tf.ui.alert');

tf.ui.boats.openPage = function(options) {
    var race = options.race;

    $('#boats-page-name').text(race.raceData.regatta_name);

/*
    var teams = tf.serverData.getTeamsData(race.getRegattaId());
    teams.sort(function(a, b) {
        return Number(a.start_number) - Number(b.start_number);
    });
    boatsOptions = '';
    for (var i = 0; teams && i < teams.length; i++) {
        var sn = teams[i].start_number;
        var bn = teams[i].boat_name;
        var bcn = teams[i].boat_type_name;
        var bsn = teams[i].boat_sail_number;
        boatsOptions +=
            '<option value="' + sn + '">' +
            sn + ' - ' + bn + ', ' + bcn;
        if (bsn) {
            boatsOptions += ', ' + bsn;
        }
        boatsOptions += '</option>';
    }
    return boatsOptions;
*/

    var page = $('#boats-page')[0];
    page.tfOptions = options || {};
    tf.ui.pushPage(function() {
        page.close();
    });
    page.showModal();
    document.activeElement.blur();
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
