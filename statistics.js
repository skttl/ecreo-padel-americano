import { pairKey, validateScore } from './tournament.js';

export function statistics(tournament) {
  const compareNames = (a, b) => a.name.localeCompare(b.name, 'da');
  const players = [...tournament.players].sort(compareNames);
  const names = new Map(players.map(player => [player.id, player.name]));
  const courts = new Map(tournament.courts.map((court, index) => [court.id, { ...court, number: index + 1 }]));
  const hasDoubles = tournament.courts.some(court => court.type === 'double');
  const pairs = new Map();
  const opponents = new Map();
  const coverage = new Map(players.map(player => [player.id, new Map()]));
  const fairness = new Map(players.map(player => [player.id, { ...player, played: 0, doubles: 0, singles: 0, rested: 0 }]));
  const form = new Map(players.map(player => [player.id, { ...player, recent: [], longestWinStreak: 0, streak: 0 }]));
  const closest = [];
  const pair = (map, a, b, results = false) => {
    const key = pairKey(a, b);
    if (!map.has(key)) {
      const ids = [a, b].sort((x, y) => names.get(x).localeCompare(names.get(y), 'da'));
      map.set(key, { ids, names: ids.map(id => names.get(id)), played: 0, ...(results ? { wins: 0, points: 0 } : {}) });
    }
    return map.get(key);
  };
  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      const court = courts.get(match.courtId);
      const double = court.type === 'double';
      if (double) {
        for (const [a, b] of match.teams) {
          coverage.get(a).set(b, (coverage.get(a).get(b) ?? 0) + 1);
          coverage.get(b).set(a, (coverage.get(b).get(a) ?? 0) + 1);
        }
      }
      if (!validateScore(match.score, tournament.points)) continue;
      for (const a of match.teams[0]) for (const b of match.teams[1]) pair(opponents, a, b).played += 1;
      match.teams.forEach((team, index) => {
        const won = match.score[index] > match.score[1 - index];
        const result = won ? 'V' : match.score[index] === match.score[1 - index] ? 'U' : 'T';
        const points = match.score[index] + (won ? Math.ceil(tournament.points / 10) : 0);
        if (double) {
          const row = pair(pairs, ...team, true);
          row.played += 1;
          row.wins += Number(won);
          row.points += points;
        }
        for (const id of team) {
          const row = fairness.get(id);
          row.played += 1;
          row[double ? 'doubles' : 'singles'] += 1;
          const history = form.get(id);
          history.recent.push({ round: round.number, result, points });
          history.streak = won ? history.streak + 1 : 0;
          history.longestWinStreak = Math.max(history.longestWinStreak, history.streak);
        }
      });
      closest.push({ round: round.number, court: court.number, teams: match.teams.map(team => team.map(id => names.get(id))), score: [...match.score], difference: Math.abs(match.score[0] - match.score[1]) });
    }
    if (round.matches.length && round.matches.every(match => validateScore(match.score, tournament.points))) {
      for (const id of round.resting) fairness.get(id).rested += 1;
    }
  }
  const comparePairs = (a, b) => b.played - a.played || a.names[0].localeCompare(b.names[0], 'da') || a.names[1].localeCompare(b.names[1], 'da');
  const fairRows = [...fairness.values()];
  const gaps = Object.fromEntries(['played', 'doubles', 'singles', 'rested'].map(key => {
    const values = fairRows.map(row => row[key]);
    return [key, values.length ? Math.max(...values) - Math.min(...values) : 0];
  }));
  return {
    partners: [...pairs.values()].map(row => ({ ...row, pointsPerMatch: row.points / row.played, winRate: row.wins / row.played })).sort(comparePairs),
    opponents: [...opponents.values()].sort(comparePairs),
    coverage: players.map(player => {
      const partners = coverage.get(player.id);
      return { ...player, unique: partners.size, total: hasDoubles ? players.length - 1 : 0,
        missing: hasDoubles ? players.filter(other => other.id !== player.id && !partners.has(other.id)).map(other => other.name) : [],
        repeats: [...partners.values()].reduce((sum, count) => sum + count - 1, 0) };
    }),
    fairness: fairRows,
    gaps,
    form: [...form.values()].map(({ streak, recent, ...row }) => ({ ...row, recent: recent.slice(-5) })),
    closest: closest.sort((a, b) => a.difference - b.difference || b.round - a.round || a.court - b.court),
  };
}
