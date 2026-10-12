# Ecreo padel americano

## Formål og omfang

En webapp til at styre en padelturnering på én enhed. Brugeren indtaster deltagere, vælger single- og doublebaner, genererer kampe og registrerer resultater. Den individuelle stilling er altid synlig. Turneringen gemmes automatisk i browserens localStorage og gendannes ved genstart.

Appen bygges med HTML, CSS og JavaScript uden framework eller produktionsafhængigheder. Den serveres over HTTP eller HTTPS på en stabil adresse, fordi localStorage hører til sidens origin. Direkte åbning som file-URL er ikke en understøttet driftsform. Ingen backend, login eller synkronisering mellem enheder i denne version.

## Opsætning

- Ét deltagernavn pr. linje. Tomme linjer ignoreres; navne trimmes. Identiske navne uden hensyn til store/små bogstaver afvises, så resultater kan registreres entydigt. Deltagere får stabile interne id'er.
- Antal doublebaner og antal singlebaner angives hver for sig som ikke-negative heltal. Mindst én bane kræves. En doublebane kræver fire deltagere, en singlebane to.
- Antal singlebaner må ikke overstige antal mulige deltagerpar på én gang, floor(deltagerantal / 2). Urealistiske værdier afvises som feltfejl før banerne oprettes.
- Antal point pr. kamp er et positivt heltal med standardværdi 16.
- Opsætningen skal have deltagere nok til at fylde alle valgte doublebaner samtidigt, eller mindst to deltagere ved kun singlebaner. Doublebaner prioriteres; singlebanen bruges kun, hvis der derefter er mindst to spillere tilbage. Ellers står singlebanen tom. Med fem deltagere, én doublebane og én singlebane spilles derfor kun double, med én pause pr. runde. Ekstra deltagere holder pause på skift.
- Deltagere, baner og pointtal låses, når turneringen starter. En ny turnering kræver bekræftelse, før den erstatter den gemte turnering.

## Runder og første fase

En runde har én kamp på hver aktiv bane. En singlebane uden spillere nok er inaktiv og vises tydeligt som ubrugt; den har ingen kamp eller resultatkrav. En deltager kan højst spille én kamp i en runde. Kampene kan få resultater uafhængigt, men næste runde genereres først, når alle resultater i den aktuelle runde er komplette.

Når der findes doublebaner, skal alle deltagerpar have været makkere mindst én gang, før appen skifter til matchmaking efter styrke. Singlemodstandere tæller ikke som makkere. Generatoren forsøger altid en hel runde med udelukkende nye makkerpar først; blandt disse vælges den mest jævne deltagelse og singlefordeling. Kun hvis ingen sådan runde er mulig, må kendte makkerpar gentages. For en undtagelsesrunde vælges den strengeste mulige cooldown, derefter færrest gentagne makkerpar og den mest jævne deltagelse og singlefordeling. Undtagelsen og antal gentagne makkerpar vises tydeligt på runden. Cooldown gælder også nødvendige gentagelser. Fuld dækning uden nogen gentagelse kan være matematisk umulig, da hver doublekamp bruger to makkerpar, mens nogle deltagerantal har et ulige antal mulige par.

Singlekampe fordeles så jævnt som muligt under de øvrige regler. Lige mange singlekampe på ethvert tidspunkt kan ikke garanteres, når antal deltagere og baner ikke går op. Appen viser både antal spillede kampe og singlekampe pr. deltager.

Ved kun singlebaner er der ingen makkerfase. Appen balancerer kampe efter spillernes resultater fra starten, med variation i modstandere som ekstra hensyn.

## Cooldown og umulige runder

Cooldown gælder gentagne doublemakkere. Begge deltagere skal have spillet mindst N andre kampe siden deres seneste fælles kamp. Singlekampe tæller som mellemliggende kampe; pauser tæller ikke. Nye makkerpar er altid tilladt.

For hver ny runde forsøger generatoren med N = 3, derefter N = 2 og til sidst N = 1. Den vælger den strengeste værdi, hvor en hel runde med alle aktive baner kan genereres, og optimerer dernæst inden for den værdi. Den må ikke vælge en lavere cooldown alene for at opnå bedre styrkebalance eller flere nye makkerpar. Den anvendte værdi vises på runden, og en kortere cooldown forklares i brugerfladen.

Hvis en gyldig runde heller ikke findes ved N = 1, ændres den gemte turnering ikke. Brugeren får en konkret besked om begrænsningen. Cooldown sænkes ikke til nul.

## Efter makkerfasen

Styrke beregnes som gennemsnitlige optjente stillingspoint pr. afsluttet kamp, inklusive vinderbonus. En deltager uden afsluttede kampe behandles som neutral med styrke svarende til halvdelen af kampens pointtal.

