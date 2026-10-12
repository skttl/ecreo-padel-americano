import test from 'node:test';
import assert from 'node:assert/strict';
import { createTournament } from '../tournament.js';
import { generateRound } from '../scheduler.js';
import { loadState, saveState, clearState } from '../storage.js';

const key = 'ecreopadel.americano.v1';
const draft = { names: 'Anna\nBo\nClara\nDan\nEva\nFinn\nGry', doubles: '1', singles: '1', points: '16' };
function stateFixture() {
  const tournament = createTournament(draft);
  tournament.rounds.push(generateRound(tournament));
  tournament.rounds[0].matches[0].score = [9, 7];
  tournament.rounds[0].matches[0].draft = ['', '7'];
  return { version: 1, draft: { ...draft }, tournament };
}
function storageFixture(value = null) {
  const values = new Map(value === null ? [] : [[key, value]]);
  const calls = [];
  return {
    values, calls,
    getItem(name) { calls.push(['getItem', name]); return values.get(name) ?? null; },
    setItem(name, value) { calls.push(['setItem', name, value]); values.set(name, value); },
    removeItem(name) { calls.push(['removeItem', name]); values.delete(name); },
    clear() { assert.fail('Storage.clear must never be called'); },
  };
}

test('storage_roundtrip_preserves_generated_round_saved_score_and_incomplete_draft', () => {
  const state = stateFixture();
  const storage = storageFixture();
  saveState(storage, state);
  assert.deepEqual(storage.calls, [['setItem', key, JSON.stringify(state)]]);
  assert.deepEqual(JSON.parse(storage.values.get(key)), state);
  assert.deepEqual(loadState(storage), state);
});

test('storage_roundtrip_preserves_incomplete_setup_without_tournament', () => {
  const state = { version: 1, draft: { names: ' <Anna>\n', doubles: '', singles: '-1', points: 'abc' }, tournament: null };
  const storage = storageFixture();
  saveState(storage, state);
  assert.deepEqual(loadState(storage), state);
});

test('storage_load_allows_new_setup_draft_with_existing_tournament', () => {
  const state = stateFixture();
  state.draft = { names: '', doubles: '', singles: '', points: '' };
  assert.deepEqual(loadState(storageFixture(JSON.stringify(state))), state);
});

test('storage_load_allows_unused_single_courts_and_no_generated_rounds', () => {
  const state = { version: 1, draft, tournament: createTournament({ ...draft, names: 'Anna\nBo\nClara\nDan\nEva' }) };
  assert.deepEqual(loadState(storageFixture(JSON.stringify(state))), state);
  state.tournament.rounds.push(generateRound(state.tournament));
  assert.deepEqual(loadState(storageFixture(JSON.stringify(state))), state);
});

test('storage_load_returns_null_only_when_key_is_missing', () => {
  const storage = storageFixture();
  assert.equal(loadState(storage), null);
  assert.deepEqual(storage.calls, [['getItem', key]]);
});

