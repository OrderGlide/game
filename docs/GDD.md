# Stack Island — dokument projektowy gry (GDD)

## 1. Pomysł w jednym zdaniu

Rozbudowujesz bezludną wyspę: ścinasz, kopiesz i nosisz surowce w **coraz wyższej wieży na plecach**,
budujesz targ, tartak, mosty i latarnię, a pracownicy zarabiają za ciebie nawet wtedy, gdy nie grasz.

**Gatunek:** idle arcade / hybrid-casual („collect & stack”). To jedna z najpopularniejszych kategorii w Google Play:
proste sterowanie jednym palcem, ciągłe poczucie postępu i dużo satysfakcji z „ASMR” zbierania.
Podobne gry: *My Mini Mart*, *Lumber Inc*, *Idle Island*, *Pizza Ready*, *My Perfect Hotel*.

## 2. Główna pętla (core loop)

```
zbierz surowce ──► stos rośnie na plecach ──► zanieś na pole budowy / sprzedaj na targu
      ▲                                                     │
      └── ulepszenia (plecak, buty, siekiera), pracownicy ◄─┘ monety
```

- **Zbieranie jest automatyczne:** wystarczy stanąć obok drzewa lub skały.
- **Oddawanie też:** wchodzisz na pole budowy, a przedmioty same „lecą” ze stosu.
- **Ulepszenia kupujesz, stojąc** na polu (przebiegnięcie przez nie niczego nie kupuje).
- **Strzałka i podpowiedź** u góry ekranu cały czas mówią, co zrobić dalej (tutorial bez tekstu do czytania).

## 3. Progresja (wyspa 1)

| # | Budynek | Koszt | Co odblokowuje |
|---|---|---|---|
| 1 | Targ | 10 drewna | sprzedaż surowców → monety; pola ulepszeń |
| 2 | Plecak (1. ulepszenie) | 20 🪙 | +5 miejsca na stosie (tutorial ulepszeń) |
| 3 | Most | 20 drewna + 30 🪙 | wyspa z kamieniołomem |
| 4 | Tartak | 15 drewna + 25 kamienia + 60 🪙 | drewno → deski (automatycznie) |
| 5 | Chata drwali | 20 drewna + 15 kamienia + 80 🪙 | zatrudnianie pracowników |
| 6 | Pracownik (1.) | 60 🪙 | pracownik sam ścina drzewa i sprzedaje drewno |
| 7 | Most 2 | 30 kamienia + 15 desek + 150 🪙 | wyspa ze złotem |
| 8 | **Latarnia** | 40 kamienia + 30 desek + 20 złota + 250 🪙 | koniec wyspy 1 🎉 |

**Ulepszenia** (koszt rośnie wykładniczo, wzory w `src/data.ts`):

| Ulepszenie | Efekt / poziom | Maks. poziom |
|---|---|---|
| Plecak | +5 miejsca (start: 10) | 13 |
| Buty | +18 prędkości | 11 |
| Siekiera | −13% czasu zbierania | 11 |
| Pracownicy | +1 pracownik | 4 |

**Wartość surowców na targu:** drewno 2, kamień 3, deski 6, złoto 15.

**Tempo gry:** bot, który tylko podąża za strzałką i nie kupuje dodatkowych ulepszeń, kończy wyspę 1 w **~30 min**.
Żywy gracz, który ulepsza plecak i siekierę, zrobi to szybciej. To dobra długość pierwszej sesji dla tego gatunku.

**Zarobki offline:** każdy pracownik daje ok. 0,1 🪙/s, gdy gra jest zamknięta (limit 2 h).
Pieniądze czekają na stosie przy targu, a po powrocie gracz widzi komunikat „Witaj z powrotem! +X”.

## 4. Monetyzacja (do dodania przed premierą)

Model **F2P z reklamami + drobne zakupy**, standard dla hybrid-casual:

1. **Reklamy z nagrodą (rewarded).** Tu jest główny przychód, a gracz sam decyduje, czy obejrzeć:
   - „Podwój zarobki offline” w okienku powitalnym,
   - „2× prędkość / 2× plecak na 3 minuty”,
   - „Natychmiast ukończ budowę” przy dużych budynkach.
2. **Reklamy pełnoekranowe (interstitial):** najwyżej co 3–4 minuty i nigdy w trakcie zbierania,
   np. po ukończeniu budynku. Nie wcześniej niż po 5 minutach pierwszej sesji.
3. **Zakupy w aplikacji:** „Usuń reklamy” (~15–20 zł), „Pakiet startowy” (monety + stały +50% prędkości),
   skórki postaci.

Technicznie: AdMob przez `@capacitor-community/admob`, płatności przez Google Play Billing
(np. `cordova-plugin-purchase` / RevenueCat). Wymaga polityki prywatności i okna zgody (UMP/GDPR) w UE.

## 5. Retencja: żeby gracze wracali

- ✅ zarobki offline (już działają),
- codzienna nagroda (7-dniowa seria),
- kolejne wyspy z nowymi surowcami i maszynami (to rdzeń contentu),
- misje typu „sprzedaj 100 desek” z nagrodami,
- powiadomienie push „Twoi pracownicy zarobili 500 monet!” (po 4–8 h).

## 6. Roadmapa

**MVP (to repo):** wyspa 1, 3 obszary, 4 surowce, targ, tartak, pracownicy, 4 ulepszenia, zapis gry, offline, PL/EN, dźwięk, projekt Android.

**v0.2 przed premierą:**
- reklamy z nagrodą + zgoda GDPR, polityka prywatności,
- analityka (Firebase Analytics): lejek tutorialu, czas do każdego budynku, retencja D1/D7,
- lepsza ikona i grafiki do sklepu, muzyka w tle,
- ekran ustawień (dźwięk, wibracje, reset postępu).

**v0.3+:**
- wyspa 2 (np. pustynia: kaktusy → włókno, huta szkła) i przeprawa promem,
- menedżerowie automatyzujący tartak i transport,
- skórki postaci, zwierzak zbierający monety,
- wydarzenia sezonowe.

## 7. Marketing

Ten gatunek dobrze się sprzedaje przez **krótkie wideo (TikTok, Reels, Shorts)**: ogromna wieża przedmiotów
na plecach, „satysfakcjonujące” zbieranie, szybkie time-lapse’y rozbudowy wyspy. Warto nagrywać je od
pierwszej grywalnej wersji i sprawdzać, które motywy dają najtańsze instalacje (CPI), zanim wyda się dużo na content.

## 8. Wskaźniki do obserwowania w teście zamkniętym

- % graczy, którzy zbudowali Targ (cel: > 90%) i Most (cel: > 70%),
- retencja D1 > 35%, D7 > 12%,
- średnia długość sesji > 8 min,
- gdzie gracze odpadają: zdarzenie analityczne przy każdej budowie i ulepszeniu.