Efter valg af den mulige cooldown prioriteres jævn fordeling af kampe og singlekampe. Fordelingen vurderes over flere runder: ventetid siden seneste kamp, bevarede muligheder for lovlige makkere blandt de mindst aktive spillere og den samlede tid siden en deltagergruppes mulige makkere senest spillede sammen bruges også ved valg af deltagere. Denne tidsmargin beskytter mulighederne for fremtidige makkere, så en umiddelbart jævn runde ikke gør de mindst aktive spillere ude af stand til at spille næste gang. Blandt deltagergrupper med samme kampfordeling, singlefordeling, ventetid, fremtidige makkerantal og samlede makkertidsmargin vælges kampe med mindst samlet forskel mellem modstanderholdenes styrke. Inden for samme valgte deltagergruppe prioriteres styrkebalance før tid siden de konkret valgte makkere sidst spillede sammen. Et doubleholds styrke er summen af spillernes styrke; i single bruges spillerens styrke. En lidt mindre lige kamp kan derfor vælges, hvis en anden deltagergruppe ellers risikerer flere pauser senere.

## Resultater og stilling

- Et resultat består af to ikke-negative heltal, hvis sum er turneringens pointtal. Ufuldstændige input tæller ikke som et afsluttet resultat.
- Begge holds scorefelter kan redigeres. Ved indtastning af et gyldigt heltal fra 0 til pointtallet i det ene felt udfyldes det andet automatisk som pointtal minus den indtastede score. Ved 16 point giver indtastning af 4 automatisk 12 til modstanderen. Det komplette resultat gemmes straks, og stillingen opdateres. Ændring i modstanderens felt virker tilsvarende den anden vej uden rekursive inputhændelser eller tab af fokus. Tomme, negative, for store eller ugyldige input må ikke automatisk omdannes til et resultat; den seneste komplette score bevares som gemt resultat, mens kladden vises som ufuldstændig/ugyldig og næste runde blokeres, indtil den er rettet.
- Hver deltager modtager sit holds score. Vinderen får desuden ceil(pointtal / 10) point pr. deltager. Uafgjort giver ingen bonus.
- Ved 16 point giver 8-8 otte point til hver spiller. 9-7 giver elleve til hver spiller på vinderholdet og syv til hver spiller på taberholdet. Bonus er én ved 8 point og tre ved 24 point.
- Resultater kan rettes. Stillingen beregnes fra de aktuelle resultater, så rettelser ikke tæller dobbelt. Rettelser ændrer ikke allerede genererede hold; næste runde bruger de rettede resultater.
- Stillingen har en skjult beregningsværdi med samlede optjente point divideret med antal afsluttede kampe, inklusive vinderbonus. Stillingen sorteres efter denne værdi faldende, så flere spillede kampe ikke i sig selv giver en fordel. Spillere uden afsluttede kampe har værdien 0. Spillere med samme point pr. kamp får samme placering; deres visningsrækkefølge følger navn, og totalpoint bruges ikke som tie-break. Samlede point vises fortsat, mens point pr. kamp ikke renderes som en synlig kolonne.
- Stillingen viser navn, point, spillede kampe, sejre og singlekampe. På store skærme vises den ved siden af kampene; på små skærme er en kompakt stilling fast synlig med intern rulning, mens kampene kan rulles separat.
- Rundevisningen viser banetype, hold, score, pauser, anvendt cooldown og fremdrift i makkerdækningen. Tidligere kampe kan åbnes for resultatkorrektion.

## Gemning og gendannelse

Én versionsmærket JSON-værdi i localStorage indeholder opsætningskladde eller aktiv turnering, deltager-id'er, baner, pointtal, alle genererede runder, gemte resultater og igangværende scoreinput. Afledt stilling og makkerhistorik beregnes igen fra disse data.

Gem synkront ved hver ændring, også indtastning af navne og scorekladder, og hver genereret runde. Gemning må ikke vente på en timer eller på, at siden lukkes. Vis kun status som gemt, når setItem lykkes. Ved normal genåbning gendannes senest gemte tilstand uden at generere nye kampe.

Læsning, JSON-parsning, validering og skrivning håndterer fejl. Ugyldig eller ukendt gemt version må ikke automatisk overskrives; vis fejlen og lad brugeren bekræfte en nulstilling. En skrivefejl skal vise tydeligt, at ændringen ikke er gemt. Kun appens egen nøgle må slettes ved nulstilling.

