/* -*- js -*- */

import assert from "node:assert";
import moment from "moment";

import {Plan} from "../src/js/plan.js";
import {LogBook} from "../src/js/logbook.js";
import {mkPod, mkLogBook} from "./misc.js";

/*
describe.skip("_playground", function () {
    it("test", function() {
        assert(mkLogBook().getRace().getPod());
    });
});
*/

describe("Plan w/o logbook", function () {
    let pod;
    before(function() {
        pod = mkPod();
    });
    describe("empty plan", function () {
        let plan;
        before(function() {
            plan = new Plan("test", pod);
        });
        describe("#isPointPlanned", function() {
            it("should return false", function() {
                assert.equal(plan.isPointPlanned("1"), false);
            });
        });
        describe("#isLegPlanned", function() {
            it("should return false", function() {
                assert.equal(plan.isLegPlanned("1", "2"), false);
            });
        });
        describe("#getLastPoint", function() {
            it("should return null", function() {
                assert.equal(plan.getLastPoint(), null);
            });
        });
    });
    describe("single point", function() {
        let plan;
        before(function() {
            plan = new Plan("test", pod);
            plan.addPoint("1");
        });
        describe("#isPointPlanned", function() {
            it("check for planned point should return true", function() {
                assert.equal(plan.isPointPlanned("1"), true);
            });
            it("check for unplanned point should return true", function() {
                assert.equal(plan.isPointPlanned("2"), false);
            });
        });
        describe("#isLegPlanned", function() {
            it("should return false", function() {
                assert.equal(plan.isLegPlanned("1", "1"), false);
            });
        });
        describe("#getLastPoint", function() {
            it("should return 1", function() {
                assert.equal(plan.getLastPoint(), "1");
            });
        });
    });
    describe("two points", function() {
        before(function() {
            var plan = new Plan("test", pod);
            plan.addPoint("1");
            plan.addPoint("2");
            this.plan = plan;
        });
        chkTwoPoints();
    });
    describe("auto-find short leg after delpoint", function() {
        let plan;
        before(function() {
            plan = new Plan("test", pod);
            plan.addPoint("1");
            plan.addPoint("2");
            plan.addPoint("3");
            plan.addPoint("4");
            plan.delPoint("3");
        });
        describe("#isLegPlanned", function() {
            it("should return true", function() {
                assert.equal(plan.isLegPlanned("2", "4"), true);
            });
        });
        describe("#getPlannedDistance", function() {
            it("should return distance 15", function() {
                assert.equal(plan.getPlannedDistance(), 15);
            });
        });
    });
    describe("two points with deletions 1", function() {
        before(function() {
            var plan = new Plan("test", pod);
            plan.addPoint("1");
            plan.addPoint("2");
            plan.addPoint("3");
            plan.addPoint("4");
            plan.delPoint("3");
            plan.delPoint("4");
            this.plan = plan;
        });
        chkTwoPoints();

    });
    describe("two points with del tail", function() {
        before(function() {
            var plan = new Plan("test", pod);
            plan.addPoint("1");
            plan.addPoint("2");
            plan.addPoint("3");
            plan.addPoint("4");
            plan.delTail("2");
            this.plan = plan;
        });
        chkTwoPoints();
    });
    describe("more points", function() {
        let plan;
        before(function() {
            plan = new Plan("test", pod);
            plan.addPoint("1");
            plan.addPoint("2");
            plan.addPoint("4");
            plan.addPoint("2");
            plan.addPoint("3");
            plan.addPoint("4");
            plan.addPoint("5");
        });
        describe("#getPlannedRoundings", function() {
            it("should return two roundings for point 2", function() {
                assert.equal(plan.getPlannedRoundings("2").length, 2);
            });
        });
    });
    describe("auto-find route", function() {
        describe("1 to 8", function() {
            let plan;
            before(function() {
                plan = new Plan("test", pod);
                plan.addPoint("1");
                plan.addPoint("8");
            });
            describe("#isLegPlanned", function() {
                it("should return true", function() {
                    assert.equal(plan.isLegPlanned("1", "5"), true);
                });
            });
            describe("#getPlannedDistance", function() {
                it("should return distance 125", function() {
                    assert.equal(plan.getPlannedDistance(), 125);
                });
            });
        });
        describe("1 to 5 - direct leg", function() {
            let plan;
            before(function() {
                plan = new Plan("test", pod);
                plan.addPoint("1");
                plan.addPoint("5");
            });
            describe("#isLegPlanned", function() {
                it("should return false", function() {
                    assert.equal(plan.isLegPlanned("1", "2"), false);
                });
            });
            describe("#getPlannedDistance", function() {
                it("should return distance 65", function() {
                    assert.equal(plan.getPlannedDistance(), 65);
                });
            });
        });

    });
});


