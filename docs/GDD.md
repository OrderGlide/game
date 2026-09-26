# Frost Camp — dokument projektowy gry (GDD)

## 1. Pomysł

Prowadzisz obóz ocalałych w coraz groźniejszych światach. Topory krążące wokół postaci ścinają las w zagrodzie,
nosisz **stos bali** na ladę, ocaleni płacą za drewno, a w kopalni wydobywasz **szmaragdy, diamenty i obsydian**.
Za pieniądze i klejnoty stawiasz wieże z kuszami, zatrudniasz drwali i górników, ulepszasz sprzęt w Kuźni
i bronisz palisady przed falami potworów. Po pokonaniu bossa budujesz **portal do następnego świata**.

**Gatunek:** hybrid-casual: *idle arcade („collect & stack”)* + *tower defense* + długa progresja światów (tryhard).

## 2. Główna pętla

```
las w zagrodzie ──► topory ścinają ──► stos bali ──► lada ──► ocaleni płacą ──► $
kopalnia ──► kilof wydobywa ──► 💚 💎 🟣
$ + klejnoty ──► pola budowy (wieże, drwale, górnicy, palisada) + Kuźnia (ulepszenia) + Sklep
co ~55 s fala potworów ──► wieże + gracz bronią palisady ──► co 10. fala BOSS (wzywany przez gracza) ──► portal ──► nowy świat
```

## 2a. Walka i trudność

- **Fale rosną szybko:** zdrowie potworów +13% na falę, a liczba potworów rośnie co falę.
  Samo jedno ulepszenie wież nie wystarcza: od ok. 6. fali palisada zaczyna obrywać, a od 9. pada, jeśli obóz się nie rozwija.
- **Warianty potworów:**
  - *biegacze* (od fali 4): czerwona opaska, 1,8× szybsi, połowa zdrowia;
  - *opancerzeni* (od fali 7): żelazny hełm, 3,2× zdrowia, 2,4× mocniej biją w palisadę.
- **Przebicie palisady ma skutki:** potwory biegną do pieniędzy, każdy chwyta 6% gotówki i ucieka.
  Złapany i pokonany złodziej upuszcza łup, a ten, który ucieknie za mapę, zabiera go na zawsze.
- **Boss nie przychodzi sam.** Na 10. fali gra czeka, aż gracz naciśnie „⚔️ Wezwij bossa”, więc walkę zaczynasz, gdy jesteś gotowy.
  - **Tarcza:** wieże zadają przez nią tylko 15% obrażeń. Trzeba wyjść za bramę i rozbić ją toporami.
    Wtedy boss jest ogłuszony na 7 s, a wieże biją ×1,5. Potem tarcza wraca.
  - **Uderzenie w ziemię:** czerwony krąg ostrzega przez 1,1 s. Kto zostanie w środku, jest ogłuszony i gubi bale.
  - **Pomocnicy:** przy 66% i 33% zdrowia boss wzywa 3 biegaczy.
  - **Szał:** poniżej 30% zdrowia jest szybszy i bije częściej.
  - **Limit czasu 2 minuty:** jeśli boss przeżyje, wycofuje się. Można go wezwać ponownie po ulepszeniu obozu.
- **Gracz nie siedzi cały czas przy telefonie:**
  - fale stoją, gdy nikt nie dotyka ekranu przez 25 s („⏸ Fale czekają, aż wrócisz”);
  - boss czeka na wezwanie;
  - po powrocie do gry pierwsza fala przychodzi najwcześniej po 45 s.
  - Drwale zarabiają offline do 4 godzin (reklama podwaja nagrodę).

## 3. Światy (6 + nieskończone poziomy trudności)

