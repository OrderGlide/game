# Stack Island 🏝️

Mobilna gra typu **idle arcade / „collect & stack”** (w stylu *My Mini Mart*, *Lumber Inc*, *Idle Island*):
chodzisz po wyspie, ścinasz drzewa i kopiesz kamienie, surowce układają się w wieżę na plecach,
zanosisz je na pola budowy, sprzedajesz na targu, kupujesz ulepszenia, zatrudniasz pracowników
i odblokowujesz kolejne wyspy.

- **Silnik:** TypeScript + Canvas 2D (bez zewnętrznych bibliotek do gry, ~36 kB JS)
- **Build:** Vite
- **Android / Play Store:** Capacitor 8 (projekt w `android/`)
- **Języki:** polski i angielski (automatycznie wg języka telefonu)

Pełny opis gry, ekonomia, monetyzacja i roadmapa: [`docs/GDD.md`](docs/GDD.md).

## Uruchomienie w przeglądarce

```bash
npm install
npm run dev        # http://localhost:5173 — na telefonie otwórz adres z sieci lokalnej
```

Sterowanie: przeciągnij palcem w dowolnym miejscu (wirtualny joystick) albo WASD / strzałki na komputerze.

## Struktura

| Plik | Co robi |
|---|---|
| `src/data.ts` | Mapa, koszty budynków, ulepszenia, balans — **tu stroisz grę** |
| `src/game.ts` | Logika: ruch, zbieranie, stos, budowanie, tartak, pracownicy, podpowiedzi, zapis |
| `src/render.ts` | Cała grafika (rysowana kodem, zero plików graficznych) i HUD |
| `src/input.ts` | Joystick dotykowy + klawiatura |
| `src/audio.ts` | Dźwięki syntezowane w WebAudio + wibracje |
| `src/i18n.ts` | Teksty PL/EN |
| `src/main.ts` | Pętla gry, zapis w `localStorage`, przycisk wyciszenia |

## Budowanie na Androida

Wymagania: [Android Studio](https://developer.android.com/studio) (z SDK) i JDK 21.

```bash
npm run android    # build web + cap sync + otwiera projekt w Android Studio
```

W Android Studio: **Run ▶** na telefonie/emulatorze.

### Wydanie w Google Play

1. **Zmień `appId`** w `capacitor.config.ts` **oraz** `applicationId`/`namespace` w `android/app/build.gradle`
   na własny (np. `pl.twojanazwa.stackisland`) — po pierwszej publikacji nie da się go zmienić.
2. Podbijaj `versionCode` (+1 przy każdym wydaniu) i `versionName` w `android/app/build.gradle`.
3. Android Studio → **Build → Generate Signed App Bundle** → utwórz keystore
   (**zachowaj go i hasła w bezpiecznym miejscu**, nie commituj — `.gitignore` już blokuje `*.jks`/`*.keystore`).
4. Załóż konto w [Google Play Console](https://play.google.com/console) (jednorazowo 25 USD).
5. Nowe konta prywatne muszą przejść **test zamknięty: min. 12 testerów przez 14 dni** zanim dostaną dostęp do produkcji.
6. Wgraj plik `.aab`, uzupełnij: opis, ikonę 512×512, grafikę 1024×500, min. 2 zrzuty ekranu,
   politykę prywatności (URL), ankietę o treści (PEGI), sekcję „Bezpieczeństwo danych”.

Ikona i splash są generowane z `assets/icon.png` (1024×1024):

```bash
npx @capacitor/assets generate --android --iconBackgroundColor '#2b8fd6' --splashBackgroundColor '#2b8fd6'
```

Obecna ikona to placeholder rysowany kodem — przed premierą warto zamówić porządną.
