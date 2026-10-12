import test from 'node:test';
import assert from 'node:assert/strict';
import { createTournament } from '../tournament.js';
import { statistics } from '../statistics.js';

const setup = (extra = {}) => createTournament({ names: 'Anna\nBo\nClara\nDan\nEva\nFinn', doubles: '1', singles: '1', points: '16', ...extra });
const match = (teams, score = null, courtId = 'double1') => ({ courtId, teams, score, draft: score ? score.map(String) : ['', ''] });
const round = (t, matches, resting = []) => t.rounds.push({ number: t.rounds.length + 1, matches, resting });
const player = (rows, id) => rows.find(row => row.id === id);

test('statistics_empty_results_and_unplayed_coverage_are_explicit', () => {
  const s = statistics(setup());
  assert.deepEqual([s.partners, s.opponents, s.closest], [[], [], []]);
  assert.deepEqual(s.gaps, { played: 0, doubles: 0, singles: 0, rested: 0 });
  assert.deepEqual(s.coverage[0], { id: 'p1', name: 'Anna', unique: 0, total: 5, missing: ['Bo','Clara','Dan','Eva','Finn'], repeats: 0 });
  assert.deepEqual(s.form[0], { id: 'p1', name: 'Anna', recent: [], longestWinStreak: 0 });
});

test('statistics_partner_results_count_team_bonus_once_and_recalculate_corrections', () => {
  const t = setup();
  round(t, [match([['p2','p1'],['p3','p4']], [9,7])]);
  round(t, [match([['p1','p2'],['p4','p3']], [8,8])]);
  round(t, [match([['p1','p3'],['p2','p4']])]);
  t.rounds[0].matches[0].draft = ['', '7'];
  const original = structuredClone(t);
  const s = statistics(t);
  assert.deepEqual(s.partners, [
    { ids: ['p1','p2'], names: ['Anna','Bo'], played: 2, wins: 1, points: 19, pointsPerMatch: 9.5, winRate: 0.5 },
    { ids: ['p3','p4'], names: ['Clara','Dan'], played: 2, wins: 0, points: 15, pointsPerMatch: 7.5, winRate: 0 },
  ]);
  assert.deepEqual(t, original);
  t.rounds[0].matches[0].score = [7,9];
  assert.deepEqual(statistics(t).partners.map(p => [p.points,p.wins]), [[15,0],[19,1]]);
  for (const [points, score, expected] of [[8,[5,3],6], [24,[13,11],16]]) {
    const other = setup({ points: String(points) });
    round(other, [match([['p1','p2'],['p3','p4']], score)]);
    assert.equal(statistics(other).partners[0].points, expected);
  }
});

test('statistics_opponents_count_cross_team_individual_pairs_in_both_court_types', () => {
  const t = setup();
  round(t, [match([['p1','p2'],['p3','p4']], [8,8]), match([['p5'],['p6']], [9,7], 'single1')]);
  round(t, [match([['p1'],['p3']], [8,8], 'single1')], ['p2','p4','p5','p6']);
  const s = statistics(t);
  assert.deepEqual(s.opponents.map(p => [p.names,p.played]), [
    [['Anna','Clara'],2], [['Anna','Dan'],1], [['Bo','Clara'],1], [['Bo','Dan'],1], [['Eva','Finn'],1],
  ]);
  assert.equal(s.opponents.some(p => p.names.join() === 'Anna,Bo'), false);
});

test('statistics_coverage_includes_planned_pairs_and_counts_each_repetition_per_player', () => {
  const t = setup({ names: 'Anna\nBo\nClara\nDan', singles: '0' });
  round(t, [match([['p1','p2'],['p3','p4']], [8,8])]);
  round(t, [match([['p1','p3'],['p2','p4']], [8,8])]);
  assert.deepEqual(statistics(t).coverage[0], { id:'p1', name:'Anna', unique:2, total:3, missing:['Dan'], repeats:0 });
  round(t, [match([['p1','p4'],['p2','p3']])]);
  assert.deepEqual(statistics(t).coverage[0], { id: 'p1', name: 'Anna', unique: 3, total: 3, missing: [], repeats: 0 });
  round(t, [match([['p1','p2'],['p3','p4']])]);
  assert.equal(statistics(t).coverage[0].repeats, 1);
  round(t, [match([['p1','p2'],['p3','p4']])]);
  assert.equal(statistics(t).coverage[0].repeats, 2);
});

