import { validateScore } from './tournament.js';

const key = 'ecreopadel.americano.v1';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const strings = (value, length) => Array.isArray(value) && value.length === length && value.every(item => typeof item === 'string');

function requireValid(condition, detail) {
  if (!condition) throw new Error(`Den gemte tilstand er ugyldig: ${detail}.`);
}

function validateState(state) {
  requireValid(object(state) && state.version === 1, 'ukendt format eller version');
  requireValid(object(state.draft) && ['names', 'doubles', 'singles', 'points'].every(field => typeof state.draft[field] === 'string'), 'opsætningskladde');
  if (state.tournament === null) return;
  const tournament = state.tournament;
  requireValid(object(tournament), 'turnering');
  requireValid(Array.isArray(tournament.players) && tournament.players.length >= 2, 'deltagere');
  const players = new Set();
  const names = new Set();
  for (const player of tournament.players) {
    requireValid(object(player) && text(player.id) && text(player.name), 'deltager-id eller navn');
    const name = player.name.trim().toLocaleLowerCase('da');
    requireValid(!players.has(player.id) && !names.has(name), 'dublet blandt deltagere');
    players.add(player.id);
    names.add(name);
  }
  requireValid(Array.isArray(tournament.courts) && tournament.courts.length > 0, 'baner');
  const courts = new Map();
  for (const court of tournament.courts) {
    requireValid(object(court) && text(court.id) && ['double', 'single'].includes(court.type), 'bane-id eller banetype');
    requireValid(!courts.has(court.id), 'dublet blandt baner');
    courts.set(court.id, court.type);
  }
  const doubles = tournament.courts.filter(court => court.type === 'double');
  const singles = tournament.courts.filter(court => court.type === 'single');
  requireValid(doubles.length * 4 <= players.size && singles.length <= Math.floor(players.size / 2), 'antal baner og deltagere');
  const activeCourts = new Set([...doubles, ...singles.slice(0, Math.floor((players.size - doubles.length * 4) / 2))].map(court => court.id));
  requireValid(Number.isSafeInteger(tournament.points) && tournament.points > 0, 'pointtal');
  requireValid(Array.isArray(tournament.rounds), 'runder');
  tournament.rounds.forEach((round, index) => {
    requireValid(object(round) && round.number === index + 1 && ['rotation', 'balanced'].includes(round.phase)
      && [1, 2, 3].includes(round.cooldown), 'rundenummer, fase eller cooldown');
    requireValid(Number.isSafeInteger(round.repeatedPairs) && round.repeatedPairs >= 0 && round.repeatedPairs <= doubles.length * 2, 'gentagne makkerpar');
    requireValid(Array.isArray(round.matches) && round.matches.length === activeCourts.size, 'antal kampe i runden');
    const usedCourts = new Set();
    const participants = new Set();
    for (const match of round.matches) {
      requireValid(object(match) && activeCourts.has(match.courtId) && !usedCourts.has(match.courtId), 'ukendt, ubrugt eller gentaget bane i runden');
      usedCourts.add(match.courtId);
      const teamSize = courts.get(match.courtId) === 'double' ? 2 : 1;
      requireValid(Array.isArray(match.teams) && match.teams.length === 2 && match.teams.every(team => strings(team, teamSize)), 'holdstørrelse');
      for (const id of match.teams.flat()) {
        requireValid(players.has(id) && !participants.has(id), 'ukendt eller gentaget deltager i runden');
        participants.add(id);
      }
      requireValid(match.score === null || validateScore(match.score, tournament.points), 'resultat');
      requireValid(strings(match.draft, 2), 'scorekladde');
    }
    requireValid(Array.isArray(round.resting), 'pauser');
    for (const id of round.resting) {
      requireValid(players.has(id) && !participants.has(id), 'ukendt eller gentaget deltager blandt pauser');
      participants.add(id);
    }
    requireValid(participants.size === players.size, 'manglende deltagere eller pauser');
  });
}

export function loadState(storage) {
  let saved;
  try {
    saved = storage.getItem(key);
  } catch (cause) {
    throw new Error('Den gemte turnering kunne ikke læses fra browseren.', { cause });
  }
  if (saved === null) return null;
  let state;
  try {
    state = JSON.parse(saved);
  } catch (cause) {
    throw new Error('Den gemte tilstand indeholder ugyldig JSON.', { cause });
  }
  validateState(state);
  return state;
}

export function saveState(storage, state) {
  try {
    storage.setItem(key, JSON.stringify(state));
  } catch (cause) {
    throw new Error('Ændringen kunne ikke gemmes i browseren.', { cause });
  }
}

export function clearState(storage) {
  try {
    storage.removeItem(key);
  } catch (cause) {
    throw new Error('Den gemte turnering kunne ikke slettes fra browseren.', { cause });
  }
}