const corruptions = [
  ['unknown_version', state => { state.version = 2; }],
  ['missing_draft', state => { delete state.draft; }],
  ['non_string_setup_draft', state => { state.draft.points = 16; }],
  ['missing_tournament', state => { delete state.tournament; }],
  ['duplicate_player_id', state => { state.tournament.players[1].id = 'p1'; }],
  ['duplicate_player_name', state => { state.tournament.players[1].name = 'ANNA'; }],
  ['empty_player_name', state => { state.tournament.players[1].name = ' '; }],
  ['invalid_player_id', state => { state.tournament.players[1].id = 2; }],
  ['duplicate_court_id', state => { state.tournament.courts[1].id = 'double1'; }],
  ['unknown_court_type', state => { state.tournament.courts[0].type = 'triple'; }],
  ['insufficient_players_for_doubles', state => { state.tournament.courts.push({ id: 'double2', type: 'double' }); }],
  ['too_many_singles', state => { state.tournament.courts.push(...[2, 3, 4].map(n => ({ id: `single${n}`, type: 'single' }))); }],
  ['no_courts', state => { state.tournament.courts = []; }],
  ['non_positive_points', state => { state.tournament.points = 0; }],
  ['fractional_points', state => { state.tournament.points = 16.5; }],
  ['missing_rounds', state => { delete state.tournament.rounds; }],
  ['wrong_round_number', state => { state.tournament.rounds[0].number = 2; }],
  ['unknown_phase', state => { state.tournament.rounds[0].phase = 'unknown'; }],
  ['invalid_cooldown', state => { state.tournament.rounds[0].cooldown = 0; }],
  ['negative_repeated_pairs', state => { state.tournament.rounds[0].repeatedPairs = -1; }],
  ['excessive_repeated_pairs', state => { state.tournament.rounds[0].repeatedPairs = 3; }],
  ['missing_match', state => { state.tournament.rounds[0].matches.pop(); }],
  ['unknown_court', state => { state.tournament.rounds[0].matches[0].courtId = 'missing'; }],
  ['duplicate_court_in_round', state => { state.tournament.rounds[0].matches[1].courtId = 'double1'; }],
  ['unknown_player_in_match', state => { state.tournament.rounds[0].matches[0].teams[0][0] = 'missing'; }],
  ['wrong_double_team_size', state => { state.tournament.rounds[0].matches[0].teams[0].pop(); }],
  ['wrong_single_team_size', state => { state.tournament.rounds[0].matches[1].teams[0].push('p7'); }],
  ['wrong_team_count', state => { state.tournament.rounds[0].matches[0].teams.push([]); }],
  ['duplicate_round_participant', state => { const matches = state.tournament.rounds[0].matches; matches[1].teams[0][0] = matches[0].teams[0][0]; }],
  ['invalid_score_sum', state => { state.tournament.rounds[0].matches[0].score = [9, 6]; }],
  ['negative_score', state => { state.tournament.rounds[0].matches[0].score = [-1, 17]; }],
  ['fractional_score', state => { state.tournament.rounds[0].matches[0].score = [8.5, 7.5]; }],
  ['string_score', state => { state.tournament.rounds[0].matches[0].score = ['9', 7]; }],
  ['missing_score', state => { delete state.tournament.rounds[0].matches[0].score; }],
  ['non_string_score_draft', state => { state.tournament.rounds[0].matches[0].draft = [9, '7']; }],
  ['wrong_score_draft_size', state => { state.tournament.rounds[0].matches[0].draft = ['9']; }],
  ['missing_resting_player', state => { state.tournament.rounds[0].resting = []; }],
  ['unknown_resting_player', state => { state.tournament.rounds[0].resting = ['missing']; }],
  ['duplicate_resting_player', state => { const resting = state.tournament.rounds[0].resting; resting.push(resting[0]); }],
  ['playing_player_also_resting', state => { state.tournament.rounds[0].resting = [state.tournament.rounds[0].matches[0].teams[0][0]]; }],
];
for (const [name, corrupt] of corruptions) {
  test(`storage_load_rejects_${name}_without_writes`, () => {
    const state = stateFixture();
    corrupt(state);
    const original = JSON.stringify(state);
    const storage = storageFixture(original);
    assert.throws(() => loadState(storage), /gemte|gemt/i);
    assert.deepEqual(storage.calls, [['getItem', key]]);
    assert.equal(storage.values.get(key), original);
  });
}

test('storage_load_rejects_invalid_json_and_invalid_root_without_writes', () => {
  for (const original of ['', '{', 'null', '[]', '42']) {
    const storage = storageFixture(original);
    assert.throws(() => loadState(storage), /gemte|gemt/i);
    assert.deepEqual(storage.calls, [['getItem', key]]);
    assert.equal(storage.values.get(key), original);
  }
});

test('storage_save_failure_reaches_caller_and_preserves_previous_json', () => {
  const original = JSON.stringify(stateFixture());
  const storage = storageFixture(original);
  const cause = new Error('quota exceeded');
  storage.setItem = () => { throw cause; };
  assert.throws(() => saveState(storage, { version: 1, draft, tournament: null }), error => error === cause || error.cause === cause);
  assert.equal(storage.values.get(key), original);
});

test('storage_read_failure_reaches_caller_without_recovery_writes', () => {
  const storage = storageFixture();
  const cause = new Error('access denied');
  storage.getItem = () => { throw cause; };
  assert.throws(() => loadState(storage), error => error === cause || error.cause === cause);
  assert.deepEqual(storage.calls, []);
});

test('storage_clear_removes_only_own_key', () => {
  const storage = storageFixture(JSON.stringify(stateFixture()));
  storage.values.set('other-app', 'keep me');
  clearState(storage);
  assert.deepEqual(storage.calls, [['removeItem', key]]);
  assert.equal(storage.values.has(key), false);
  assert.equal(storage.values.get('other-app'), 'keep me');
});

test('storage_clear_failure_reaches_caller_and_preserves_data', () => {
  const original = JSON.stringify(stateFixture());
  const storage = storageFixture(original);
  const cause = new Error('access denied');
  storage.removeItem = () => { throw cause; };
  assert.throws(() => clearState(storage), error => error === cause || error.cause === cause);
  assert.equal(storage.values.get(key), original);
});
