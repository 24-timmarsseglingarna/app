import assert from "node:assert";
import {mkPod} from "./misc.js";

describe("PoD", function () {
    var pod = mkPod();
    describe("#getDistance()", function () {
        it("should return 10 between 2 and 3", function () {
            assert.equal(pod.getDistance("2", "3"), 10);
        });
        it("should return 10 between 3 and 2", function () {
            assert.equal(pod.getDistance("3", "2"), 10);
        });
        it("should return -1 between 1 and 4", function () {
            assert.equal(pod.getDistance("1", "4"), -1);
        });
        it("should return -1 between 1 and 999", function () {
            assert.equal(pod.getDistance("1", "999"), -1);
        });
    });
    describe("#getNeighbors()", function () {
        it("should return 1 and 3 for 2", function () {
            assert.deepEqual(Object.keys(pod.getNeighbors("2")).sort(), ["1", "3"]);
        });

    });
});