| # | Świat | Drzewa | Potwory | Ocaleni | Ceny | Siła potworów | Portal |
|---|---|---|---|---|---|---|---|
| 1 | Mroźna Tajga ❄️ | sosny | polarne niedźwiedzie | Mikołaje | ×1 | ×1 | $1.5K, 💚25, 💎6 |
| 2 | Złote Wydmy 🏜️ | palmy | skorpiony | nomadzi | ×3 | ×2.5 | $4.5K, 💚30, 💎15, 🟣3 |
| 3 | Dzika Dżungla 🌴 | drzewa dżungli | goryle | odkrywcy | ×8 | ×6.5 | $12K, 💚35, 💎22, 🟣6 |
| 4 | Mroczne Bagna 🐊 | wierzby | krokodyle | rybacy | ×20 | ×18 | $30K, 💚40, 💎28, 🟣10 |
| 5 | Popielny Szczyt 🌋 | spalone drzewa | golemy lawy | górnicy | ×50 | ×42 | $75K, 💎32, 🟣18 |
| 6 | Kryształowa Kraina 💎 | kryształowe drzewa | kryształowe pająki | czarodzieje | ×120 | ×100 | $180K, 💚50, 💎40, 🟣30 |

Po 6. świecie gra wraca do Tajgi na **Poziomie 2** (ceny ×300, potwory ×400) i tak dalej bez końca.
W każdym świecie obóz budujesz od zera, a klejnoty, ulepszenia z Kuźni, skórki i misje zostają na zawsze.

**Boss** pojawia się co 10 fal: jest 18× silniejszy, 4× mocniej bije w palisadę i ma koronę.
Pokonanie go daje klejnoty i odblokowuje pole portalu.

**Tempo (symulacja bota, `npm run balance`):** 17–32 minuty na świat dla bota, który gra bezbłędnie, ok. 2,5 godziny na wszystkie 6.
Człowiek potrzebuje więcej czasu. Palisada pada 3–9 razy na świat, a bossowie walczą 45–110 s z limitem 120 s.

## 4. Mapa obozu

- **Obóz** w środku: lada z kolejką ocalałych, stos pieniędzy, Kuźnia (kowadło), ognisko, pola budowy.
- **Las w zagrodzie** na północy, za bramą. Drzewa odrastają po 12 s.
- **Kopalnia w zagrodzie** na zachodzie, za bramą: skały z kryształami. Szmaragdy leżą przy wejściu, rzadsze klejnoty dalej.
- **Brama wschodnia** prowadzi na pole bitwy: potwory biją wschodnią palisadę.

## 5. Zasoby i ulepszenia

| Klejnot | Wymagany kilof | HP skały | Odrasta |
|---|---|---|---|
| 💚 szmaragd | 1 | 4 | 26 s |
| 💎 diament | 3 | 6 | 32 s |
| 🟣 obsydian | 6 | 9 | 45 s |

**Pola budowy (za $, w każdym świecie od nowa):** 4 wieże z kuszą, wieża lodowa, ognista, armata, drwal (×3), górnik (×2),
namioty (×3), mocniejsza palisada (×8), **Zbrojownia (×8, +30% obrażeń wszystkich wież za poziom)**, portal.

**Ulepszenia widać na mapie:** modele się zmieniają, a nie tylko dostają nowe części.

| Poziom | Wieże (Zbrojownia) | Palisada i bramy |
|---|---|---|
| start | drewniana wieża z deskami | proste bale, drewniane wrota |
| 2 | okute żelazem, kolce na szczycie | zaostrzone bale z żelaznymi obręczami, nitowane wrota |
| 4 | kamienna z blankami | kamienna podmurówka, bramy z kamiennymi wieżyczkami |
| 6–7 | wyższa, złote obręcze i proporce | pełny kamienny mur z blankami, stalowe wrota ze złotem |
| 8 | królewska, ze świecącym kryształem | – |

Każdy poziom palisady dodatkowo podnosi mur.

**Ceny są zaokrąglone do równych kwot** (20, 120, 250, 400, 900, 1500, 2000, 4500…).

**Kuźnia (za $ i klejnoty, na stałe):**

