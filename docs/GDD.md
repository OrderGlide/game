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
co ~60 s fala potworów ──► wieże + gracz bronią palisady ──► co 10. fala BOSS ──► portal ──► nowy świat
```

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

**Tempo (symulacja bota):** 25–40 minut na świat, ok. 3 godziny na pierwsze przejście wszystkich 6.
Palisada pada 3 razy w pierwszym świecie i do 21 razy w szóstym, więc trudność wyraźnie rośnie.

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

**Pola budowy (za $, w każdym świecie od nowa):** 4 wieże z kuszą, drwal (×3), górnik (×2), mocniejsza palisada (×8), portal.

**Kuźnia (za $ i klejnoty, na stałe):**

| Ulepszenie | Efekt | Maks. |
|---|---|---|
| 🎒 Plecak | +4 miejsca na bale | 16 |
| 🪓 Siekiera | 10 tierów (drewniana → gwiezdna): szybsze cięcie, mocniejsze ciosy, inny kolor | 10 |
| 🌀 Wirujące topory | 1 → 4 topory wokół postaci | 4 |
| ⛏️ Kilof | szybsze kopanie, dostęp do diamentów i obsydianu | 10 |
| 👢 Buty | prędkość | 11 |
| 🏹 Moc wież | +25% obrażeń za poziom | 13 |

## 6. Sklep, nagrody dzienne, misje

- **Sklep:** 7 skórek kurtki (za klejnoty), boosty (2× pieniądze, szybkość, 2× cięcie, naprawa palisady),
  darmowa skrzynia co 4 h i skrzynia klejnotów.
- **Nagrody dzienne:** 7-dniowa seria ($, szmaragdy, boost, diamenty, duże $, obsydian, złota skórka).
  Opuszczenie dnia zaczyna serię od nowa.
- **Misje dzienne:** 3 losowe misje dziennie (zetnij bale, obsłuż ocalałych, pokonaj potwory, wydobądź klejnoty,
  zarób $, odeprzyj fale) z nagrodami w klejnotach.
- **Offline:** drwale zarabiają do 2 h pod nieobecność gracza.

## 7. Monetyzacja (zrobione, do podmiany ID przed premierą)

1. **Reklamy z nagrodą** (dobrowolne): podwojenie nagrody dziennej, podwojenie zarobku offline, darmowy boost (co 10 min),
   skrzynia od razu (co 30 min), naprawa palisady podczas przebicia (raz na falę).
2. **Reklamy pełnoekranowe**: najwcześniej po 5 min sesji, co najmniej 4 min odstępu, tylko po odpartej fali (co 3 fale),
   nigdy przy otwartym menu. Znikają po zakupie „Bez reklam” albo pakietu startowego.
3. **Zakupy w aplikacji**: pakiet startowy (klejnoty + Lodowa kurtka + bez reklam), 3 paczki klejnotów, „Bez reklam”.
4. Zgoda RODO przez Google UMP, przywracanie zakupów.

Konfiguracja: `src/platform/config.ts`. Instrukcja podpięcia własnych kont jest w README.

## 8. Roadmapa

- **Teraz:** 6 światów, 6 typów potworów + bossowie, kopalnia, Kuźnia, sklep, nagrody i misje dzienne, zapis gry, PL/EN, Android,
  reklamy i zakupy, wieże specjalne (lodowa, ognista, armata), zwierzaki (lisek, sowa, smoczek), namioty, muzyka dla każdego świata,
  ustawienia, samouczek, tryby grafiki z auto-dopasowaniem.
- **Następnie:** reklamy z nagrodą i sklep z prawdziwymi płatnościami, muzyka dla każdego świata,
  ranking (najwyższa fala), osiągnięcia Google Play Games, ustawienia (grafika, dźwięk, reset).
- **Później:** wydarzenia sezonowe, nowe typy wież (ogniste, lodowe), zwierzaki pomocnicy, klany.

## 9. Marketing

Krótkie filmiki (TikTok, Reels, Shorts): wirujące topory kosiące las, kolejka Mikołajów, boss w koronie rozbijający palisadę,
przejście przez portal do nowego świata. Każdy świat to osobny motyw do testowania, który przyciąga najtańsze instalacje.