describe("Incomplete plan w/ logbook", function () {
    let plan;

    before(function() {
        var logbook = mkLogBook();
        var pod = logbook.getRace().getPod();
        plan = new Plan("test", pod, logbook);
        plan.addPoint("3");
        plan.addPoint("4");
    });

    describe("two points", function() {
        describe("#getPlannedDistance", function() {
            it("should return distance 5", function() {
                assert.equal(plan.getPlannedDistance(), 25);
            });
        });
/*
  FIXME: should we fix so that getRequiredSpeed() only returns if we have a complete
  plan, i.e., where first == last OR last == race.endpoint?
        describe("#getRequiredSpeed", function() {
            it("should return -1", function() {
                assert.equal(plan.getRequiredSpeed(), -1);
            });
        });
*/
    });
});

describe("#rePlan", function () {
    const plans = mk110Plans();

    plans.forEach((plan) => {
        it("entries should be correct", function () {
            assert.equal(plan.entries.length, 6);
            assert.equal(plan.getPlannedDistance(), 110);
        });
    });

});

function mk110Plans(logbook) {
    if (!logbook) {
        logbook = mkLogBook();
    }
    var pod = logbook.getRace().getPod();
    var plans = [];
    var plan;

    // straight-forward plan [1-2]-3-4-5-1
    plan = new Plan("test", pod, logbook);
    plan.addPoint("3");
    plan.addPoint("4");
    plan.addPoint("5");
    plan.addPoint("1");
    plans.push(plan);

    // plan [1-2]-3-9-4-5-1 and then remove 9
    plan = new Plan("test", pod, logbook);
    plan.addPoint("3");
    plan.addPoint("9");
    plan.addPoint("4");
    plan.addPoint("5");
    plan.addPoint("1");
    plan.delPoint("9");
    plans.push(plan);

    // plan [1-2]-3-9-4-5-1 and then remove 4, rePlan 9 -> 4
    plan = new Plan("test", pod, logbook);
    plan.addPoint("3");
    plan.addPoint("9");
    plan.addPoint("5");
    plan.addPoint("1");
    plan.rePlan("9", "4");
    plans.push(plan);

    // plan [1-2]-3-9-4-5-1 and then remove 4, rePlan 9 -> 4
    plan = new Plan("test", pod, logbook);
    plan.addPoint("3");
    plan.addPoint("9");
    plan.addPoint("4");
    plan.addPoint("5");
    plan.addPoint("1");
    plan.delPoint("4");
    plan.rePlan("9", "4");
    plans.push(plan);

    // plan 1-2-3-4-5-1, then attach logbook w/ [1-2]
    plan = new Plan("test", pod);
    plan.addPoint("1");
    plan.addPoint("2");
    plan.addPoint("3");
    plan.addPoint("4");
    plan.addPoint("5");
    plan.addPoint("1");
    plan.attachLogBook(logbook);
    plans.push(plan);

    return plans;
};

