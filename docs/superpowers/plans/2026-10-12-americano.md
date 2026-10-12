# Ecreo padel americano Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Byg en dansk padelgenerator med blandede baner, makkerrotation, adaptive cooldown-regler, point, live stilling og lokal gendannelse.

**Architecture:** En statisk webapp med native ES-moduler. Rene turneringsfunktioner beregner historik, point og næste runde; browserkoden håndterer input, rendering og localStorage. Rundevalg kører i en web worker, så beregning ikke blokerer resultatvisning eller browseren.

**Tech Stack:** HTML, CSS, JavaScript, Web Storage, Web Worker, Node.js' indbyggede test runner. Ingen produktionsafhængigheder.

**Spec:** `docs/superpowers/specs/2026-10-12-americano-design.md`

## Global Constraints

- Antal point pr. kamp er et positivt heltal med standardværdi 16.
- For hver ny runde forsøger generatoren med N = 3, derefter N = 2 og til sidst N = 1.
- Begge deltagere skal have spillet mindst N andre kampe siden deres seneste fælles kamp.
- Gem synkront ved hver ændring, også indtastning af navne og scorekladder, og hver genereret runde.
- Ingen backend, login eller synkronisering mellem enheder i denne version.
- Verificer layout ved 1280 × 720 og 1440 × 900 CSS-pixels.
- Dansk brugerflade; tastaturbetjening, tekstbaseret rendering af navne og synlig gemningsstatus.
- Ingen eksisterende Git-repository er til stede. Undlad commits og worktrees, indtil der er et repository; dokumentation og app kan stadig bygges i den nuværende mappe.

## Review Focus

1. Score 0 er et gyldigt tal og må ikke behandles som et tomt felt; test i opgave 1.
2. En spiller med pauser har færre mellemliggende kampe end runder; test cooldown i opgave 2.
3. Gemte navne med HTML og ugyldige id-referencer må ikke blive markup eller give delvist gendannet historik; test i opgave 3 og 4.
4. Rettelse af en tidligere kamp påvirker stilling og næste runde, men flytter ikke spillere i genererede runder; test i opgave 1 og 4.
5. Flere baner eller lang stilling må ikke skubbe handlinger og stilling ud af laptop-overblikket; browserkontrol i opgave 4.

## Filer og data

- `package.json`: private projektmetadata, type module og test/start scripts; ingen dependencies.
- `index.html`, `styles.css`, `app.js`: formular, kompakt sportsspil-layout og browserflow.
- `tournament.js`: validering, pointsystem, stilling og historik.
- `scheduler.js`, `scheduler-worker.js`: søgning efter en hel runde samt worker-entrypoint.
- `storage.js`: valideret læsning og synkron skrivning med injiceret Storage-interface til tests.
- `tests/tournament.test.js`, `tests/scheduler.test.js`, `tests/storage.test.js`: node:test og node:assert/strict.
- `tests/simulation.test.js`: fulde turneringssimulationer med uafhængig optælling af spillede kampe, pauser og singlekampe.
- `server.js`: lille lokal statisk HTTP-server med korrekt MIME-type og afgrænsning til projektfiler.
- `README.md`: start, test, lokale data og kendte begrænsninger.

State er `{version: 1, draft: {names, doubles, singles, points}, tournament: null | Tournament}`. Draft-felter er strenge, så ufuldstændig input kan gemmes.

Tournament er `{players: [{id, name}], courts: [{id, type: 'double' | 'single'}], points: number, rounds: Round[]}`.

Round er `{number, phase: 'rotation' | 'balanced', cooldown: 3 | 2 | 1, repeatedPairs: number, matches: Match[], resting: string[]}`. repeatedPairs tæller tidligere brugte doublemakkerpar i runden; hvis phase er rotation og repeatedPairs > 0, vises en nødvendig rotationsundtagelse.

Match er `{courtId, teams: [string[], string[]], score: null | [number, number], draft: [string, string]}`. En ufuldstændig scorekladde ændrer ikke seneste komplette score, før et nyt gyldigt resultat gemmes.

## Opgave 1: Opsætning, point og historik