| Ulepszenie | Efekt | Maks. |
|---|---|---|
| 🎒 Plecak | +4 miejsca na bale | 16 |
| 🪓 Siekiera | 10 tierów (drewniana → gwiezdna): szybsze cięcie, mocniejsze ciosy, inny kolor | 10 |
| 🌀 Wirujące topory | 1 → 4 topory wokół postaci | 4 |
| ⛏️ Kilof | szybsze kopanie, dostęp do diamentów i obsydianu | 10 |
| 👢 Buty | prędkość | 11 |
| 🏹 Moc wież | +20% obrażeń za poziom | 13 |

## 6. Sklep, nagrody dzienne, misje

- **Sklep:** 7 skórek kurtki (za klejnoty), boosty (2× pieniądze, szybkość, 2× cięcie, naprawa palisady),
  darmowa skrzynia co 4 h i skrzynia klejnotów.
- **Nagrody dzienne:** 7-dniowa seria ($, szmaragdy, boost, diamenty, duże $, obsydian, złota skórka).
  Opuszczenie dnia zaczyna serię od nowa.
- **Misje dzienne:** 3 losowe misje dziennie (zetnij bale, obsłuż ocalałych, pokonaj potwory, wydobądź klejnoty,
  zarób $, odeprzyj fale) z nagrodami w klejnotach.
- **Offline:** drwale zarabiają do 4 h pod nieobecność gracza.

## 7. Monetyzacja (zrobione, do podmiany ID przed premierą)

1. **Reklamy z nagrodą** (dobrowolne): podwojenie nagrody dziennej, podwojenie zarobku offline, darmowy boost (co 10 min),
   skrzynia od razu (co 30 min), naprawa palisady podczas przebicia (raz na falę).
2. **Reklamy pełnoekranowe**: najwcześniej po 5 min sesji, co najmniej 4 min odstępu, tylko po odpartej fali (co 3 fale),
   nigdy przy otwartym menu. Znikają po zakupie „Bez reklam” albo pakietu startowego.
3. **Zakupy w aplikacji**: pakiet startowy (klejnoty + Lodowa kurtka + bez reklam), 3 paczki klejnotów, „Bez reklam”.
4. Zgoda RODO przez Google UMP, przywracanie zakupów.

Konfiguracja: `src/platform/config.ts`. Instrukcja podpięcia własnych kont jest w README.

## 8. Roadmapa

- **Teraz:**
  - 6 światów, 6 typów potworów w 3 wariantach, bossowie z tarczą, uderzeniem i szałem;
  - kopalnia, Kuźnia, Zbrojownia, sklep, nagrody i misje dzienne, zapis gry, PL/EN, Android;
  - reklamy i zakupy, wieże specjalne, zwierzaki, namioty, muzyka dla każdego świata;
  - ustawienia, samouczek, tryby grafiki z auto-dopasowaniem;
  - wieże, palisada i bramy zmieniają wygląd z poziomem.
- **Następnie:**
  - powiadomienia („drwale zapełnili magazyn”, „boss czeka”);
  - ranking (najwyższa fala);
  - osiągnięcia Google Play Games.
- **Później:** wydarzenia sezonowe, nowe typy bossów, klany.

## 9. Testy

- `npm run balance`: bot przechodzi wszystkie światy bez grafiki i pokazuje czas, przebicia palisady i przebieg walk z bossami.
- `npm run bench`: przeglądarka bez okna z procesorem spowolnionym 4× (jak tani telefon) i ok. 40 potworami.
  Mierzy czas klatki, liczbę wywołań rysowania, trójkąty i wycieki pamięci.
  Ostatni wynik: cały JS 3–6 ms na klatkę (limit dla 60 FPS to 16,7 ms), 170 wywołań rysowania na niskiej grafice
  i 580 na wysokiej. Po 3 falach brak wycieku geometrii.

## 10. Marketing

Krótkie filmiki (TikTok, Reels, Shorts): wirujące topory kosiące las, kolejka Mikołajów, boss w koronie rozbijający palisadę,
przejście przez portal do nowego świata. Każdy świat to osobny motyw do testowania, który przyciąga najtańsze instalacje.
