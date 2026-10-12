import test from 'node:test';
import assert from 'node:assert/strict';
import { createTournament, history, standings, pairKey } from '../tournament.js';
import { generateRound } from '../scheduler.js';

export function fixture(n, doubles = 1, singles = 0) {
  return createTournament({ names: Array.from({ length: n }, (_, i) => `Spiller ${i + 1}`).join('\n'), doubles: String(doubles), singles: String(singles), points: '16' });
}

function append(t) {
  const round = generateRound(t);
  assert.ok(round);
  round.matches.forEach(m => { m.score = [8, 8]; m.draft = ['8', '8']; });
  t.rounds.push(round);
  return round;
}

test('four_players_cover_pairs_then_fallback_to_two', () => {
  const t = fixture(4);
  for (let i = 0; i < 3; i++) assert.equal(append(t).repeatedPairs, 0);
  assert.equal(history(t).coveredPairs, 6);
  const round = append(t);
  assert.equal(round.phase, 'balanced');
  assert.equal(round.cooldown, 2);
});

test('five_players_leave_single_inactive_six_activate_it', () => {
  for (const n of [5, 6]) {
    const round = generateRound(fixture(n, 1, 1));
    assert.equal(round.matches.length, n === 5 ? 1 : 2);
    assert.equal(round.resting.length, n === 5 ? 1 : 0);
  }
});

test('generation_does_not_mutate_input_and_is_deterministic', () => {
  const t = fixture(8, 1, 1);
  const before = structuredClone(t);
  assert.deepEqual(generateRound(t), generateRound(t));
  assert.deepEqual(t, before);
  assert.deepEqual(generateRound(t).matches[0].draft, ['', '']);
  assert.equal(generateRound(t).matches[0].score, null);
});

test('rotation_uses_only_new_partners_when_full_round_exists', () => {
  const t = fixture(6, 1, 1);
  for (let i = 0; i < 6; i++) {
    const before = history(t);
    const round = append(t);
    assert.equal(round.repeatedPairs, 0);
    for (const team of round.matches[0].teams) assert.ok(!before.partners.has(JSON.stringify([...team].sort())));
  }
});

test('rotation_reports_necessary_repeated_pairs_and_finishes', () => {
  const t = fixture(6, 1, 1);
  let exception = false;
  for (let i = 0; i < 30 && history(t).coveredPairs < 15; i++) {
    const before = history(t);
    const round = append(t);
    const repeated = round.matches[0].teams.filter(team => before.partners.has(JSON.stringify([...team].sort()))).length;
    assert.equal(round.repeatedPairs, repeated);
    exception ||= repeated > 0;
  }
  assert.ok(exception);
  assert.equal(history(t).coveredPairs, 15);
  assert.equal(generateRound(t).phase, 'balanced');
});

test('single_only_starts_balanced', () => {
  assert.equal(generateRound(fixture(5, 0, 1)).phase, 'balanced');
});

test('necessary_rotation_exception_can_precede_individual_partner_completion', () => {
  const t = fixture(11, 2, 1);
  const seen = new Map(t.players.map(player => [player.id, new Set()]));
  let earlyRepeat = null;
  for (let i = 0; i < 15; i++) {
    const round = append(t);
    for (const match of round.matches) for (const team of match.teams) {
      if (team.length !== 2) continue;
      const [a, b] = team;
      if (seen.get(a).has(b) && team.some(id => seen.get(id).size < 10)) {
        earlyRepeat ??= { round, team, missing: team.map(id => t.players.filter(player => player.id !== id && !seen.get(id).has(player.id)).map(player => player.id)) };
      }
      seen.get(a).add(b);
      seen.get(b).add(a);
    }
  }
  assert.ok(earlyRepeat, 'The approved full-round exception does not guarantee individual completion before repeats');
  assert.equal(earlyRepeat.round.number, 14);
  assert.equal(earlyRepeat.round.phase, 'rotation');
  assert.equal(earlyRepeat.round.repeatedPairs, 2);
  assert.deepEqual(earlyRepeat.team, ['p1', 'p10']);
  assert.deepEqual(earlyRepeat.missing, [[], ['p9']]);
  assert.ok([...seen.values()].every(partners => partners.size === 10));
});