**Files:** Create `package.json`, `tournament.js`, `tests/tournament.test.js`.

**Interfaces:** `createTournament(draft) -> Tournament` kaster en feltrelateret fejl ved ugyldig opsætning. `validateScore(score, points) -> boolean`. `standings(tournament) -> [{id, name, points, pointsPerMatch, played, wins, singles, rank}]`, sorteret efter pointsPerMatch faldende og derefter navn; ens pointsPerMatch giver fælles rank. `history(tournament) -> {played, singles, partners, coveredPairs, totalPairs}` med Maps indekseret efter id/parnøgle; seneste makkerskab lagrer begge spilleres antal spillede kampe inklusive fælleskampen.

Scoreinput bruger `scoreFromInput(value: string, teamIndex: 0 | 1, points: number) -> [number, number] | null` i `tournament.js`. En gyldig inputværdi bliver redigeret holds score; det andet holds score er points minus værdien. Null betyder ufuldstændig eller ugyldig kladde.

- [x] Skriv tests før implementering. Assertér `validateScore([0,16],16) === true`, afvis negative, decimaler, tomme input og forkert sum. En 9-7-doublekamp skal give `[11,11,7,7]` i deltagerorden, 8-8 skal give fire gange 8, og singlebonus ved 8/24 point skal være 1/3.
- [x] Test dubletnavne efter trim/case-normalisering, tom deltagerliste, ingen baner og utilstrækkelige spillere. Test fælles placering ved lige point.
- [x] Skriv `standings_orders_by_points_per_match`: en fixture skal give en spiller points=33, played=3 og pointsPerMatch=11, og en anden points=40, played=4 og pointsPerMatch=10; assertér den første rangeres højest trods færre totalpoint. Skriv `standings_equal_averages_share_rank`: 22/2 og 33/3 giver samme rank og navnerækkefølge uanset totalpoint. Skriv `standings_unplayed_has_zero_average`: played=0 giver pointsPerMatch=0 og aldrig NaN/Infinity. Bonus skal indgå i pointsPerMatch, og resultatkorrektion skal genberegne værdien.
- [x] Skriv `score_input_completes_opponent`: assertér scoreFromInput('4',0,16) er [4,12], scoreFromInput('4',1,16) er [12,4], og 0/16/8 giver henholdsvis [0,16]/[16,0]/[8,8] fra hold 0. Test også pointtal 8 og 24. Skriv `score_input_rejects_invalid_drafts`: tom/whitespace, -1, 17 ved 16 point, decimaler og ikke-tal giver null.
- [x] Kør `node --test tests/tournament.test.js`; forvent fejl før modulet er implementeret.
- [x] Implementér funktionerne, inklusive scoreFromInput. Beregn afledte værdier fra historikken i stedet for at gemme tællere. Brug stabile id'er, og valider tal med Number.isSafeInteger. Scoreinput skal kontrollere tom streng før tal-konvertering, så tomt input aldrig bliver til 0.
- [x] Ret et afsluttet resultat fra 9-7 til 8-8 i en fixture med en efterfølgende runde; assertér nye point, uændrede hold og korrekt historik.
- [x] Kør `node --test tests/tournament.test.js`; alle tests skal passere.

## Opgave 2: En hel runde med adaptive cooldown-regler

**Files:** Create `scheduler.js`, `scheduler-worker.js`, `tests/scheduler.test.js`, `tests/simulation.test.js`.

**Interfaces:** Consumes `history(tournament)` og `standings(tournament)`. Produces `generateRound(tournament) -> Round | null`; null betyder, at ingen hel runde findes selv med cooldown 1. Worker modtager Tournament og sender `{round, error}` uden at ændre input.

Doublebaner er altid aktive. Singlebanen er kun aktiv, hvis players.length - 4*doubles >= 2. Inaktive baner har ingen Match; UI finder dem som courtId'er uden kamp. createTournament afviser kun utilstrækkelige deltagere til doublebanerne eller færre end to spillere ved kun singlebaner.

