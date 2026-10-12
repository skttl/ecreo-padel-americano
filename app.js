import { createTournament, scoreFromInput, validateScore, standings, history } from './tournament.js';
import { loadState, saveState, clearState } from './storage.js';

const $ = id => document.getElementById(id);
const freshState = () => ({ version: 1, draft: { names: '', doubles: '1', singles: '1', points: '16' }, tournament: null });
let state = freshState();
let blocked = false;
let pending = false;
let worker = null;
let generationError = '';
let viewingHistory = false;

function showStorageError(message) {
  $('storage-error').textContent = message;
  $('storage-error').hidden = false;
  $('save-status').textContent = 'Ikke gemt';
  $('save-status').classList.add('failed');
}

function persist() {
  if (blocked) return;
  try {
    saveState(window.localStorage, state);
    $('save-status').textContent = 'Gemt';
    $('save-status').classList.remove('failed');
    $('storage-error').hidden = true;
  } catch (error) { showStorageError(`${error.message} Ændringer er kun tilgængelige, mens siden er åben. Prøv at rette et felt igen.`); }
}

try {
  const loaded = loadState(window.localStorage);
  if (loaded) { state = loaded; $('save-status').textContent = 'Gemt'; }
} catch (error) {
  blocked = true;
  showStorageError(`${error.message} Nulstil gemte data for at fortsætte. De gemte data bliver bevaret indtil da.`);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function complete(match) {
  return validateScore(match.score, state.tournament.points)
    && match.draft.every((value, index) => {
      const score = scoreFromInput(value, index, state.tournament.points);
      return score && score.every((number, side) => number === match.score[side]);
    });
}

function updateNext() {
  const tournament = state.tournament;
  const incomplete = tournament?.rounds.some(round => round.matches.some(match => !complete(match)));
  $('next').disabled = blocked || pending || viewingHistory || !tournament || incomplete;
  $('next').textContent = pending ? 'Finder hold…' : generationError ? 'Prøv næste runde igen →' : 'Næste runde →';
  $('next-explanation').textContent = pending ? 'Finder en hel runde med den bedst mulige fordeling.' : viewingHistory ? 'Gå tilbage til aktuelle kampe før næste runde.' : generationError || (incomplete ? 'Udfyld eller ret alle scorefelter før næste runde.' : 'Alle resultater er klar.');
}

function renderStandings() {
  const body = $('standings'); body.replaceChildren();
  for (const row of standings(state.tournament)) {
    const tr = element('tr');
    tr.append(element('td', '', row.rank));
    const name = element('th', '', row.name); name.scope = 'row'; tr.append(name);
    for (const value of [row.points, row.played, row.wins, row.singles]) tr.append(element('td', '', value));
    body.append(tr);
  }
  $('player-count').textContent = `${state.tournament.players.length} deltagere`;
}

function courtCard(court, match, round) {
  const tournament = state.tournament;
  const number = tournament.courts.indexOf(court) + 1;
  const card = element('article', 'court');
  const heading = element('div', 'court-heading');
  heading.append(element('h3', '', `Bane ${number}`), element('span', 'court-type', court.type === 'double' ? 'Double · 2 mod 2' : 'Single · 1 mod 1'));
  card.append(heading);
  if (!match) { card.append(element('p', 'unused', 'Ubrugt · Der er ikke spillere nok efter fordeling til doublebanerne.')); return card; }
  const content = element('div', 'court-content');
  const inputs = [];
  const message = element('p', 'score-message');
  const messageId = `message-${round.number}-${court.id}`; message.id = messageId;
  const updateMessage = () => {
    const valid = complete(match);
    const invalid = !valid && (match.score !== null || match.draft.some(value => value !== ''));
    message.classList.toggle('invalid', invalid);
    message.textContent = valid ? `Resultat registreret · ${tournament.points} point i alt` : `${invalid ? 'Ufuldstændig eller ugyldig score. ' : ''}Indtast et heltal fra 0 til ${tournament.points}. Modstanderens score udfyldes automatisk.`;
    inputs.forEach(input => input.setAttribute('aria-invalid', String(invalid)));
  };
  match.teams.forEach((team, index) => {
    if (index) content.append(element('span', 'versus', 'VS'));
    const group = element('div', 'team');
    const names = element('div', 'team-names');
    team.forEach(id => names.append(element('div', '', tournament.players.find(player => player.id === id).name)));
    const scoreGroup = element('div');
    const id = `score-${round.number}-${court.id}-${index}`;
    const label = element('label', '', `Hold ${index + 1}`); label.htmlFor = id;
    const input = element('input', 'score'); input.id = id; input.type = 'text'; input.inputMode = 'numeric'; input.autocomplete = 'off'; input.value = match.draft[index];
    input.setAttribute('aria-label', `Runde ${round.number}, bane ${number}, hold ${index + 1}, score`);
    input.setAttribute('aria-describedby', messageId);
    input.addEventListener('input', () => {
      if (pending) stopWorker();
      match.draft[index] = input.value;
      const score = scoreFromInput(input.value, index, tournament.points);
      if (score) {
        match.score = score;
        match.draft = score.map(String);
        inputs.forEach((field, side) => { if (side !== index) field.value = match.draft[side]; });
      }
      persist(); updateMessage(); renderStandings(); updateNext();
    });
    inputs.push(input); scoreGroup.append(label, input); group.append(names, scoreGroup); content.append(group);
  });
  updateMessage(); card.append(content, message); return card;
}

function renderGame() {
  viewingHistory = false;
  $('history-heading').hidden = true;
  const tournament = state.tournament;
  $('setup').hidden = true; $('game').hidden = false; $('cancel-new').hidden = true;
  const round = tournament.rounds.at(-1);
  const coverage = history(tournament);
  $('round-title').textContent = round ? `Runde ${round.number}` : 'Første runde';
  const double = tournament.courts.some(court => court.type === 'double');
  $('round-info').textContent = round ? `${round.phase === 'rotation' ? 'Makkerrotation' : 'Balancerede hold'} · Makkerpause: ${round.cooldown} kampe${round.cooldown < 3 ? ' (kortere pause for at finde en hel runde)' : ''}${double ? ` · Makkere: ${coverage.coveredPairs}/${coverage.totalPairs} par` : ''}` : 'Klar til at finde hold';
  $('round-notice').hidden = !(round?.phase === 'rotation' && round.repeatedPairs > 0);
  $('round-notice').textContent = round ? `Nødvendig rotationsundtagelse: ${round.repeatedPairs} makkerpar gentages. Ingen hel runde med kun nye makkerpar var mulig.` : '';
  $('matches').replaceChildren();
  if (round) for (const court of tournament.courts) $('matches').append(courtCard(court, round.matches.find(match => match.courtId === court.id), round));
  $('resting').replaceChildren();
  if (round?.resting.length) for (const id of round.resting) $('resting').append(element('span', 'chip', tournament.players.find(player => player.id === id).name));
  else $('resting').append(element('span', 'muted', 'Ingen pauser'));
  renderStandings(); updateNext();
}

function generateNext() {
  if (pending || blocked || !state.tournament) return;
  generationError = ''; pending = true; updateNext();
  const tournament = state.tournament;
  const finish = error => {
    worker?.terminate(); worker = null; pending = false;
    generationError = error || ''; updateNext();
  };
  try {
    const activeWorker = new Worker(new URL('./scheduler-worker.js', import.meta.url), { type: 'module' });
    worker = activeWorker;
    activeWorker.onmessage = ({ data }) => {
      if (worker !== activeWorker || state.tournament !== tournament) return;
      if (data.error || !data.round) { finish(data.error || 'Runden kunne ikke beregnes. Prøv igen.'); return; }
      tournament.rounds.push(data.round); finish(); persist();
      if ($('setup').hidden && !viewingHistory) renderGame();
      else renderStandings();
    };
    activeWorker.onerror = event => { event.preventDefault(); if (worker === activeWorker) finish('Runden kunne ikke beregnes. Prøv igen.'); };
    activeWorker.onmessageerror = () => { if (worker === activeWorker) finish('Runden kunne ikke læses. Prøv igen.'); };
    activeWorker.postMessage(tournament);
  } catch { finish('Beregningen kunne ikke starte. Prøv igen.'); }
}

function stopWorker() { worker?.terminate(); worker = null; pending = false; generationError = ''; }

for (const field of ['names', 'doubles', 'singles', 'points']) {
  $(field).value = state.draft[field];
  $(field).disabled = blocked;
  $(field).addEventListener('input', () => {
    state.draft[field] = $(field).value;
    $(`${field}-error`).hidden = true; $(field).removeAttribute('aria-invalid'); persist();
  });
}
$('start').disabled = blocked;
$('setup-form').addEventListener('submit', event => {
  event.preventDefault(); if (blocked) return;
  let tournament;
  try { tournament = createTournament(state.draft); }
  catch (error) {
    const field = error.field || 'names'; $(`${field}-error`).textContent = error.message;
    $(`${field}-error`).hidden = false; $(field).setAttribute('aria-invalid', 'true'); $(field).focus(); return;
  }
  if (state.tournament && !window.confirm('Erstat den gemte turnering? Alle nuværende runder og resultater slettes.')) return;
  stopWorker(); state.tournament = tournament; persist(); renderGame(); generateNext();
});
$('next').addEventListener('click', generateNext);
$('new-button').addEventListener('click', () => {
  $('game').hidden = true; $('setup').hidden = false; $('cancel-new').hidden = false; $('names').focus();
});
$('cancel-new').addEventListener('click', renderGame);
$('reset-button').addEventListener('click', () => {
  if (!window.confirm('Nulstil gemte data? Alle deltagere, runder og resultater slettes.')) return;
  try { clearState(window.localStorage); }
  catch (error) { showStorageError(error.message); return; }
  stopWorker(); blocked = false; state = freshState();
  viewingHistory = false; $('history-heading').hidden = true;
  $('game').hidden = true; $('setup').hidden = false; $('cancel-new').hidden = true;
  for (const field of ['names', 'doubles', 'singles', 'points']) { $(field).value = state.draft[field]; $(field).disabled = false; $(field).removeAttribute('aria-invalid'); $(`${field}-error`).hidden = true; }
  $('start').disabled = false; persist(); $('names').focus();
});
$('history-button').addEventListener('click', () => {
  viewingHistory = true; $('history-heading').hidden = false;
  const container = $('matches'); container.replaceChildren();
  const rounds = state.tournament.rounds.slice(0, -1).reverse();
  if (!rounds.length) container.append(element('p', 'unused', 'Der er ingen tidligere runder endnu.'));
  for (const round of rounds) {
    container.append(element('h3', '', `Runde ${round.number} · ${round.phase === 'rotation' ? 'Makkerrotation' : 'Balancerede hold'} · Makkerpause ${round.cooldown}`));
    if (round.phase === 'rotation' && round.repeatedPairs) container.append(element('p', 'notice', `Rotationsundtagelse: ${round.repeatedPairs} gentagne makkerpar; ingen hel runde med kun nye par var mulig.`));
    for (const match of round.matches) container.append(courtCard(state.tournament.courts.find(court => court.id === match.courtId), match, round));
  }
  updateNext(); $('close-history').focus();
});
function closeHistory() { renderGame(); $('history-button').focus(); }
$('close-history').addEventListener('click', closeHistory);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && viewingHistory && !$('game').hidden) { event.preventDefault(); closeHistory(); }
});
if (state.tournament) renderGame();
