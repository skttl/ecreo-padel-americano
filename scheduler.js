import { history, standings, pairKey } from './tournament.js';

function compare(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

export function generateRound(tournament) {
  const ids = tournament.players.map(p => p.id).sort();
  const doubles = tournament.courts.filter(c => c.type === 'double');
  const singles = tournament.courts.filter(c => c.type === 'single').slice(0, Math.floor((ids.length - doubles.length * 4) / 2));
  const previous = history(tournament);
  const phase = doubles.length && previous.coveredPairs < previous.totalPairs ? 'rotation' : 'balanced';
  const strength = new Map(standings(tournament).map(row => [row.id, row.played ? row.pointsPerMatch : tournament.points / 2]));
  const lastPlayed = new Map(ids.map(id => [id, 0]));
  tournament.rounds.forEach((round, index) => round.matches.forEach(match => match.teams.flat().forEach(id => lastPlayed.set(id, index + 1))));
  const singleCourts = new Set(singles.map(court => court.id));
  const singleLast = new Map();
  tournament.rounds.forEach((round, index) => round.matches.filter(match => singleCourts.has(match.courtId)).forEach(match => singleLast.set(pairKey(match.teams[0][0], match.teams[1][0]), index + 1)));
  const pairs = [];
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
    const team = [ids[a], ids[b]];
    const last = previous.partners.get(pairKey(...team));
    pairs.push({ team, repeated: Number(Boolean(last)), gap: last ? Math.min(...team.map((id, i) => previous.played.get(id) - last.played[i])) : Infinity });
  }

  function search(cooldown, onlyNew) {
    const allowed = pairs.filter(pair => pair.gap >= cooldown && (!onlyNew || !pair.repeated));
    let best = null;
    let bestCost = null;
    const used = new Set();
    const teams = [];

    function finish(singleIds, repeated, pairAge) {
      const participating = new Set([...used, ...singleIds]);
      const played = ids.map(id => previous.played.get(id) + Number(participating.has(id)));
      const singleSet = new Set(singleIds);
      const singleCounts = ids.map(id => previous.singles.get(id) + Number(singleSet.has(id)));
      const leastPlayed = new Set(ids.filter((_, index) => played[index] === Math.min(...played)));
      const futureOptions = allowed.filter(pair => pair.team.every(id => leastPlayed.has(id))).length;
      const potentialAge = phase === 'balanced' ? allowed.filter(pair => pair.team.every(id => used.has(id))).reduce((sum, pair) => sum + pair.gap, 0) : 0;
      const cost = [
        ...(phase === 'rotation' ? [repeated] : []),
        Math.max(...played) - Math.min(...played), played.reduce((sum, value) => sum + value * value, 0),
        Math.max(...singleCounts) - Math.min(...singleCounts), singleCounts.reduce((sum, value) => sum + value * value, 0),
        ...ids.filter(id => participating.has(id)).map(id => lastPlayed.get(id)).sort((a, b) => b - a),
        -futureOptions,
        ...(phase === 'balanced' ? [-potentialAge] : []),
      ];
      if (bestCost && compare(cost, bestCost.slice(0, cost.length)) > 0) return;
      const matches = [];

      // Fix the first remaining team to remove mirrored match and court permutations.
      function pairOpponents(remainingTeams, remainingSingles, difference, singleAge) {
        if (remainingTeams.length) {
          const first = remainingTeams[0];
          for (let i = 1; i < remainingTeams.length; i++) {
            const second = remainingTeams[i];
            matches.push({ courtId: doubles[matches.length].id, teams: [first, second], score: null, draft: ['', ''] });
            pairOpponents(remainingTeams.filter((_, index) => index !== 0 && index !== i), remainingSingles,
              difference + Math.abs(first.reduce((s, id) => s + strength.get(id), 0) - second.reduce((s, id) => s + strength.get(id), 0)), singleAge);
            matches.pop();
          }
          return;
        }
        if (remainingSingles.length) {
          const first = remainingSingles[0];
          for (let i = 1; i < remainingSingles.length; i++) {
            const second = remainingSingles[i];
            matches.push({ courtId: singles[matches.length - doubles.length].id, teams: [[first], [second]], score: null, draft: ['', ''] });
            pairOpponents([], remainingSingles.filter((_, index) => index !== 0 && index !== i),
              difference + Math.abs(strength.get(first) - strength.get(second)),
              singleAge + tournament.rounds.length + 1 - (singleLast.get(pairKey(first, second)) ?? 0));
            matches.pop();
          }
          return;
        }
        const fullCost = [...cost, ...(phase === 'balanced' ? [difference, -pairAge] : []), -singleAge];
        if (!bestCost || compare(fullCost, bestCost) < 0) {
          bestCost = fullCost;
          best = { number: tournament.rounds.length + 1, phase, cooldown, repeatedPairs: repeated,
            matches: matches.map(m => ({ ...m, teams: m.teams.map(team => [...team]), draft: [...m.draft] })), resting: ids.filter(id => !participating.has(id)) };
        }
      }
      pairOpponents(teams, singleIds, 0, 0);
    }

    function chooseSingles(available, start, selected, repeated, pairAge) {
      if (selected.length === singles.length * 2) return finish(selected, repeated, pairAge);
      const needed = singles.length * 2 - selected.length;
      for (let i = start; i <= available.length - needed; i++) {
        selected.push(available[i]);
        chooseSingles(available, i + 1, selected, repeated, pairAge);
        selected.pop();
      }
    }

    function chooseTeams(start, repeated, pairAge) {
      if (bestCost && phase === 'rotation' && repeated > bestCost[0]) return;
      if (teams.length === doubles.length * 2) {
        chooseSingles(ids.filter(id => !used.has(id)), 0, [], repeated, pairAge);
        return;
      }
      for (let i = start; i < allowed.length; i++) {
        const pair = allowed[i];
        if (pair.team.some(id => used.has(id))) continue;
        pair.team.forEach(id => used.add(id));
        teams.push(pair.team);
        chooseTeams(i + 1, repeated + pair.repeated, pairAge + pair.gap);
        teams.pop();
        pair.team.forEach(id => used.delete(id));
      }
    }
    chooseTeams(0, 0, 0);
    return best;
  }

  if (phase === 'rotation') {
    for (const cooldown of [3, 2, 1]) {
      const fresh = search(cooldown, true);
      if (fresh) return fresh;
    }
  }
  for (const cooldown of [3, 2, 1]) {
    const round = search(cooldown, false);
    if (round) return round;
  }
  return null;
}