- [x] Skriv tests for fire spillere på én doublebane: første tre runder skal dække alle seks makkerpar, fjerde runde skal bruge cooldown 2; begge spillere med nul mellemliggende kampe skal afvises som makkere. Test fem spillere med én doublebane og én singlebane: opsætningen accepteres, der genereres kun én doublekamp og én pause, og singlebanen har ingen match. Test seks spillere med samme baner: begge baner er aktive. Verifikationsbegrænsning: fallback til 1 er implementeret, men en gyldig historik, der kræver den, er ikke fundet og er ikke direkte bevist af en positiv fixture.
- [x] Skriv en fixture med pauser, hvor den ene spiller har tre andre kampe og den anden én; parret må først være tilladt ved cooldown 1. Assertér en unik deltager pr. runde, korrekte holdstørrelser og alle baner fyldt.
- [x] Test seks spillere på én double- og én singlebane frem til fuld makkerdækning; assertér fremdrift, afsluttet rotation og jævn singlefordeling, hvor reglerne tillader den. Test overskydende spillere med jævn pausefordeling og kun singlebaner med phase balanced.
- [x] Test styrkebalance med historik, hvor alle makkerpar er dækket: et oplagt lige holdvalg skal vælges frem for et tilladt skævt valg med samme spille-/singlefordeling. Test, at en gyldig cooldown 3 aldrig sænkes blot for at få bedre balance.
- [x] Kør `node --test tests/scheduler.test.js`; forvent fejl før implementering.
- [x] Implementér backtracking over baner og ubrugte spillere. Fjern spejlede hold-/banepermutationer. Kontroller par mod hver spillers antal mellemliggende kampe. I rotation søges først en hel runde med kun nye makkerpar; gentagelser er kun tilladt, hvis ingen sådan runde eksisterer. Ved nødvendige gentagelser samt i balanced søges først cooldown 3, derefter 2, derefter 1 og stop fallback, så snart en løsning findes. I rotation minimeres gentagelser, derefter skæv kamp- og singlefordeling; i balanced prioriteres fordeling før styrkeforskel. Beregn fordeling efter den foreslåede runde. Brug deterministisk id-orden som sidste tie-break, og returner repeatedPairs.
- [x] Test `rotation_uses_only_new_partners_when_full_round_exists` samt `rotation_reports_necessary_repeated_pairs`: ingen makker må gentages, når en hel runde med kun nye par findes; en nødvendig undtagelse skal angive det faktiske positive repeatedPairs-tal. Cooldown må ikke omgås for at fuldføre makkerdækning.
- [x] Arbejd med workerens kopi af Tournament. Ved søgefejl skal UI kunne vise fejl og forsøge igen. Afbrydelse eller ressourcefejl må aldrig rapporteres som bevis for umulig cooldown.
- [x] Kør `node --test tests/scheduler.test.js`; alle tests skal passere, og typiske seks-/otte-spillerfixtures må ikke kræve mærkbar ventetid.
- [x] Skriv `simulation_balances_participation` som parameteriseret test for alle 39 gyldige kombinationer: players fra 2 til 12, doubles fra 0 til 2, singles fra 0 til 1, mindst én bane og players >= (doubles > 0 ? 4*doubles : 2). Hver test genererer players*4 runder, indsætter afsluttede resultater og fejler straks, hvis en runde mangler. Brug særskilte lokale tællere over match.teams; kald ikke history/standings for at måle deltagelse.
- [x] Kør hver kombination med tre resultatprofiler: alle kampe 8-8; pseudotilfældige heltal 0–16 med fast seed; 16-0/0-16 skiftevis. Hold random-seed reproducerbart pr. scenarie. Det er 117 simulationer og 3852 runder i alt. Testnavne inkluderer deltagerantal, banetal og resultatprofil, så fejl kan findes igen.
- [x] Assertér i hver runde, at alle aktive courtId'er findes præcis én gang og inaktive singlebaner slet ikke findes i matches, holdstørrelser passer til banetypen, ingen spiller optræder to gange, og resting er præcis komplementet af spillerne på banerne. Verificer anvendt cooldown via en uafhængig historik over hver spillers kampnumre og seneste makkerskab.
- [x] Efter hver simulation: `assert.ok(Math.max(...played) - Math.min(...played) <= 1, diagnostic)`. Diagnostic indeholder scenario, profil og hver spillers played/singles/rested. Beregn activeSingles som singles, hvis players - 4*doubles >= 2, ellers 0. Assertér også, at summen af played er rounds*(4*doubles+2*activeSingles), og at hver spillers played+rested er rounds. Single- og pausefordeling skal tælles uafhængigt og fremgå af rapporten.
- [x] Tilføj `simulation_seven_players_mixed_courts`: 7 deltagere, 1 doublebane, 1 singlebane, 28 runder; assertér `assert.deepEqual(played, Array(7).fill(24))` for alle tre resultatprofiler.
- [x] Tilføj `simulation_eighteen_rounds_mixed_courts` for [players,doubles,singles] = [5,1,1], [6,1,1], [7,1,1], [10,2,1], [11,2,1]. Kør præcis 18 runder og alle tre resultatprofiler med samme uafhængige optælling og cooldownkontrol. Assertér max(played)-min(played)<=1 samt præcise mulige tal: 14–15 ved fem spillere, 18 for alle ved seks/ti spillere, 15–16 ved syv, 16–17 ved elleve. Ved fem deltagere skal alle singles-tællere være 0, ingen match bruge singlebanen, og summen af played være 72.
- [x] Kør `node --test tests/simulation.test.js`. Forvent alle 117 matricescenarier, de 15 ekstra 18-runders scenarier og den eksplicitte syvspillerregression bestået. Hvis fairness fejler, ret schedulerens valg og gentag de fejlede scenarier før hele suiten; lemp ikke grænsen, spring ikke scenarier over og stop ikke simulationer tidligt. Ret samtidige prioriteter i specifikationen, hvis testen viser, at maksimering af nye makkerpar først ellers sulter bestemte deltagere.

