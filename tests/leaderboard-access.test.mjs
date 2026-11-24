import test from 'node:test';
import assert from 'node:assert/strict';
import {canUseTaskLeaderboard} from '../resources/js/Pages/Tasks/leaderboardAccess.mjs';
test('admin capability does not leak into employee or intern preview',()=>{
 assert.equal(canUseTaskLeaderboard(true,'Employee','IT Associate'),false);
 assert.equal(canUseTaskLeaderboard(true,'Employee','IT Intern'),false);
 assert.equal(canUseTaskLeaderboard(true,'Team Leader','IT Intern'),false);
});
test('preview management roles never grant a server-denied capability',()=>{
 for(const role of ['Team Leader','EVP','Operations Manager','Chief Vet']){
  assert.equal(canUseTaskLeaderboard(false,role),false);
  assert.equal(canUseTaskLeaderboard(undefined,role),false);
  assert.equal(canUseTaskLeaderboard(true,role),true);
 }
});
