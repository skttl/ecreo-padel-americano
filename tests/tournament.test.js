import test from 'node:test';
import assert from 'node:assert/strict';
import { createTournament, validateScore, scoreFromInput, standings, history, pairKey } from '../tournament.js';

const setup = (extra = {}) => createTournament({ names: 'Anna\nBo\nClara\nDan', doubles: '1', singles: '0', points: '16', ...extra });
const match = (teams, score = null, courtId = 'double1') => ({ courtId, teams, score, draft: score ? score.map(String) : ['', ''] });
const addRound = (t, matches, resting = []) => t.rounds.push({ number: t.rounds.length + 1, phase: 'rotation', cooldown: 3, matches, resting });
const byId = t => new Map(standings(t).map(row => [row.id, row]));

test('setup_trims_names_and_assigns_stable_ids', () => {
  const t = setup({ names: ' Anna \n\nBo\n Clara\nDan ' });
  assert.deepEqual(t.players, [{id:'p1', name:'Anna'}, {id:'p2',name:'Bo'}, {id:'p3',name:'Clara'}, {id:'p4',name:'Dan'}]);
  assert.deepEqual(t.courts, [{ id: 'double1', type: 'double' }]);
  assert.equal(t.points, 16);
  assert.deepEqual(t.rounds, []);
});

test('setup_rejects_invalid_fields', () => {
  const cases = [
    ['names', { names: ' \n ' }], ['names', { names: ' Anna\nanna \nBo\nDan' }],
    ['doubles', { doubles: '0', singles: '0' }], ['names', { names: 'Anna\nBo\nClara' }],
    ['names', { names: 'Anna', doubles: '0', singles: '1' }],
    ['doubles', { doubles: '-1' }], ['doubles', { doubles: '1.5' }], ['singles', { singles: '' }],
    ['points', { points: '0' }], ['points', { points: '' }], ['points', { points: '3.5' }],
    ['points', { points: '9007199254740992' }], ['doubles', { doubles: '9007199254740992' }],
  ];
  for (const [field, draft] of cases) assert.throws(() => setup(draft), error => error.field === field);
});

test('setup_allows_unused_single_and_requires_all_doubles', () => {
  const t = setup({ names: 'Anna\nBo\nClara\nDan\nEva', singles: '1' });
  assert.equal(t.courts.length, 2);
  assert.equal(setup({ doubles: '0', singles: '2' }).courts.length, 2);
  assert.throws(() => setup({ doubles: '2', singles: '1' }), error => error.field === 'names');
  assert.equal(setup({ points: '24' }).points, 24);
});

test('setup_rejects_more_single_courts_than_available_player_pairs', () => {
  assert.throws(() => setup({ singles: '3' }), error => error.field === 'singles');
  assert.throws(() => setup({ singles: '4294967296' }), error => error.field === 'singles');
  assert.throws(() => setup({ singles: '9007199254740991' }), error => error.field === 'singles');
  assert.equal(setup({ singles: '2' }).courts.filter(court => court.type === 'single').length, 2);
  assert.equal(setup({ names: 'Anna\nBo\nClara\nDan\nEva', singles: '1' }).courts.length, 2);
});

test('validate_score_accepts_exact_integer_sum', () => {
  for (const score of [[0,16],[16,0],[8,8],[9,7]]) assert.equal(validateScore(score,16),true);
  for (const score of [[-1,17],[8.5,7.5],[8,7],['',16],['8',8],null,[16],[16,0,0],[Infinity,0]]) assert.equal(validateScore(score,16),false);
  assert.equal(validateScore([0,0],0),false);
  assert.equal(validateScore([0,16],16.5),false);
});

test('score_input_completes_opponent', () => {
  assert.deepEqual(scoreFromInput('4',0,16),[4,12]);
  assert.deepEqual(scoreFromInput('4',1,16),[12,4]);
  for (const [input,expected] of [['0',[0,16]],['16',[16,0]],['8',[8,8]]]) assert.deepEqual(scoreFromInput(input,0,16),expected);
  assert.deepEqual(scoreFromInput('3',0,8),[3,5]);
  assert.deepEqual(scoreFromInput('4',1,24),[20,4]);
});

test('score_input_rejects_invalid_drafts', () => {
  for (const input of ['', ' ', '-1', '17', '1.5', 'NaN', 'wat', 'Infinity']) assert.equal(scoreFromInput(input,0,16),null);
});

test('standings_awards_team_points_bonus_wins_and_singles', () => {
  const t = setup();
  addRound(t,[match([['p1','p2'],['p3','p4']],[9,7])]);
  assert.deepEqual(t.players.map(p => byId(t).get(p.id).points),[11,11,7,7]);
  assert.deepEqual(t.players.map(p => byId(t).get(p.id).wins),[1,1,0,0]);
  t.rounds[0].matches[0].score = [8,8];
  assert.deepEqual(t.players.map(p => byId(t).get(p.id).points),[8,8,8,8]);
  for (const [points,score,expected] of [[8,[5,3],6],[24,[13,11],16]]) {
    const single = setup({doubles:'0',singles:'1',points:String(points)});
    addRound(single,[match([['p1'],['p2']],score,'single1')]);
    assert.equal(byId(single).get('p1').points,expected);
    assert.equal(byId(single).get('p1').singles,1);
    assert.equal(byId(single).get('p1').wins,1);
    assert.equal(byId(single).get('p1').pointsPerMatch,expected);
  }
});