## Opgave 3: Gemning uden tab ved genindlæsning

**Files:** Create `storage.js`, `tests/storage.test.js`.

**Interfaces:** `loadState(storage) -> State | null` og `saveState(storage, state) -> void`, begge kaster beskrivende fejl. Brug nøgle `ecreopadel.americano.v1`. `clearState(storage) -> void` sletter kun denne nøgle. Browseren videregiver window.localStorage i en try/catch, da også adgang til objektet kan fejle.

- [x] Skriv roundtrip-test med opsætning, én genereret runde, færdig score og ufuldstændig scorekladde; `assert.deepEqual(loadState(fakeStorage), state)`.
- [x] Skriv tests for ugyldig JSON, ukendt version, dublet-id, ukendt spiller i kamp, forkert holdstørrelse og ugyldig score. Load skal fejle uden kald til setItem/removeItem.
- [x] Test Storage, hvis setItem kaster: fejlen skal nå UI, og tidligere lagring skal forblive urørt. Assertér, at clearState ikke kalder clear eller sletter andre nøgler.
- [x] Kør `node --test tests/storage.test.js`; forvent fejl før implementering.
- [x] Implementér form- og referencevalidering ved load. Gem hele state i én setItem uden timer eller unload-handler. Undlad at gemme afledt stilling.
- [x] Kør `node --test tests/storage.test.js`; alle tests skal passere.

## Opgave 4: Laptop-overblik, browserflow og lokal start

**Files:** Create `index.html`, `styles.css`, `app.js`, `server.js`, `README.md`; add start script in `package.json`.

**Interfaces:** Consumes alle ovenstående funktioner og worker. Appen har én state og gemmer efter hver ændring; rendering må ikke ødelægge fokus under indtastning. Næste runde låses under beregning og mens aktuelle resultater mangler.

