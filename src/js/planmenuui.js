/* -*- js -*- */

goog.provide('tf.ui.planMenu');

goog.require('tf.ui');

tf.ui.planMenu.openPage = function() {

    // mark the active plan
    $('.tf-plan-item').removeClass('active');
    $('#tf-plan-plan').removeClass('disabled');
    var activeId;
    var curPlan = tf.state.curPlan.get();
    if (!curPlan) {
        $('#tf-plan-plan').addClass('disabled');
        activeId = '#tf-plan-item-none';
    } else {
        activeId = '#tf-plan-item-' + curPlan.name;
    }
    $(activeId).addClass('active');

    tf.ui.pushPage(
        function() { $('#plan-menu-page').modal({backdrop: 'static'}); },
        function() { $('#plan-menu-page').modal('hide'); });
    document.activeElement.blur();
};

/**
 * Set up handlers for buttons and form input.
 */
$(document).ready(function() {
    $('.tf-plan-item').on('click', function(event) {
        var name = $(event.target).data('name'); // html5 data-name attribute
        var plan = null;
        if (name == 'none') {
            $('#tf-plan-plan').addClass('disabled');
            tf.state.curPlan.set(null);
        } else {
            $('#tf-plan-plan').removeClass('disabled');
            plan = tf.state.curRace.getPlan(name);
            tf.state.curPlan.set(plan);
            if (!plan.logbook) {
                plan.attachLogBook(tf.state.curLogBook);
                // add a function that checks if the plan no longer matches
                // the logbook, and the plan is current, then we no longer
                // use the plan as current.
                plan.onPlanUpdate(function(plan, how) {
                    if (how == 'nomatch') {
                        if (tf.state.curPlan.get().name == plan.name) {
                            tf.state.curPlan.set(null);
                        }
                    }
                });
                plan.onPlanUpdate(tf.ui.logBookChanged);
            }
        }
        $('.tf-plan-item').removeClass('active');
        if (!plan) {
            activeId = '#tf-plan-item-none';
        } else {
            activeId = '#tf-plan-item-' + plan.name;
        }
        $(activeId).addClass('active');

        tf.ui.planModeActivate();
        return false;
    });

    $('#tf-plan-normal').on('click', function(event) {
        tf.ui.planModeActivate(false);
        tf.ui.popPage();
        return false;
    });

    $('#tf-plan-plan').on('click', function(event) {
        if (!tf.state.curPlan.get()) {
            tf.ui.alert('<p>Du måste välja en plan innan du kan ' +
                        'gå in i planeringsläget.</p>');
            return false;
        }
        tf.ui.planModeActivate(true);
        tf.ui.popPage();
        return false;
    });

});