function mkPlansWithPlannedSpeed(logbook) {
    if (!logbook) {
        logbook = mkLogBook();
    }
    var pod = logbook.getRace().getPod();
    var plans = [];
    var plan;

    // straight-forward plan [1-2]-3-4-5-1
    plan = new Plan("test", pod, logbook);
    plan.addPoint("3");
    plan.addPoint("4");
    plan.addPoint("5");
    plan.setPlannedSpeed(plan.entries.length - 1, 10);
    plan.addPoint("1");
    plan.__TEST__EXPECT_REQ_SPEED = 4.5;
    plans.push(plan);

    plan = new Plan("test", pod, logbook);
    plan.addPoint("3");
    plan.addPoint("4");
    plan.setPlannedSpeed(plan.entries.length - 1, 10);
    plan.setPlannedSpeed(plan.entries.length - 1, undefined);
    plan.addPoint("5");
    plan.setPlannedSpeed(plan.entries.length - 1, 10);
    plan.addPoint("1");
    plan.__TEST__EXPECT_REQ_SPEED = 4.5;
    plans.push(plan);

    plan = new Plan("test", pod, logbook);
    plan.addPoint("3");
    plan.setPlannedSpeed(plan.entries.length - 1, 3);
    plan.addPoint("4");
    plan.setPlannedSpeed(plan.entries.length - 1, 3);
    plan.addPoint("5");
    plan.setPlannedSpeed(plan.entries.length - 1, 3);
    plan.addPoint("1");
    plans.push(plan);

    return plans
};

function mkPlansWithPlannedSpeedNotInTime(logbook) {
    if (!logbook) {
        logbook = mkLogBook();
    }
    var pod = logbook.getRace().getPod();
    var plans = [];
    var plan;

    plan = new Plan("test", pod, logbook);
    plan.addPoint("3");
    plan.setPlannedSpeed(plan.entries.length - 1, 1);
    plan.addPoint("4");
    plan.setPlannedSpeed(plan.entries.length - 1, 1);
    plan.addPoint("5");
    plan.setPlannedSpeed(plan.entries.length - 1, 1);
    plan.addPoint("1");
    plans.push(plan);

    return plans
};



describe("Complete plan w/ logbook", function () {
    const logbook = mkLogBook();
    const start = logbook.getStartTime();
    const plans = mk110Plans(logbook);
    const plansWithPlannedSpeed = mkPlansWithPlannedSpeed(logbook);
    const plansWithPlannedSpeedNotInTime = mkPlansWithPlannedSpeedNotInTime(logbook);


    describe("#getPlannedDistance", function() {
        plans.forEach((plan) => {
            it("should return distance 110", function() {
                assert.equal(plan.getPlannedDistance(), 110);
            });
        });
    });

    describe("#getRaceLeftMinutes", function() {
        plans.forEach((plan) => {
            it("should return 22 * 60", function() {
                assert.equal(plan.getRaceLeftMinutes(), 22*60);
            });
        });
    });
    describe("#getRequiredSpeed", function() {
        plans.forEach((plan) => {
            it("should return 5 knots", function() {
                assert.equal(plan.getRequiredSpeed(), 5);
            });
        });
    });
    describe("entries", function() {
        plans.forEach((plan) => {
            it("should have proper eta", function() {
                assert.equal(plan.entries[2].eta.diff(start, 'hours'), 6);
                assert.equal(plan.entries[3].eta.diff(start, 'hours'), 12);
                assert.equal(plan.entries[4].eta.diff(start, 'hours'), 20);
                assert.equal(plan.entries[5].eta.diff(start, 'hours'), 46);
            });
            it("should have proper rta", function() {
                assert.equal(plan.entries[2].rta.diff(start, 'hours'), 4);
                assert.equal(plan.entries[3].rta.diff(start, 'hours'), 7);
                assert.equal(plan.entries[4].rta.diff(start, 'hours'), 11);
                assert.equal(plan.entries[5].rta.diff(start, 'hours'), 24);
            });
            it("should have proper rs", function() {
                assert.equal(plan.entries[2].rs, 5);
                assert.equal(plan.entries[3].rs, 5);
                assert.equal(plan.entries[4].rs, 5);
                assert.equal(plan.entries[5].rs, 5);
            });
        });
    });
    describe("planned speed", function() {
        plansWithPlannedSpeed.forEach((plan) => {
            it("should have proper rta", function() {
                assert.equal(plan.entries[5].rta.diff(start, 'hours'), 24);
            });
            it("should have proper rs", function() {
                assert.equal(plan.entries[2].rs,
                             plan.entries[2].plannedSpeed || plan.__TEST__EXPECT_REQ_SPEED);
                assert.equal(plan.entries[3].rs,
                             plan.entries[3].plannedSpeed || plan.__TEST__EXPECT_REQ_SPEED);
                assert.equal(plan.entries[4].rs,
                             plan.entries[4].plannedSpeed || plan.__TEST__EXPECT_REQ_SPEED);
                if (plan.__TEST__EXPECT_REQ_SPEED) {
                    assert.equal(plan.entries[5].rs, plan.__TEST__EXPECT_REQ_SPEED);
                }
            });
        });
    });
    describe("not in time", function() {
        plansWithPlannedSpeedNotInTime.forEach((plan) => {
            it("should not have proper rta", function() {
                assert.equal(plan.entries[5].rta, undefined);
            });
        });
    });
});