- [x] Indhent modern-web-guidance for tilgængelige formularer og viewport-layout. Brug frontend-design til den godkendte sportsspilretning. Indfør ingen produktionsafhængigheder.
- [x] Implementér mørkt sportsspil-layout med kompakt header, aktuelle banekort og fast stillingspanel. Ved 1280 × 720 skal én doublebane, én singlebane, otte deltagere, gemningsstatus og næste-runde-knap være synlige samtidigt. Historik og opsætning vises særskilt. Giv panelerne intern rulning ved større opsætninger.
- [x] Vis totalpoint, men render ikke pointsPerMatch-kolonnen. Brug standings' sortering og rank direkte. Den konkrete 33/3-mod-40/4-fixture er verificeret i domænetests. Browseren verificerede fælles placering ved ens gennemsnit trods forskellige totalpoint; den konkrete fixture blev ikke kørt i browseren.
- [x] Implementér labels, feltfejl, resultatrettelser, gemning af kladder og nulstilling med bekræftelse. Navne renderes via textContent. En resultatændring opdaterer stilling straks, når resultatet er gyldigt. Vis faktisk cooldown, fase og makkerdækning.
- [x] Vis inaktiv singlebane som ubrugt med begrundelsen, at der ikke er spillere nok. Opret ingen scorefelter for den, og lad den ikke blokere næste runde. Browserkontroller fem versus seks deltagere på én double- og én singlebane.
- [x] Ved phase rotation og repeatedPairs > 0 vis en tydelig besked om nødvendig gentagelse med antal makkerpar; forklar, at ingen hel runde med kun nye par var mulig. Gem og gendan markeringen med runden.
- [x] Brug scoreFromInput på inputhændelsen fra begge holds felter. Ved gyldigt input opdateres modstanderfeltets value, begge draft-værdier og match.score, hvorefter state gemmes og stillingen opdateres. Bevar fokus og undlad at udsende nye inputhændelser. Ved ugyldig/ufuldstændig input gemmes kladden, seneste komplette score bevares, og næste-runde-knappen blokeres med en synlig forklaring.
- [x] Ved ugyldig lagring vises en fejl, og automatisk gemning blokeres, indtil brugeren udtrykkeligt nulstiller. Ved skrivefejl vises vedvarende ikke-gemt-status; næste vellykkede skrivning kan fjerne fejlen.
- [x] Implementér lokal server med Node http/fs/path, kun GET/HEAD, afvis path traversal og adgang til skjulte filer. Tilføj en assert-baseret kontrol for traversalafvisning og modul-MIME-type. Startscript er `node server.js`; tests er `node --test`.
- [x] Kør `npm test` og serverens selvkontrol; forvent alle tests bestået. Kør `npm start` og åbn den returnerede lokale adresse i browseren.
- [x] Browserkontrol: start seks spillere og blandede baner, registrer 9-7 og 8-8, ret resultat, generer næste runde og genindlæs. Hold, score og kladde skal gendannes identisk. Lagringsfejl er dækket af 50 automatiske tests og review. Live gemningsfejl blev ikke injiceret i browseren; se docs/verification.md.
- [x] Browserkontrol: indtast 4 i hold 0 og verificer 12 i hold 1; ret hold 1 til 7 og verificer 9 i hold 0 samt korrekt vinderbonus. Genindlæs og verificer 9-7. Ryd derefter et felt og verificer synlig ufuldstændig kladde, bevaret seneste komplette stilling og blokeret næste runde.
- [x] Browserkontrol ved 1280 × 720, 1440 × 900 og mobilbredde: aktuelle kampe og stilling forbliver tilgængelige, ekstra baner bruger intern rulning, lange navne ødelægger ikke scorer, og tastatur kan nå alle handlinger. Et navn med HTML-tegn vises som tekst.
- [x] Dokumentér brug, testkommando, stabil origin, privat browsing og browserdata. Rapportér hvilke browser- og crashkontroller der faktisk blev kørt; undlad at kalde genindlæsningstest en egentlig crash-/diskgaranti.

## Afsluttende kontrol

- [x] Sammenhold implementeringen med specifikationen, især alle-makkerfasen, cooldown efter egne kampe og automatisk gemning.
- [x] Kør hele testsuiten efter sidste funktionelle rettelse. Gennemgå data- og inputgrænser samt schedulerens prioritering.
- [x] Vis appen og rapportér testresultater samt eventuelle konkrete begrænsninger. Publicering er ikke omfattet.
