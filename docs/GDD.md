# Frost Camp — dokument projektowy gry (GDD)

## 1. Pomysł w jednym zdaniu

Prowadzisz zaśnieżony obóz ocalałych: ścinasz sosny wirującymi toporami, nosisz **coraz wyższy stos bali**
na ladę, ocaleni płacą za drewno, a za zarobione 💵 stawiasz wieże z kuszami i bronisz palisady przed falami polarnych niedźwiedzi.

**Gatunek:** hybrid-casual — *idle arcade („collect & stack”)* + lekki *tower defense*.
Podobne gry: *Frozen City / Whiteout Survival* (reklamy), *My Mini Mart*, *Lumber Inc*, *Survivor Base*.
Mechanika i klimat wzorowane na krótkich filmikach z TikToka (chodzisz, zbierasz, kolejka klientów, pola za $, obrona przed zwierzętami).

## 2. Główna pętla

```
las ──► topory ścinają sosny ──► stos bali w rękach ──► lada ──► ocaleni kupują ──► 💵 na stosie
 ▲                                                                                   │
 └──── ulepszenia: +topór, większy stos, buty, drwale, palisada, wieże ◄─────────────┘
                     ▲
     co ~minutę fala niedźwiedzi atakuje palisadę → wieże strzelają, gracz może wyjść i walczyć toporami
```

- **Zbieranie jest automatyczne:** topory krążą wokół postaci i same ścinają drzewa w zasięgu.
- **Oddawanie też:** wchodzisz w strefę za ladą, bale same lecą na blat. Pierwszy z kolejki zabiera tyle, ile chce (dymek z ikoną bala), płaci i odchodzi.
- **Pola zakupu za $** (ramki w stylu z filmików) kupujesz, **stojąc** na nich, bo przebiegnięcie przez pole niczego nie kupuje.
- **Strzałka i podpowiedź** u góry mówią, co zrobić dalej.

## 3. Obrona

- Fale niedźwiedzi co ok. 60 s (pierwsza po 90 s). Z każdą falą jest ich więcej i są silniejsze.
- Niedźwiedzie idą pod wschodnią palisadę i ją biją (pasek u góry ekranu). Wieże z kuszami strzelają automatycznie.
- Palisada zniszczona → niedźwiedzie wchodzą do obozu i gonią gracza. Trafienie odrzuca gracza i zabiera mu 3 bale.
- Gracz może wyjść bramą i walczyć: wirujące topory ranią niedźwiedzie. Zabity niedźwiedź zostawia paczkę 💵.
- Po odparciu fali palisada sama się naprawia. **Nie ma przegranej** — porażka kosztuje tylko czas i drewno (casual).

## 4. Ulepszenia

| Pole | Efekt | Koszt | Odblokowanie |
|---|---|---|---|
| Wieża z kuszą ×4 | automatyczna obrona | 20 / 120 / 400 / 900 | kolejno |
| +1 topór (maks. 4) | szybsze ścinanie, większe obrażenia | 60 → ×2,4 | po 1. wieży |
| Większy stos | +4 bale (start 8) | 40 → ×1,7 | po 1. wieży |
| Drwal (maks. 3) | sam ścina i nosi drewno na ladę | 180 → ×2,2 | po 2. wieży |
| Mocniejsza palisada | +60 HP (start 100) | 120 → ×1,7 | po 2. wieży |
| Szybsze buty | +0,6 prędkości | 60 → ×1,7 | po 2. wieży |
| Moc wież | +30% obrażeń | 250 → ×1,8 | po 3. wieży |

Cena bala u ocalałych: 5 💵. Wszystkie liczby są w `src/data.ts`.

**Tempo (sprawdzone symulacją, bot gra 30 min):** pierwsza wieża po ok. 15 s, czwarta wieża po ok. 22–28 min.
Palisada pada 2–3 razy na 30 minut (dopiero od ok. 13. fali), więc napięcie jest, ale gra nie frustruje.

## 5. Monetyzacja (do dodania przed premierą)

1. **Reklamy z nagrodą** (główny przychód): „podwój zarobki offline”, „2× prędkość na 3 min”,
   „natychmiast napraw palisadę” w trakcie fali, „darmowa wieża na 1 falę”.
2. **Reklamy pełnoekranowe:** najwyżej co 3–4 min, np. po odpartej fali, nigdy w trakcie zbierania.
3. **Zakupy w aplikacji:** „Usuń reklamy”, „Pakiet startowy” (💵 + drwal), skórki kurtek i toporów.

Technicznie: AdMob (`@capacitor-community/admob`) + Google Play Billing (np. RevenueCat).
W UE potrzebna polityka prywatności i okno zgody (UMP/GDPR).

## 6. Retencja

- ✅ zarobki offline od drwali (do 2 h),
- ✅ licznik fal jako „wynik” do bicia,
- codzienna nagroda, misje („odeprzyj 5 fal”, „sprzedaj 200 bali”),
- nowe obozy/mapy z innymi zagrożeniami (wilki, yeti jako boss),
- powiadomienie „Twoi drwale zarobili 500 💵!”.

## 7. Roadmapa

**MVP (to repo):** obóz 3D, las, kolejka ocalałych, 10 typów pól, 4 wieże, fale niedźwiedzi, drwale, zapis, offline, PL/EN, dźwięk, projekt Android z ikoną.

**v0.2 przed premierą:** reklamy z nagrodą + zgoda GDPR, analityka (Firebase: lejek pierwszych budów, retencja D1/D7),
muzyka, ekran ustawień, optymalizacja na słabsze telefony (tryb bez cieni).

**v0.3+:** druga mapa, boss co 10 fal, skórki, rozbudowa obozu (namioty → nowi klienci z innymi zamówieniami, np. deski z tartaku).

## 8. Marketing

Ten gatunek sprzedaje się **krótkimi filmikami (TikTok, Reels, Shorts)**: wirujące topory kosiące las,
kolejka Mikołajów, fala niedźwiedzi rozbijająca się o palisadę, kusze strzelające seriami.
Warto nagrywać je od pierwszej grywalnej wersji i testować, które motywy dają najtańsze instalacje.
