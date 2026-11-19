/* IKIGAI WORLD reward policy, v2.
 * Pure rules only. No wallet writes: balances must be settled atomically by Supabase.
 * A reward key identifies a lesson + knowledge area, independent of game mode.
 */
export const REWARD_POLICY_VERSION = '2026-11-19-v2';
export const MAX_REWARDED_ATTEMPTS = 5;
export const MIN_PASS_PERCENT = 50;

export function rewardFactor(correct, total) {
  if (!Number.isInteger(correct) || !Number.isInteger(total) ||
      total < 1 || correct < 0 || correct > total) throw new RangeError('Invalid score');
  // Integer arithmetic: the pass threshold is inclusive (e.g. 10/20 passes).
  if (correct * 100 < total * 50) return 0;
  if (correct * 100 < total * 70) return 0.5;
  if (correct * 100 < total * 90) return 0.8;
  return 1;
}

export function calculateReward({correct,total,completedBefore,baseExp,baseCoins}) {
  if (![completedBefore,baseExp,baseCoins].every(Number.isInteger) ||
      completedBefore < 0 || baseExp < 0 || baseCoins < 0)
    throw new RangeError('Invalid reward or attempt count');
  const factor=rewardFactor(correct,total);
  const eligible=completedBefore < MAX_REWARDED_ATTEMPTS && factor>0;
  return {
    exp:eligible?Math.floor(baseExp*factor):0,
    coins:eligible?Math.floor(baseCoins*factor):0,
    completedAfter:completedBefore+1,
    remainingRewardedAttempts:Math.max(0,MAX_REWARDED_ATTEMPTS-completedBefore-1),
    passed:factor>0,
    exhausted:completedBefore>=MAX_REWARDED_ATTEMPTS,
    factor
  };
}
