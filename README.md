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
| `src/platform/` | Reklamy AdMob, zakupy Google Play i ich konfiguracja (`config.ts`) |
| `scripts/` | Testy: bot balansu (`balance.ts`) i test wydajności (`bench.mjs`) |
| `src/music.ts` | Muzyka generowana dla każdego świata |

Logika w `game.ts` nie zależy od grafiki, więc da się ją testować i balansować symulacją (bot grający w grę) bez przeglądarki.

## Testy

```bash
npm run balance   # bot przechodzi 6 światów bez grafiki: czas, przebicia palisady, walki z bossami
npm run bench     # test wydajności: ~40 potworów, procesor spowolniony 4× jak w tanim telefonie
```

`npm run bench` potrzebuje Chromium. Zainstaluj go raz komendą `npx playwright install chromium`
albo ustaw zmienną `CHROME_PATH` na ścieżkę do Chrome.

## Zarabianie: reklamy i zakupy

Gra ma już podpięte:
- **Google AdMob** (`@capacitor-community/admob`):
  - reklamy z nagrodą: podwojenie nagrody dziennej, podwojenie zarobku offline, darmowy boost, skrzynia od razu, naprawa palisady,
  - rzadkie reklamy pełnoekranowe: najwcześniej po 5 minutach gry, co najmniej 4 minuty odstępu i tylko po odpartej fali,
  - okno zgody RODO/GDPR (Google UMP).
- **Google Play Billing** (`@capgo/native-purchases`): paczki klejnotów, pakiet startowy, „Bez reklam” i przywracanie zakupów.

W przeglądarce zamiast reklamy pokazuje się oznaczona „Reklama testowa”, a zakupy działają tylko w wersji deweloperskiej (`npm run dev`).

### Co musisz ustawić przed wydaniem

1. **AdMob** ([admob.google.com](https://admob.google.com)): dodaj aplikację i utwórz 2 jednostki reklamowe: *Z nagrodą* i *Pełnoekranowa*.
   - Wpisz swoje ID w `src/platform/config.ts` (`ADMOB`) i ID aplikacji w `android/app/src/main/AndroidManifest.xml`.
   - Zostaw `testing: true`, dopóki testujesz. **Nigdy nie klikaj prawdziwych reklam we własnej grze**, bo Google blokuje za to konto.
   - W AdMob → Prywatność i wiadomości utwórz komunikat zgody RODO (GDPR).
2. **Google Play Console** → Zarabianie → Produkty → Produkty w aplikacji: utwórz produkty o identyfikatorach
   `starter_pack`, `gems_small`, `gems_medium`, `gems_large`, `no_ads` i ustaw ceny.
   Ceny w grze wczytają się automatycznie ze sklepu.
3. **Profil płatności** w Play Console i dane do wypłat w AdMob (konto bankowe, dane podatkowe). Wymaga ukończonych 18 lat.
4. **Polityka prywatności:** reklamy zbierają identyfikator reklamowy, więc potrzebny jest publiczny link do polityki prywatności
   i poprawnie wypełniona sekcja „Bezpieczeństwo danych” w Play Console. Obie rzeczy są gotowe, patrz niżej.
5. Zakupy są sprawdzane tylko na telefonie. Przy dużej grze warto dodać weryfikację na serwerze.

## Budowanie na Androida

### Bez instalowania czegokolwiek: GitHub Actions

Każdy push buduje grę na serwerach GitHuba (`.github/workflows/android.yml`):

1. Wejdź w repozytorium → zakładka **Actions** → ostatni przebieg **Android build** z zieloną ikonką.
2. Na dole strony, w sekcji **Artifacts**, pobierz `frost-camp-debug-apk` (plik .zip z `app-debug.apk`).
3. Wyślij `app-debug.apk` na telefon i otwórz go. Android zapyta o zgodę na instalację z nieznanego źródła.

Wersja debug jest do testów. Do Google Play potrzebny jest podpisany plik `.aab`, opisany niżej.

### Na własnym komputerze

Wymagania: [Android Studio](https://developer.android.com/studio) (z SDK) i JDK 21.

```bash
npm run android    # build web + cap sync + otwiera projekt w Android Studio
```

W Android Studio: **Run ▶** na telefonie/emulatorze.

### Klucz podpisu i plik .aab do Google Play

1. Utwórz klucz **raz** i przechowuj go bezpiecznie (np. w menedżerze haseł i na pendrivie). Bez niego nie wydasz aktualizacji,
   chyba że włączysz podpisywanie przez Google Play (zalecane, Play Console proponuje je przy pierwszym wydaniu).

   ```bash
   keytool -genkeypair -v -keystore frost-camp.jks -alias frostcamp -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 frost-camp.jks > frost-camp.jks.b64    # na macOS: base64 -i frost-camp.jks -o frost-camp.jks.b64
   ```

2. W repozytorium: **Settings → Secrets and variables → Actions → New repository secret** dodaj 4 sekrety:

   | Nazwa | Wartość |
   |---|---|
   | `KEYSTORE_BASE64` | zawartość pliku `frost-camp.jks.b64` |
   | `KEYSTORE_PASSWORD` | hasło do keystore |
   | `KEY_ALIAS` | `frostcamp` |
   | `KEY_PASSWORD` | hasło do klucza |

3. Od następnego pusha w **Artifacts** pojawi się też `frost-camp-release-aab`, gotowy do wgrania do Play Console.
   `versionCode` rośnie sam z każdym przebiegiem CI. `versionName` zmieniasz w `android/app/build.gradle`.

**Nigdy nie commituj pliku `.jks` ani haseł.** `.gitignore` blokuje `*.jks`/`*.keystore`.

### Wydanie w Google Play

1. Nazwa pakietu to **`pl.jasior.frostcamp`** (`capacitor.config.ts` i `android/app/build.gradle`).
   Po pierwszym wgraniu do Play Console nie da się jej zmienić.
2. Załóż konto w [Google Play Console](https://play.google.com/console) (jednorazowo 25 USD, wymaga ukończonych 18 lat).
3. Nowe konta prywatne muszą przejść **test zamknięty: min. 12 testerów przez 14 dni**, zanim dostaną dostęp do produkcji.
4. Wgraj plik `.aab` i wypełnij kartę sklepu. Gotowe teksty i odpowiedzi są w [`docs/store-listing.md`](docs/store-listing.md):
   tytuł, opisy PL/EN, kategoria, ankieta treści i sekcja „Bezpieczeństwo danych”.
5. Grafiki są w folderze [`store/`](store): ikona 512×512, grafika promocyjna 1024×500 i 6 zrzutów ekranu 1080×1920.

### Polityka prywatności

Gotowa polityka (PL + EN) jest w [`docs/privacy-policy.html`](docs/privacy-policy.html).
Adres kontaktowy to alias przekierowujący na prywatną skrzynkę — można go wymienić w jednym miejscu w pliku.

Google wymaga publicznego adresu URL. Wystawiamy ją przez **GitHub Pages**:
Settings → Pages → Source: *Deploy from a branch*, gałąź domyślna, folder `/docs`.

- Strona: https://orderglide.github.io/game/
- Polityka (ten link idzie do Play Console): https://orderglide.github.io/game/privacy-policy.html

Dla prywatnego repozytorium GitHub Pages wymaga płatnego planu; wtedy alternatywą są darmowe Google Sites.

### Ikona i splash

Są generowane z `assets/icon.png` (1024×1024, wyrenderowana z modeli gry):

```bash
npx @capacitor/assets generate --android --iconBackgroundColor '#8fc3f0' --splashBackgroundColor '#dde8f3'
```