test('rotation_never_repeats_when_two_eligible_new_pairs_fill_the_double_court', () => {
  const t = fixture(6, 1, 1);
  let sawNecessaryRepeat = false;
  for (let i = 0; i < 30 && history(t).coveredPairs < 15; i++) {
    const before = history(t);
    const ids = t.players.map(p => p.id);
    const fresh = [];
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
      if (!before.partners.has(pairKey(ids[a], ids[b]))) fresh.push([ids[a], ids[b]]);
    }
    const fullFreshRound = fresh.some((pair, index) => fresh.slice(index + 1).some(other => pair.every(id => !other.includes(id))));
    const round = append(t);
    if (fullFreshRound) assert.equal(round.repeatedPairs, 0);
    sawNecessaryRepeat ||= round.repeatedPairs > 0;
  }
  assert.ok(sawNecessaryRepeat);
});

test('balanced_chooses_stronger_team_balance_for_the_same_players', () => {
  const t = fixture(7);
  let seed = 7 * 7919 + 113;
  for (let i = 0; i < 12; i++) {
    const round = append(t);
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const score = seed % 17;
    round.matches[0].score = [score, 16 - score];
  }
  const before = history(t);
  const strength = new Map(standings(t).map(row => [row.id, row.pointsPerMatch]));
  const round = generateRound(t);
  assert.equal(round.phase, 'balanced');
  const players = round.matches[0].teams.flat();
  const differences = [];
  for (let i = 1; i < 4; i++) {
    const teams = [[players[0], players[i]], players.slice(1).filter(id => id !== players[i])];
    if (teams.some(team => {
      const last = before.partners.get(pairKey(...team));
      return last && Math.min(...team.map((id, index) => before.played.get(id) - last.played[index])) < round.cooldown;
    })) continue;
    differences.push(Math.abs(teams[0].reduce((sum, id) => sum + strength.get(id), 0) - teams[1].reduce((sum, id) => sum + strength.get(id), 0)));
  }
  assert.ok(differences.length > 1 && Math.max(...differences) > Math.min(...differences));
  const chosen = round.matches[0].teams;
  const chosenDifference = Math.abs(chosen[0].reduce((sum, id) => sum + strength.get(id), 0) - chosen[1].reduce((sum, id) => sum + strength.get(id), 0));
  assert.equal(chosenDifference, Math.min(...differences));
});

test('single_only_draws_rotate_opponents', () => {
  const t = fixture(4, 0, 2);
  const opponents = new Set();
  for (let i = 0; i < 3; i++) {
    const round = append(t);
    for (const match of round.matches) opponents.add(pairKey(match.teams[0][0], match.teams[1][0]));
  }
  assert.equal(opponents.size, 6);
});

test('cooldown_three_wins_over_a_stronger_cooldown_two_match', () => {
  const t = fixture(5);
  let seed = 5 * 7919 + 113;
  for (let i = 0; i < 5; i++) {
    const round = append(t);
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const score = seed % 17;
    round.matches[0].score = [score, 16 - score];
  }
  const before = history(t);
  const strength = new Map(standings(t).map(row => [row.id, row.pointsPerMatch]));
  const round = generateRound(t);
  assert.equal(round.cooldown, 3);
  const chosen = round.matches[0].teams;
  const chosenDifference = Math.abs(chosen[0].reduce((sum, id) => sum + strength.get(id), 0) - chosen[1].reduce((sum, id) => sum + strength.get(id), 0));
  const ids = t.players.map(player => player.id);
  let bestAtTwo = Infinity;
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
    for (let c = 0; c < ids.length; c++) for (let d = c + 1; d < ids.length; d++) {
      const teams = [[ids[a], ids[b]], [ids[c], ids[d]]];
      if (new Set(teams.flat()).size !== 4) continue;
      if (teams.some(team => {
        const last = before.partners.get(pairKey(...team));
        return last && Math.min(...team.map((id, index) => before.played.get(id) - last.played[index])) < 2;
      })) continue;
      bestAtTwo = Math.min(bestAtTwo, Math.abs(teams[0].reduce((sum, id) => sum + strength.get(id), 0) - teams[1].reduce((sum, id) => sum + strength.get(id), 0)));
    }
  }
  assert.ok(bestAtTwo < chosenDifference);
});

