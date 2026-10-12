# Verifikation — 12. oktober 2026

## Statistikfanen

Alle syv godkendte statistikker er implementeret: hyppigste og bedste makkerpar, makkerdækning, fair fordeling, hyppigste modstandere, form og tætteste kampe. Beregningerne bruger eksisterende turneringsdata uden nyt lagringsformat. Otte målrettede tests dækker tomme resultater, bonus og rettelser, modstandere i begge banetyper, planlagt makkerdækning/gentagelser, kamp-/pausefordeling, form/sejrsstimer, tætte kampe og dansk navnesortering. Den samlede suite bestod med 223 tests, 0 fejl og 0 oversprungne tests på 118 sekunder.

Browserkontrol verificerede alle syv sektioner, tomme resultater, makkerdækning før scoring, 9–7/8–8, historisk korrektion, Escape/fokus og synlig stilling ved 1280 × 720 og 390 × 844 uden sideoverflow. Statistikpanelet ruller internt. Uafhængigt review af UI og beregninger havde ingen udestående fund efter rettelse af fokus ved worker-opdatering. Ingen faktiske browsercrashes blev testet.

## GitHub Pages

Efter hostingopsætningen bestod den samlede suite med 215 tests, 0 fejl og 0 oversprungne tests på 110 sekunder. `npm run build` og en assert-baseret kontrol verificerede de syv offentlige filer samt relative app-stier under `/ecreo-padel-americano/`. Workflowet bestod checksum-verificeret actionlint 1.7.7. Workflowet kører tests, bygger og deployer automatisk ved push til `master`. Repo og Pages er offentlige efter udtrykkelig brugergodkendelse. Browserens lagrede turneringsdata indgår ikke i repo eller build.

## Opfølgning: Americreo og makkerreglen

Appens navn er ændret til Americreo uden ændring af lagringsnøglen eller gemte turneringer. Navnet er verificeret i browserens titel og header.

En ekstra målrettet test, `necessary_rotation_exception_can_precede_individual_partner_completion`, dokumenterer en begrænsning: med 11 spillere, to doublebaner, én singlebane og uafgjorte resultater gentages p1/p10 i runde 14. p10 mangler stadig p9. Runden angiver to nødvendige gentagne par; alle spillere fuldfører makkerrotationen i runde 15. Reglen garanterer altså nye par, når en hel runde med nye par findes, men den godkendte nødvendige undtagelse garanterer ikke individuel fuld makkerdækning før første gentagelse. Generatoren er uændret. `node --test tests/scheduler.test.js` bestod med 14/14 tests efter tilføjelsen; hele suiten blev ikke genkørt til denne navneændring og verificering.

Den sidste samlede kørsel (`npm test -- --test-reporter=tap`) bestod med 214 tests, 0 fejl og 0 oversprungne tests på 106 sekunder. Ingen funktionelle ændringer efter denne kørsel. Uafhængige subagenter gennemgik domæne, generator, lagring, UI og det samlede projekt; afsluttende review havde ingen udestående fund.

## Simulationer

135 simulationstests: 39 gyldige opsætninger med 2–12 deltagere, højst to doublebaner og én singlebane, hver med tre resultatprofiler og deltagerantal × 4 runder. Hertil kommer tre eksplicitte syvspillerregressioner over 28 runder og 15 tests af de fem ønskede opsætninger over 18 runder.

Alle sluttede med højst én kamps forskel. Optællingen er uafhængig af appens stillingsberegning og kontrollerer også baner, holdstørrelser, pauser, unikke spillere og makkerpause.

| Deltagere | Double / single | Runder | Kampe pr. deltager |
|---|---|---|---|
| 5 | 1 / 1 | 18 | 14–15; singlebanen ubrugt |
| 6 | 1 / 1 | 18 | 18 |
| 7 | 1 / 1 | 18 | 15–16 |
| 10 | 2 / 1 | 18 | 18 |
| 11 | 2 / 1 | 18 | 16–17 |
| 7 | 1 / 1 | 28 | 24 |

## Browserkontrol

Kontrolleret i Codex-browseren:

- Begge scorefelter udfylder modstanderen; 4 giver 12, og ændring til 7 giver 9. Vinderbonus giver 11/7, og 8/8 giver begge 8.
- Fokus og indtastning af 16 fungerer. Tom kladde blokerer næste runde og bevarer sidste komplette resultat; kladden gendannes efter genindlæsning.
- Opsætning, hold, resultater og næste runde gendannes. Lukning og genåbning af fanen gendanner også data.
- Historiske rettelser opdaterer stillingen straks og ændrer ikke eksisterende hold. Historik vises ved siden af den synlige stilling. Escape gendanner aktuelle kampe og knapfokus.
- Ens point pr. kamp giver fælles placering trods forskellige totalpoint. Den konkrete 33/3-mod-40/4-rangering er dækket af automatiske domænetests, ikke en browserfixture.
- Fem deltagere bruger kun doublebanen; seks bruger begge baner.
- Seks deltagere dækkede 14/15 makkerpar uden gentagelse efter syv runder. Runde otte viste én nødvendig gentagelse og fuldførte 15/15. Undtagelsesbeskeden blev gendannet efter genindlæsning.
- Otte deltagere, begge baner, stilling, gemningsstatus og næste-knap er synlige ved 1280 × 720 og 1440 × 900. Mobilbredde 390 × 844 samt 12 lange navne og tre baner blev kontrolleret; større paneler ruller internt. HTML i navne vises som tekst.
- Resultatændring under beregning afbryder en forældet næste-runde-beregning. Ingen advarsler eller fejl i browserkonsollen ved afsluttende kontrol.

Forhåndsvisningen i `americano-preview.jpg` bruger opdigtede prøvedeltagere. Den lokale browser er efterladt med denne prøveturnering; vælg **Ny turnering** for at starte jeres egen.

## Konkrete begrænsninger og valg

LocalStorage skrives synkront efter hver ændring. Genindlæsning og fanegenåbning er verificeret, men et faktisk browser-/operativsystemcrash og diskfejl er ikke fremprovokeret. Lagringsfejl og beskadigede data dækkes af 50 automatiske lagringstests og kodegennemgang; live fejlindsprøjtning i browseren blev ikke kørt. Browserdata kan slettes, og der er ingen eksport/backup eller koordinering mellem flere faner.

Fallback 3 → 2 → 1 er implementeret. Der er direkte testbevis for fallback til 2 og asymmetriske makkerpauser, men ingen positiv fixture med en gyldig turneringshistorik, der nødvendiggør fallback til 1, blev fundet.

I makkerrotation prioriteres en hel runde med nye makkerpar. Kun når den er umulig, tillades nødvendige synlige gentagelser. Derefter prioriteres jævn deltagelse, singles og mulighed for fremtidige jævne runder før holdstyrke. Det kan give en lidt større styrkeforskel i en enkelt runde for at undgå senere skæv deltagelse; styrken minimeres blandt lige gode fordelinger.

Projektet havde ingen Git-historik. Implementering og review blev derfor udført i projektmappen med midlertidige reviewrapporter frem for commits/worktrees. Appen er kun startet lokalt og er ikke publiceret.
