import { createTournament, scoreFromInput, validateScore, standings, history } from './tournament.js';
import { loadState, saveState, clearState } from './storage.js';
import { statistics } from './statistics.js';

const $ = id => document.getElementById(id);
const freshState = () => ({ version: 1, draft: { names: '', doubles: '1', singles: '1', points: '16' }, tournament: null });
let state = freshState();
let blocked = false;
let pending = false;
let worker = null;
let generationError = '';
let viewingHistory = false;
let viewingStatistics = false;

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
  $('next').disabled = blocked || pending || viewingHistory || viewingStatistics || !tournament || incomplete;
  $('next').textContent = pending ? 'Finder hold…' : generationError ? 'Prøv næste runde igen →' : 'Næste runde →';
  $('next-explanation').textContent = pending ? 'Finder en hel runde med den bedst mulige fordeling.' : viewingHistory || viewingStatistics ? 'Gå tilbage til aktuelle kampe før næste runde.' : generationError || (incomplete ? 'Udfyld eller ret alle scorefelter før næste runde.' : 'Alle resultater er klar.');
}

function renderStandings() {
  const mixedCourts = state.tournament.courts.some(court => court.type === 'double')
    && state.tournament.courts.some(court => court.type === 'single');
  $('double-column').hidden = !mixedCourts;
  $('table-key').textContent = `K kampe · V sejre${mixedCourts ? ' · D double' : ''} · S single`;
  const body = $('standings'); body.replaceChildren();
  for (const row of standings(state.tournament)) {
    const tr = element('tr');
    tr.append(element('td', '', row.rank));
    const name = element('th', '', row.name); name.scope = 'row'; tr.append(name);
    for (const value of [row.points, row.played, row.wins]) tr.append(element('td', '', value));
    const doubles = element('td', '', row.played - row.singles); doubles.hidden = !mixedCourts; tr.append(doubles);
    tr.append(element('td', '', row.singles));
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
  viewingStatistics = false;
  $('statistics-button').setAttribute('aria-pressed', 'false');
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
      if ($('setup').hidden && !viewingHistory && !viewingStatistics) renderGame();
      else { renderStandings(); if (viewingStatistics) renderStatistics(); }
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
  viewingStatistics = false; $('statistics-button').setAttribute('aria-pressed', 'false');
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

function renderStatistics() {
  const restoreFocus = document.activeElement?.id === 'close-statistics';
  const data = statistics(state.tournament);
  const container = $('matches'); container.replaceChildren();
  const heading = element('div', 'history-heading');
  heading.append(element('h2', '', 'Statistik'));
  const close = element('button', '', 'Tilbage til aktuelle kampe'); close.id = 'close-statistics';
  close.addEventListener('click', closeStatistics); heading.append(close); container.append(heading);
  container.append(element('p', 'muted stats-note', 'Resultater tæller registrerede kampe, inklusive vinderbonus. Makkerdækning tæller også planlagte par. Pauser tæller kun i runder med alle resultater registreret.'));
  function section(title, note, headers, rows) {
    const card = element('section', 'stats-card'); card.append(element('h3', '', title));
    if (note) card.append(element('p', 'muted stats-note', note));
    if (!rows.length) card.append(element('p', 'muted', 'Ingen registrerede kampe endnu.'));
    else {
      const scroll = element('div', 'stats-scroll'); const table = element('table');
      const caption = element('caption', 'sr-only', title); table.append(caption);
      const head = element('thead'); const labels = element('tr');
      headers.forEach(text => { const cell = element('th', '', text); cell.scope = 'col'; labels.append(cell); }); head.append(labels); table.append(head);
      const body = element('tbody');
      rows.forEach(values => { const row = element('tr'); values.forEach((value, index) => { const cell = element(index ? 'td' : 'th', '', value); if (!index) cell.scope = 'row'; row.append(cell); }); body.append(row); });
      table.append(body); scroll.append(table); card.append(scroll);
    }
    container.append(card);
  }
  const pairName = pair => pair.names.join(' + ');
  const average = value => value.toLocaleString('da', { maximumFractionDigits: 2 });
  section('Hyppigste makkerpar', '', ['Makkerpar', 'Kampe'], data.partners.map(pair => [pairName(pair), pair.played]));
  const best = [...data.partners].sort((a, b) => b.pointsPerMatch - a.pointsPerMatch || b.played - a.played || pairName(a).localeCompare(pairName(b), 'da'));
  section('Bedste makkerpar', 'Sorteret efter point pr. kamp. Vurder gennemsnittet sammen med antal kampe.', ['Makkerpar', 'Point/kamp', 'Sejre', 'Kampe'], best.map(pair => [pairName(pair), average(pair.pointsPerMatch), `${Math.round(pair.winRate * 100)} %`, pair.played]));
  section('Makkerdækning', 'Gentagelser tælles pr. spiller, når et allerede brugt makkerpar planlægges igen.', ['Spiller', 'Makkere', 'Gentagelser', 'Mangler'], data.coverage.map(row => [row.name, `${row.unique}/${row.total}`, row.repeats, row.missing.join(', ') || 'Ingen']));
  section('Fair fordeling', `Største forskel: ${data.gaps.played} kampe · ${data.gaps.doubles} double · ${data.gaps.singles} single · ${data.gaps.rested} pauser.`, ['Spiller', 'Kampe', 'Double', 'Single', 'Pauser'], data.fairness.map(row => [row.name, row.played, row.doubles, row.singles, row.rested]));
  section('Hyppigste modstandere', 'Individuelle møder på tværs af hold, inklusive singlekampe.', ['Spillerpar', 'Møder'], data.opponents.map(pair => [pair.names.join(' mod '), pair.played]));
  section('Form', 'Seneste fem kampe, ældste først. V = sejr, U = uafgjort, T = tab. Pauser bryder ikke en sejrsstime.', ['Spiller', 'Seneste kampe (point)', 'Længste sejrsstime'], data.form.map(row => [row.name, row.recent.map(match => `R${match.round} ${match.result} (${match.points})`).join(' · ') || 'Ingen kampe', row.longestWinStreak]));
  section('Tætteste kampe', 'Mindste pointforskel først; nyeste runde først ved samme forskel.', ['Kamp', 'Hold', 'Resultat', 'Forskel'], data.closest.map(match => [`R${match.round} · Bane ${match.court}`, match.teams.map(team => team.join(' + ')).join(' mod '), match.score.join('–'), match.difference]));
  if (restoreFocus) close.focus();
}
function closeStatistics() { renderGame(); $('statistics-button').focus(); }
$('statistics-button').addEventListener('click', () => {
  viewingHistory = false; viewingStatistics = true;
  $('history-heading').hidden = true; $('statistics-button').setAttribute('aria-pressed', 'true');
  renderStatistics(); updateNext(); $('close-statistics').focus();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && viewingHistory && !$('game').hidden) { event.preventDefault(); closeHistory(); }
  else if (event.key === 'Escape' && viewingStatistics && !$('game').hidden) { event.preventDefault(); closeStatistics(); }
});
if (state.tournament) renderGame();