describe("Complete plan w/o logbook", function () {
    let plan;
    before(function() {
        var pod = mkPod();
        plan = new Plan("test", pod, undefined, [], 24, moment("2025-04-01T12:00:00"));
        plan.addPoint("1");
        plan.addPoint("2");
        plan.addPoint("3");
        plan.addPoint("4");
        plan.addPoint("5");
        plan.addPoint("1");
    });

    describe("#getPlannedDistance", function() {
        it("should return distance 115", function() {
            assert.equal(plan.getPlannedDistance(), 115);
        });
    });

    describe("#getRequiredSpeed", function() {
        it("should return 4.79 knots", function() {
            assert.equal(plan.getRequiredSpeed(), 115 / 24);
        });
    });
});

describe("#attachLogBook", function() {
    let logbook;
    let plan;
    before(function() {
        var pod = mkPod();
        plan = new Plan("test", pod);
        plan.addPoint("1");
        plan.addPoint("2");
        plan.addPoint("3");
        plan.addPoint("4");
        plan.addPoint("5");
        plan.addPoint("1");
        logbook = mkLogBook();
        plan.attachLogBook(logbook);
    });
    it("should return distance 110", function() {
        assert.equal(plan.getPlannedDistance(), 110);
    });
});

describe("getRequiredSpeed", function() {
    let logbook;
    let plan;
    before(function() {
        var pod = mkPod();
        plan = new Plan("test", pod);
        plan.addPoint("1");
        plan.addPoint("2");
        plan.addPoint("3");
        plan.addPoint("4");
        plan.addPoint("5");
        plan.addPoint("1");
        logbook = mkLogBook();
        plan.attachLogBook(logbook);
    });
    it("should return properly", function() {
        assert.equal(plan.getRequiredSpeed(), 5);
        plan.setPlannedSpeed(4, 10); // 4-5 in 10 knots, leaves 90M in 20h
        assert.equal(plan.getRequiredSpeed(), 4.5);
    });
});



function chkTwoPoints() {
    describe("#isLegPlanned", function() {
        it("should return true", function() {
            assert.equal(this.plan.isLegPlanned("1", "2"), true);
        });
        it("should return true", function() {
            assert.equal(this.plan.isLegPlanned("2", "1"), true);
        });
    });
    describe("#getLastPoint", function() {
        it("should return 2", function() {
            assert.equal(this.plan.getLastPoint(), "2");
        });
    });
    describe("#getPlannedDistance", function() {
        it("should return distance 5", function() {
            assert.equal(this.plan.getPlannedDistance(), 5);
        });
    });
    describe("#getRequiredSpeed", function() {
        it("should return -1", function() {
            assert.equal(this.plan.getRequiredSpeed(), -1);
        });
    });
};