function averagesFixture(scores) {
  const t = setup({doubles:'0',singles:'1'});
  for (const [id,values] of scores) for (const value of values) addRound(t,[match([[id],['p4']],[value,16-value],'single1')]);
  return t;
}

test('standings_orders_by_points_per_match', () => {
  const t = averagesFixture([['p1',[9,9,9]],['p2',[8,8,10,10]]]);
  const rows = standings(t);
  assert.deepEqual([rows[0].id,rows[0].points,rows[0].played,rows[0].pointsPerMatch],['p1',33,3,11]);
  assert.deepEqual([rows[1].id,rows[1].points,rows[1].played,rows[1].pointsPerMatch],['p2',40,4,10]);
});

test('standings_equal_averages_share_rank', () => {
  const t = averagesFixture([['p1',[9,9]],['p2',[9,9,9]]]);
  t.players[0].name = 'Åse'; t.players[1].name = 'Ægir'; t.players[2].name = 'Øjvind';
  const rows = standings(t);
  assert.deepEqual(rows.slice(0,2).map(r => [r.name,r.points,r.rank]),[['Ægir',33,1],['Åse',22,1]]);
  assert.equal(rows[2].rank,3);
});

test('standings_unplayed_has_zero_average', () => {
  const t = setup();
  addRound(t,[match([['p1','p2'],['p3','p4']])]);
  for (const row of standings(t)) assert.deepEqual([row.points,row.played,row.pointsPerMatch,row.wins,row.singles,row.rank],[0,0,0,0,0,1]);
});

test('standings_ignores_invalid_scores_and_keeps_saved_score_during_draft', () => {
  const t = setup();
  addRound(t,[match([['p1','p2'],['p3','p4']],[9,7])]);
  t.rounds[0].matches[0].draft = ['', '7'];
  addRound(t,[match([['p1','p3'],['p2','p4']],[9,9])]);
  const row = byId(t).get('p1');
  assert.deepEqual([row.points,row.played,row.pointsPerMatch],[11,1,11]);
});

test('result_correction_recalculates_without_changing_generated_teams', () => {
  const t = setup();
  addRound(t,[match([['p1','p2'],['p3','p4']],[9,7])]);
  addRound(t,[match([['p1','p3'],['p2','p4']],[8,8])]);
  const originalTeams = structuredClone(t.rounds.map(r => r.matches.map(m => m.teams)));
  const originalHistory = history(t);
  t.rounds[0].matches[0].score = [8,8];
  assert.deepEqual(t.players.map(p => {const r=byId(t).get(p.id);return [r.points,r.pointsPerMatch,r.played,r.wins];}),[[16,8,2,0],[16,8,2,0],[16,8,2,0],[16,8,2,0]]);
  assert.deepEqual(t.rounds.map(r => r.matches.map(m => m.teams)),originalTeams);
  assert.deepEqual(history(t),originalHistory);
});

test('history_counts_unfinished_matches_singles_and_latest_partner_counts', () => {
  const t = setup({ names:'Anna\nBo\nClara\nDan\nEva\nFinn', singles:'1' });
  addRound(t,[match([['p1','p2'],['p3','p4']]),match([['p5'],['p6']],null,'single1')]);
  addRound(t,[match([['p1','p3'],['p2','p5']])],['p4','p6']);
  addRound(t,[match([['p2','p1'],['p4','p6']]),match([['p3'],['p5']],null,'single1')]);
  const h = history(t);
  assert.deepEqual([...h.played.values()],[3,3,3,2,3,2]);
  assert.deepEqual([...h.singles.values()],[0,0,1,0,2,1]);
  assert.equal(h.coveredPairs,5);
  assert.equal(h.totalPairs,15);
  assert.deepEqual(h.partners.get(pairKey('p2','p1')),{ids:['p1','p2'],played:[3,3]});
  assert.deepEqual(h.partners.get(pairKey('p3','p4')),{ids:['p3','p4'],played:[1,1]});
  assert.equal(h.partners.has(pairKey('p5','p6')),false);
  assert.equal(standings(t).every(r => r.played === 0),true);
});

test('history_empty_counts_and_pair_key_are_unambiguous', () => {
  const h = history(setup());
  assert.deepEqual([...h.played.values()],[0,0,0,0]);
  assert.equal(h.coveredPairs,0); assert.equal(h.totalPairs,6);
  assert.equal(pairKey('a','b'),pairKey('b','a'));
  assert.notEqual(pairKey('a-b','c'),pairKey('a','b-c'));
});
