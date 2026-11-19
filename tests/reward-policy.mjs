import {calculateReward,rewardFactor} from '../reward-policy.js';
import assert from 'node:assert/strict';

assert.equal(rewardFactor(0,20),0);
assert.equal(rewardFactor(9,20),0);
assert.equal(rewardFactor(10,20),0.5);
assert.equal(rewardFactor(13,20),0.5);
assert.equal(rewardFactor(14,20),0.8);
assert.equal(rewardFactor(17,20),0.8);
assert.equal(rewardFactor(18,20),1);
assert.equal(rewardFactor(20,20),1);
for (const previous of [0,1,2,3,4]) {
  const r=calculateReward({correct:20,total:20,completedBefore:previous,baseExp:100,baseCoins:20});
  assert.deepEqual([r.exp,r.coins,r.remainingRewardedAttempts],[100,20,4-previous]);
}
assert.deepEqual(
  [calculateReward({correct:9,total:20,completedBefore:0,baseExp:100,baseCoins:20}).exp,
   calculateReward({correct:9,total:20,completedBefore:0,baseExp:100,baseCoins:20}).coins],
  [0,0]);
const exhausted=calculateReward({correct:20,total:20,completedBefore:5,baseExp:100,baseCoins:20});
assert.equal(exhausted.exp,0);
assert.equal(exhausted.coins,0);
assert.equal(exhausted.completedAfter,6); // Free practice still allowed.
assert.throws(()=>rewardFactor(21,20));
console.log('Reward policy: 5-attempt and 50% boundary tests passed');