test('zero_intervening_games_never_qualifies_and_undersized_input_has_no_full_round', () => {
  const t = fixture(4);
  const first = append(t);
  const repeated = new Set(first.matches[0].teams.map(team => pairKey(...team)));
  const next = generateRound(t);
  assert.ok(next.matches[0].teams.every(team => !repeated.has(pairKey(...team))));
  const impossible = fixture(4);
  impossible.players.pop();
  const snapshot = structuredClone(impossible);
  assert.equal(generateRound(impossible), null);
  assert.deepEqual(impossible, snapshot);
});

test('asymmetric_intervening_games_use_the_lower_partner_gap', () => {
  const t = fixture(5);
  const completed = [
    [[['p2', 'p5'], ['p3', 'p4']], 3],
    [[['p2', 'p4'], ['p1', 'p3']], 3],
    [[['p1', 'p4'], ['p2', 'p3']], 3],
    [[['p1', 'p2'], ['p4', 'p5']], 3],
    [[['p1', 'p5'], ['p2', 'p4']], 2],
    [[['p3', 'p5'], ['p1', 'p4']], 2],
    [[['p2', 'p5'], ['p3', 'p4']], 3],
    [[['p4', 'p5'], ['p1', 'p3']], 3],
    [[['p1', 'p2'], ['p3', 'p5']], 2],
    [[['p2', 'p3'], ['p1', 'p5']], 3],
    [[['p1', 'p3'], ['p2', 'p4']], 2],
    [[['p2', 'p5'], ['p1', 'p4']], 3],
    [[['p1', 'p2'], ['p3', 'p4']], 3],
  ];
  for (const [index, [teams, cooldown]] of completed.entries()) {
    const before = history(t);
    const repeatedPairs = teams.filter(team => before.partners.has(pairKey(...team))).length;
    assert.ok(teams.every(team => {
      const last = before.partners.get(pairKey(...team));
      return !last || Math.min(...team.map((id, player) => before.played.get(id) - last.played[player])) >= cooldown;
    }));
    t.rounds.push({ number: index + 1, phase: before.coveredPairs < before.totalPairs ? 'rotation' : 'balanced', cooldown, repeatedPairs,
      matches: [{ courtId: 'double1', teams, score: [8, 8], draft: ['8', '8'] }],
      resting: t.players.map(player => player.id).filter(id => !teams.flat().includes(id)) });
  }
  const before = history(t);
  assert.equal(before.coveredPairs, 10);
  const last = before.partners.get(pairKey('p1', 'p5'));
  assert.deepEqual(['p1', 'p5'].map((id, index) => before.played.get(id) - last.played[index]), [3, 1]);
  const round = generateRound(t);
  assert.equal(round.phase, 'balanced');
  assert.equal(round.cooldown, 2);
  assert.ok(round.matches[0].teams.every(team => pairKey(...team) !== pairKey('p1', 'p5')));
});

test('worker_reports_round_or_error_without_mutating_tournament', async () => {
  const original = globalThis.self;
  const messages = [];
  globalThis.self = { postMessage: message => messages.push(message) };
  try {
    await import('../scheduler-worker.js');
    const t = fixture(6, 1, 1);
    const snapshot = structuredClone(t);
    globalThis.self.onmessage({ data: t });
    assert.deepEqual(messages[0], { round: generateRound(t), error: null });
    assert.deepEqual(t, snapshot);
    globalThis.self.onmessage({ data: null });
    assert.equal(messages[1].round, null);
    assert.equal(typeof messages[1].error, 'string');
    assert.ok(messages[1].error.length > 0);
  } finally {
    globalThis.self = original;
  }
});
