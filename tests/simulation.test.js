import test from 'node:test';
import assert from 'node:assert/strict';
import { createTournament } from '../tournament.js';
import { generateRound } from '../scheduler.js';

const profiles = ['draw', 'seeded', 'alternating'];
const summaries = [];

function simulate(n, doubles, singles, rounds, profile) {
  const t = createTournament({ names: Array.from({ length: n }, (_, i) => `Spiller ${i + 1}`).join('\n'), doubles: String(doubles), singles: String(singles), points: '16' });
  const ids = t.players.map(p => p.id);
  const played = Array(n).fill(0), singleCounts = Array(n).fill(0), rested = Array(n).fill(0);
  const partners = new Map();
  const activeSingles = Math.min(singles, Math.floor((n - doubles * 4) / 2));
  const active = t.courts.slice(0, doubles + activeSingles);
  let seed = n * 7919 + doubles * 113 + singles * 31;
  for (let r = 0; r < rounds; r++) {
    const round = generateRound(t);
    assert.ok(round, `missing round ${r + 1}: ${n}/${doubles}/${singles}/${profile}`);
    assert.equal(round.phase, doubles && partners.size < n * (n - 1) / 2 ? 'rotation' : 'balanced');
    assert.deepEqual(round.matches.map(m => m.courtId).sort(), active.map(c => c.id).sort());
    const participants = round.matches.flatMap(m => m.teams.flat());
    assert.equal(new Set(participants).size, participants.length);
    assert.deepEqual([...round.resting].sort(), ids.filter(id => !participants.includes(id)).sort());
    let repeated = 0;
    for (const match of round.matches) {
      const single = active.find(c => c.id === match.courtId).type === 'single';
      assert.equal(match.teams.length, 2);
      for (const team of match.teams) {
        assert.equal(team.length, single ? 1 : 2);
        assert.ok(team.every(id => ids.includes(id)));
        if (!single) {
          const pair = [...team].sort();
          const key = JSON.stringify(pair);
          const last = partners.get(key);
          if (last) {
            repeated++;
            pair.forEach((id, i) => assert.ok(played[ids.indexOf(id)] - last[i] >= round.cooldown, `cooldown round ${r + 1}: ${key}`));
          }
        }
      }
    }
    assert.equal(round.repeatedPairs, repeated);
    for (const id of round.resting) rested[ids.indexOf(id)]++;
    for (const match of round.matches) {
      const single = active.find(c => c.id === match.courtId).type === 'single';
      for (const id of match.teams.flat()) {
        played[ids.indexOf(id)]++;
        if (single) singleCounts[ids.indexOf(id)]++;
      }
      if (!single) for (const team of match.teams) {
        const pair = [...team].sort();
        partners.set(JSON.stringify(pair), pair.map(id => played[ids.indexOf(id)]));
      }
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const score = profile === 'draw' ? 8 : profile === 'seeded' ? seed % 17 : r % 2 ? 0 : 16;
      match.score = [score, 16 - score];
      match.draft = match.score.map(String);
    }
    t.rounds.push(round);
  }
  const diagnostic = JSON.stringify({ n, doubles, singles, rounds, profile, played, singles: singleCounts, rested });
  assert.ok(Math.max(...played) - Math.min(...played) <= 1, diagnostic);
  assert.equal(played.reduce((a, b) => a + b, 0), rounds * (4 * doubles + 2 * activeSingles));
  ids.forEach((_, i) => assert.equal(played[i] + rested[i], rounds));
  summaries.push({ n, doubles, singles, rounds, profile, played, singles: singleCounts, rested, coveredPairs: partners.size });
  return { played, singles: singleCounts, coveredPairs: partners.size };
}

for (let n = 2; n <= 12; n++) for (let d = 0; d <= 2; d++) for (let s = 0; s <= 1; s++) {
  if (!d && !s || n < (d ? 4 * d : 2)) continue;
  for (const profile of profiles) test(`simulation_balances_participation_${n}p_${d}d_${s}s_${profile}`, () => simulate(n, d, s, n * 4, profile));
}

for (const profile of profiles) test(`simulation_seven_players_mixed_courts_${profile}`, () => {
  const result = simulate(7, 1, 1, 28, profile);
  assert.deepEqual(result.played, Array(7).fill(24));
  assert.equal(result.coveredPairs, 21);
});

for (const [n, d, s] of [[5, 1, 1], [6, 1, 1], [7, 1, 1], [10, 2, 1], [11, 2, 1]]) {
  for (const profile of profiles) test(`simulation_eighteen_rounds_mixed_courts_${n}p_${d}d_${s}s_${profile}`, () => {
    const result = simulate(n, d, s, 18, profile);
    const low = Math.floor(18 * (4 * d + (n - 4 * d >= 2 ? 2 : 0)) / n);
    assert.ok(result.played.every(value => value === low || value === Math.ceil(18 * (4 * d + (n - 4 * d >= 2 ? 2 : 0)) / n)));
    assert.equal(result.coveredPairs, n * (n - 1) / 2);
    if (n === 5) assert.deepEqual(result.singles, Array(5).fill(0));
    if (n === 6 || n === 10) assert.ok(Math.max(...result.singles) - Math.min(...result.singles) <= 1, JSON.stringify(result));
  });
}

test.after(() => { if (process.env.SIMULATION_REPORT) console.log('SIMULATION_COUNTS ' + JSON.stringify(summaries)); });
