import assert from "node:assert/strict";
import { COUNTER_OBJECTS, getCounterResult, KANJI_NUMBERS } from "../src/lib/japaneseCounters";

assert.equal(COUNTER_OBJECTS.length, 10);
assert.equal(KANJI_NUMBERS.length, 10);
assert.deepEqual(COUNTER_OBJECTS.map(({ id }) => id), ["person", "cat", "bird", "pencil", "paper", "book", "car", "apple", "glass", "shoes"]);
assert.ok(COUNTER_OBJECTS.every(({ readings }) => readings.length === 10));

for (const object of COUNTER_OBJECTS) {
  for (let quantity = 1; quantity <= 10; quantity++) {
    const result = getCounterResult(object.id, quantity);
    assert.ok(result);
    assert.equal(result.written, `${KANJI_NUMBERS[quantity - 1]}${object.counter}`);
    assert.equal(result.reading, object.readings[quantity - 1]);
    assert.equal(typeof result.note, "string");
  }
}

assert.equal(getCounterResult("person", 2)?.reading, "ふたり");
assert.equal(getCounterResult("cat", 3)?.reading, "さんびき");
assert.equal(getCounterResult("bird", 3)?.reading, "さんわ");
assert.equal(getCounterResult("bird", 6)?.reading, "ろくわ");
assert.equal(getCounterResult("pencil", 3)?.reading, "さんぼん");
assert.equal(getCounterResult("glass", 3)?.reading, "さんばい");
for (const quantity of [0, -1, 1.5, 11, NaN]) assert.equal(getCounterResult("cat", quantity), null);
assert.equal(getCounterResult("unknown", 1), null);
console.log("Japanese counter checks passed (10 objects × 10 quantities).");
