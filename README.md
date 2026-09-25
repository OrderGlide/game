# Frost Camp ❄️🪓🐻

Mobilna gra 3D typu **idle arcade / „collect & stack” + obrona bazy**, z 6 światami do przejścia:
ścinasz drzewa w ogrodzonym lesie toporami, które krążą wokół postaci, nosisz stos bali na ladę,
ocaleni kupują drewno za 💵, a w kopalni wydobywasz szmaragdy, diamenty i obsydian.
Stawiasz wieże z kuszami, ulepszasz sprzęt w Kuźni, odpierasz fale potworów i bossów,
a potem budujesz portal do następnego świata (Tajga → Pustynia → Dżungla → Bagna → Wulkan → Kryształowa Kraina → wyższy poziom trudności).
Jest też sklep (skórki, boosty, skrzynie), nagrody dzienne i misje dzienne.

- **Silnik:** TypeScript + [Three.js](https://threejs.org) (wszystkie modele low-poly są generowane kodem, zero plików 3D)
- **Build:** Vite
- **Android / Play Store:** Capacitor 8 (projekt w `android/`)
- **Języki:** polski i angielski (automatycznie wg języka telefonu)

Pełny opis gry, światy, ekonomia, monetyzacja i roadmapa: [`docs/GDD.md`](docs/GDD.md).

## Uruchomienie w przeglądarce

```bash
npm install
npm run dev        # http://localhost:5173 — na telefonie otwórz adres z sieci lokalnej
```

Sterowanie: przeciągnij palcem w dowolnym miejscu (wirtualny joystick) albo WASD / strzałki na komputerze.

## Struktura

| Plik | Co robi |
|---|---|
| `src/data.ts` | Układ mapy, 6 światów, ceny, potwory, fale, ulepszenia, sklep, nagrody i misje — **tu stroisz grę** |
| `src/game.ts` | Logika świata (bez grafiki): ruch, kolizje, ścinanie, kopanie, lada i kolejka, fale, bossowie, wieże, drwale, górnicy, portal, podpowiedzi |
| `src/profile.ts` | Trwały profil gracza: klejnoty, ulepszenia, skórki, nagrody dzienne, misje, boosty |
| `src/view/models.ts` | Modele 3D z prymitywów: postacie, 6 potworów + korona bossa, narzędzia, wieże, bramy, kuźnia, ognisko, portal |
| `src/view/nature.ts` | 6 rodzajów drzew, skały z klejnotami, dekoracje każdego świata |
| `src/view/theme.ts` | Kolory, światło, mgła i cząsteczki każdego świata |
| `src/view/view.ts` | Scena Three.js: kamera, cienie, synchronizacja ze stanem gry, animacje, efekty |
| `src/view/hud.ts` | Interfejs: pieniądze, klejnoty, fale, pasek bossa, joystick, menu Kuźni, Sklepu, nagród i misji |
| `src/input.ts` | Joystick dotykowy + klawiatura |
| `src/audio.ts` | Dźwięki syntezowane w WebAudio + wibracje |
| `src/i18n.ts` | Teksty PL/EN |
| `src/main.ts` | Pętla gry, zapis w `localStorage`, podróż przez portal |

Logika w `game.ts` nie zależy od grafiki, więc da się ją testować i balansować symulacją (bot grający w grę) bez przeglądarki.

## Budowanie na Androida

Wymagania: [Android Studio](https://developer.android.com/studio) (z SDK) i JDK 21.

```bash
npm run android    # build web + cap sync + otwiera projekt w Android Studio
```

W Android Studio: **Run ▶** na telefonie/emulatorze.

### Wydanie w Google Play

1. **Zmień `appId`** w `capacitor.config.ts` **oraz** `applicationId`/`namespace` w `android/app/build.gradle`
   na własny (np. `pl.twojanazwa.frostcamp`) — po pierwszej publikacji nie da się go zmienić.
2. Podbijaj `versionCode` (+1 przy każdym wydaniu) i `versionName` w `android/app/build.gradle`.
3. Android Studio → **Build → Generate Signed App Bundle** → utwórz keystore
   (**zachowaj go i hasła w bezpiecznym miejscu**, nie commituj — `.gitignore` już blokuje `*.jks`/`*.keystore`).
4. Załóż konto w [Google Play Console](https://play.google.com/console) (jednorazowo 25 USD).
5. Nowe konta prywatne muszą przejść **test zamknięty: min. 12 testerów przez 14 dni** zanim dostaną dostęp do produkcji.
6. Wgraj plik `.aab`, uzupełnij: opis, ikonę 512×512, grafikę 1024×500, min. 2 zrzuty ekranu,
   politykę prywatności (URL), ankietę o treści (PEGI), sekcję „Bezpieczeństwo danych”.

Ikona i splash są generowane z `assets/icon.png` (1024×1024, wyrenderowana z modeli gry):

```bash
npx @capacitor/assets generate --android --iconBackgroundColor '#8fc3f0' --splashBackgroundColor '#dde8f3'
```
