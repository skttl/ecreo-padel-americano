# Americreo

En dansk turneringsapp til én enhed. Ingen installation af pakker eller konto kræves. Brug en moderne browser og Node.js 22 eller nyere.

## Start

Kør `npm start` i projektmappen, og åbn [http://127.0.0.1:4173](http://127.0.0.1:4173). Serveren lytter kun på denne computer. Behold samme adresse og port: browserens gemte data tilhører adressen. Direkte åbning af HTML-filen understøttes ikke.

Indtast ét navn pr. linje, antal baner og point pr. kamp (standard 16). Start finder første runde. Doublebaner fyldes først; en singlebane står ubrugt, hvis der ikke er mindst to spillere tilbage. Flere deltagere giver pauser på skift.

Indtast score for ét hold; det andet udfyldes automatisk. Begge felter kan redigeres. Ved tom eller ugyldig kladde bevares sidste komplette resultat og stilling, og næste runde låses, indtil kladden er rettet. Historik giver mulighed for at rette tidligere resultater uden at ændre hold, der allerede er genereret.

Stillingen viser totalpoint, kampe, sejre og singlekampe. Placering beregnes efter point pr. spillet kamp, inklusive vinderbonus på 10 % af kampens pointtal, rundet op. Samme gennemsnit giver samme placering.

Makkerrotation forsøger nye par først. En nødvendig gentagelse vises på runden. Makkerpausen forsøges med 3, 2 og 1 mellemliggende spillede kampe. Pauser tæller ikke. Efter fuld makkerdækning balanceres hold efter resultater. En umulig runde giver en fejl og mulighed for at prøve igen.

## GitHub Pages

`npm run build` samler kun appens syv offentlige filer i `dist/`. Workflowet `.github/workflows/pages.yml` kører alle tests, bygger og deployer ved hvert push til `master`; det kan også startes manuelt fra GitHub Actions. Pages skal bruge **GitHub Actions** som kilde. Ingen pakkeinstallation er nødvendig.

Den hostede app og localhost har hver deres browserlagring. En eksisterende lokal turnering flyttes ikke automatisk til Pages-adressen.

## Lokale data

Opsætning, runder, resultater og scorekladder gemmes synkront efter hver ændring under browsernøglen `ecreopadel.americano.v1`. Status **Gemt** vises kun efter vellykket skrivning. **Ikke gemt** betyder, at de seneste ændringer kan gå tabt, hvis siden lukkes. Ugyldige gemte data bevares, indtil nulstilling bekræftes. Nulstilling sletter kun appens egen nøgle. Ny turnering kræver bekræftelse før erstatning.

Data deles ikke mellem browsere, profiler eller enheder. Privat browsing kan slette data, når den private session lukkes; rydning af browserdata kan også slette turneringen. Synkron browserlagring og genindlæsning er ingen garanti mod diskfejl eller operativsystemnedbrud. Der er ingen eksport eller backup i denne version.

## Test

Kør `npm test` for domæne-, generator-, lagrings-, simulations- og servertests. Generatorens større simulationer kan tage et par minutter. `node --test tests/server.test.js` kører den hurtige kontrol af HTTP-metoder, modul-MIME-type, HEAD og afvisning af traversal/private filer.

Browserkontrol skal også omfatte score-autoudfyldning i begge retninger, rettelser, fokus, genindlæsning, gemningsfejl og layout ved 1280 × 720, 1440 × 900 samt mobilbredde. Node-tests alene dokumenterer ikke disse browserinteraktioner eller en egentlig crash-/diskgaranti.
