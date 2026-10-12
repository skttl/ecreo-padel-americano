function fieldError(field, message) {
  const error = new Error(message);
  error.field = field;
  throw error;
}

function integerInput(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return null;
  const number = Number(value.trim());
  return Number.isSafeInteger(number) ? number : null;
}

export function createTournament(draft) {
  const names = typeof draft.names === 'string' ? draft.names.split(/\r?\n/).map(name => name.trim()).filter(Boolean) : [];
  if (!names.length) fieldError('names', 'Indtast mindst to deltagere.');
  if (new Set(names.map(name => name.toLocaleLowerCase('da'))).size !== names.length) {
    fieldError('names', 'Deltagernavne skal være forskellige.');
  }
  const doubles = integerInput(draft.doubles);
  const singles = integerInput(draft.singles);
  const points = integerInput(draft.points ?? '16');
  if (doubles === null) fieldError('doubles', 'Antal doublebaner skal være et ikke-negativt heltal.');
  if (singles === null) fieldError('singles', 'Antal singlebaner skal være et ikke-negativt heltal.');
  if (doubles === 0 && singles === 0) fieldError('doubles', 'Vælg mindst én bane.');
  if (points === null || points < 1) fieldError('points', 'Point pr. kamp skal være et positivt heltal.');
  if (names.length < Math.max(2, doubles * 4)) fieldError('names', 'Der er ikke deltagere nok til de valgte doublebaner eller en singlekamp.');
  if (singles > Math.floor(names.length / 2)) fieldError('singles', 'Antal singlebaner må ikke overstige antallet af deltagerpar.');
  return {
    players: names.map((name, index) => ({ id: `p${index + 1}`, name })),
    courts: [
      ...Array.from({ length: doubles }, (_, index) => ({ id: `double${index + 1}`, type: 'double' })),
      ...Array.from({ length: singles }, (_, index) => ({ id: `single${index + 1}`, type: 'single' })),
    ],
    points,
    rounds: [],
  };
}

export function validateScore(score, points) {
  return Number.isSafeInteger(points) && points > 0 && Array.isArray(score) && score.length === 2
    && score.every(value => Number.isSafeInteger(value) && value >= 0 && value <= points)
    && score[0] + score[1] === points;
}

export function scoreFromInput(value, teamIndex, points) {
  const score = integerInput(value);
  if (score === null || (teamIndex !== 0 && teamIndex !== 1) || !Number.isSafeInteger(points) || points < 1 || score > points) return null;
  return teamIndex === 0 ? [score, points - score] : [points - score, score];
}

export function standings(tournament) {
  const rows = new Map(tournament.players.map(player => [player.id, { ...player, points: 0, pointsPerMatch: 0, played: 0, wins: 0, singles: 0, rank: 0 }]));
  const courtTypes = new Map(tournament.courts.map(court => [court.id, court.type]));
  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      if (!validateScore(match.score, tournament.points)) continue;
      match.teams.forEach((team, index) => {
        const won = match.score[index] > match.score[1 - index];
        const points = match.score[index] + (won ? Math.ceil(tournament.points / 10) : 0);
        for (const id of team) {
          const row = rows.get(id);
          row.points += points;
          row.played += 1;
          row.wins += Number(won);
          row.singles += Number(courtTypes.get(match.courtId) === 'single');
        }
      });
    }
  }
  for (const row of rows.values()) row.pointsPerMatch = row.played ? row.points / row.played : 0;
  const sorted = [...rows.values()].sort((a, b) => b.pointsPerMatch - a.pointsPerMatch || a.name.localeCompare(b.name, 'da'));
  sorted.forEach((row, index) => {
    row.rank = index && row.pointsPerMatch === sorted[index - 1].pointsPerMatch ? sorted[index - 1].rank : index + 1;
  });
  return sorted;
}

// Pair keys and the ids/played arrays use the same lexical id order.
export function pairKey(a, b) {
  return JSON.stringify([a, b].sort());
}

export function history(tournament) {
  const played = new Map(tournament.players.map(player => [player.id, 0]));
  const singles = new Map(played);
  const partners = new Map();
  const courtTypes = new Map(tournament.courts.map(court => [court.id, court.type]));
  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      const single = courtTypes.get(match.courtId) === 'single';
      for (const id of match.teams.flat()) {
        played.set(id, played.get(id) + 1);
        if (single) singles.set(id, singles.get(id) + 1);
      }
      if (!single) {
        for (const team of match.teams) {
          const ids = [...team].sort();
          partners.set(pairKey(...ids), { ids, played: ids.map(id => played.get(id)) });
        }
      }
    }
  }
  return { played, singles, partners, coveredPairs: partners.size, totalPairs: tournament.players.length * (tournament.players.length - 1) / 2 };
}