Dette er lokal genoprettelse efter en browserlukning eller et crash, ikke en backupgaranti mod diskfejl eller et crash midt i en skrivning. Sletning af browserdata, en anden browserprofil eller en anden origin kan gøre data utilgængelige. Privat browsing er ikke egnet til varig opbevaring. Flere samtidige faner er ikke understøttet som redigeringsflow.

## Tilgængelighed og validering

Brug danske tekster, tydelige labels, native formularfelter, tastaturbetjening og synlig fokusmarkering. Fejl knyttes til relevante felter og formidles uden alene at bruge farve. Navne indsættes som tekst, aldrig som HTML. Gemte data valideres som input, før de bruges.

## Udseende og skærmplads

Brugeren ønsker et overskueligt skærmbillede på en 13-tommers laptop og et sportsspilpræg med EA FC som inspiration. Brug eget layout og egne grafiske elementer med mørke flader, tydelig typografi, store scorer, kompakte banekort og en skarp accentfarve.

Verificer layout ved 1280 × 720 og 1440 × 900 CSS-pixels. Header, rundestatus, aktuelle baner, resultatfelter, næste-runde-knap og stilling skal være tilgængelige samtidigt uden rulning af hele siden i en typisk opsætning med én doublebane, én singlebane og seks til otte deltagere. Flere baner og deltagere håndteres med intern rulning i kamp- og stillingspaneler. Opsætning og tidligere runder vises særskilt, så de ikke optager plads i den aktuelle runde. Historikken skal kunne lukkes, så man vender tilbage til det samlede overblik.

Sportsspilpræget må ikke gøre små tal eller labels svære at læse. Ingen dekorative animationer eller eksterne billeder er nødvendige for første version.

## Verifikation

Automatiske tests kontrollerer point og bonus ved 8, 16 og 24 point, uafgjort, resultatkorrektion, ugyldige resultater, deltagerunikhed pr. runde, fulde baner, makkerdækning, single-/pausefordeling, overgang til styrkebalance og cooldown efter den enkelte spillers kamphistorik. Test også fallback til to og én samt afvisning, når én er umulig.

Kontroller automatisk modstanderscore i begge retninger: ved 16 point skal 4 give 12, 0 give 16, 16 give 0 og 8 give 8. Tomme input og værdier uden for intervallet må ikke ændre det gemte resultat. Browserkontrollen verificerer, at rettelse fra modstanderens felt opdaterer begge felter, stilling og localStorage, og at felterne gendannes efter genindlæsning.

Kontroller stillingssortering uafhængigt af totalpoint: en spiller med 33 point i tre kampe placeres over en spiller med 40 point i fire kampe. Spillere med eksempelvis 22 point i to kampe og 33 point i tre kampe får samme placering. Ingen afsluttede kampe må give NaN eller division med nul. Resultatkorrektion genberegner både totalpoint og point pr. kamp.

En simulationssuite dækker alle 39 gyldige kombinationer med 2–12 deltagere, 0–2 doublebaner og 0–1 singlebane, mindst én bane og tilstrækkelige deltagere til doublebanerne eller mindst to til kun single. Singlebanen kan stå ubrugt efter banereglen. Hvert scenarie spiller deltagerantal × 4 runder. Efter simulationen kræves højst én kamps forskel mellem den mest og mindst aktive deltager. En manglende genereret runde er en testfejl, ikke et scenarie der springes over.

Ved syv deltagere, én doublebane og én singlebane simuleres 28 runder. Det giver 168 spillerpladser, så alle syv skal ende med præcis 24 kampe. Testene tæller deltagelse direkte fra genererede hold og ikke via generatorens egne historiktællere.

Kør hvert scenarie med uafgjorte resultater, reproducerbare varierende resultater og skæve resultater. Fairness skal holde, selvom matchmaking får forskellig styrkehistorik. Kontroller også hver rundes unikke deltagere, fyldte baner og cooldown; rapportér singlekampe og pauser pr. deltager. Singlefordelingen verificeres særskilt i relevante fixtures, fordi makker- og cooldownkrav kan begrænse lige fordeling.

Suppler med præcis 18 runder for fem, seks og syv deltagere på én double- og én singlebane samt ti og elleve deltagere på to double- og én singlebane. Kræv højst én kamps forskel. Ved fem deltagere er singlebanen ubrugt i alle runder, og hver spiller skal spille 14 eller 15 doublekampe. Seks og ti deltagere skal alle spille 18 kampe; syv deltagere skal spille 15 eller 16 kampe, og elleve deltagere 16 eller 17 kampe. Gentag med de tre resultatprofiler.

Gemningskontroller omfatter genindlæsning med samme runder, resultater og kladder, skrivefejl samt ugyldig gemt tilstand uden automatisk overskrivning. Brugerfladen kontrolleres i browseren på stor og lille skærm og med tastatur.