test('statistics_fairness_counts_results_but_rests_only_after_whole_round_completed', () => {
  const t = setup({ names: 'Anna\nBo\nClara\nDan\nEva\nFinn\nGorm' });
  round(t, [match([['p1','p2'],['p3','p4']], [8,8]), match([['p5'],['p6']], null, 'single1')], ['p7']);
  round(t, [match([['p2','p3'],['p4','p5']], [9,7]), match([['p1'],['p6']], [8,8], 'single1')], ['p7']);
  let s = statistics(t);
  assert.deepEqual(player(s.fairness, 'p1'), { id:'p1', name:'Anna', played:2, doubles:1, singles:1, rested:0 });
  assert.equal(player(s.fairness, 'p7').rested, 1);
  assert.deepEqual(s.gaps, { played:2, doubles:2, singles:1, rested:1 });
  t.rounds[0].matches[1].score = [9,7];
  s = statistics(t);
  assert.equal(player(s.fairness,'p7').rested, 2);
  assert.deepEqual(player(s.fairness,'p6'), { id:'p6', name:'Finn', played:2, doubles:0, singles:2, rested:0 });
  assert.deepEqual(s.gaps, { played:2, doubles:2, singles:2, rested:2 });
});

test('statistics_form_keeps_last_five_and_rests_preserve_streak_but_draws_and_losses_reset', () => {
  const t = setup({ doubles:'0', singles:'1', names:'Anna\nBo\nClara' });
  for (const score of [[9,7],[10,6]]) round(t, [match([['p1'],['p2']],score,'single1')], ['p3']);
  round(t, [match([['p2'],['p3']],[8,8],'single1')], ['p1']);
  for (const score of [[11,5],[8,8],[9,7],[7,9],[9,7]]) round(t, [match([['p1'],['p2']],score,'single1')], ['p3']);
  const s = statistics(t);
  assert.deepEqual(player(s.form,'p1'), { id:'p1', name:'Anna', recent:[
    {round:4,result:'V',points:13}, {round:5,result:'U',points:8}, {round:6,result:'V',points:11},
    {round:7,result:'T',points:7}, {round:8,result:'V',points:11},
  ], longestWinStreak:3 });
  assert.deepEqual(s.partners, []);
  assert.deepEqual(player(s.coverage,'p1'), { id:'p1', name:'Anna', unique:0, total:0, missing:[], repeats:0 });
  assert.equal(player(s.fairness,'p1').doubles, 0);
});

test('statistics_closest_orders_draws_first_then_latest_round_and_configured_court', () => {
  const t = setup();
  round(t, [match([['p1','p2'],['p3','p4']], [8,8]), match([['p5'],['p6']], [9,7], 'single1')]);
  round(t, [match([['p5'],['p6']], [8,8], 'single1'), match([['p1','p2'],['p3','p4']], [8,8])]);
  round(t, [match([['p1','p2'],['p3','p4']], [9,9])]);
  assert.deepEqual(statistics(t).closest.map(m => [m.round,m.court,m.difference]), [[2,1,0],[2,2,0],[1,1,0],[1,2,2]]);
  assert.deepEqual(statistics(t).closest[0], { round:2, court:1, teams:[['Anna','Bo'],['Clara','Dan']], score:[8,8], difference:0 });
});

test('statistics_name_ties_use_danish_order_for_pairs_and_players', () => {
  const t = setup({ names:'Åse\nØjvind\nÆgir\nBo', singles:'0' });
  round(t, [match([['p1','p2'],['p3','p4']], [8,8])]);
  const s = statistics(t);
  assert.deepEqual(s.coverage.map(p => p.name), ['Bo','Ægir','Øjvind','Åse']);
  assert.deepEqual(s.partners.map(p => p.names), [['Bo','Ægir'],['Øjvind','Åse']]);
});


