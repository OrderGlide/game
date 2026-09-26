# Przewodnik: jak wydać grę w Google Play

Spisane na podstawie wydania Frost Camp (wrzesień 2026). Następna gra idzie tą samą ścieżką,
tylko szybciej — większość rzeczy robi się **raz na zawsze**.

---

## 1. Co masz już zrobione i czego nie powtarzasz

| Rzecz | Gdzie | Uwagi |
|---|---|---|
| Konto dewelopera Coldvain | Play Console | 25 USD, jednorazowo |
| Profil płatności + konto bankowe | Play Console → Ustawienia | wypłaty co miesiąc, próg 2 zł |
| Program opłaty 15% | Play Console → Profil płatności | zamiast 30% do 1 mln USD rocznie |
| Konto AdMob | admob.google.com | jedno konto, wiele aplikacji |
| `app-ads.txt` | `orderglide.github.io/app-ads.txt` | jeden plik obsługuje wszystkie gry |
| Strona studia | `OrderGlide.github.io` | tam wrzucasz też polityki kolejnych gier |
| Alias e-mail | addy.io | ten sam adres do wszystkich gier |
| Klucz podpisu `.jks` | menedżer haseł + pendrive | **jeden klucz może podpisywać wszystkie gry** |
| Pipeline CI | `.github/workflows/android.yml` | kopiujesz do nowego repo bez zmian |

Przy nowej grze zostaje: nazwa pakietu, jednostki reklamowe, karta sklepu, ankiety, produkty.

---

## 2. Kolejność przy nowej grze

Rzeczy, które trwają (weryfikacje), zaczynaj najwcześniej.

1. **Nazwa pakietu** w `capacitor.config.ts` i `android/app/build.gradle`, np. `pl.jasior.nazwagry`.
   Po pierwszym wgraniu do Play **nie da się jej zmienić**.
2. **AdMob → Aplikacje → Dodaj aplikację**: utwórz aplikację i dwie jednostki reklamowe
   (z nagrodą + pełnoekranowa). ID wpisz w `src/platform/config.ts` i w `AndroidManifest.xml`
   (`com.google.android.gms.ads.APPLICATION_ID`).
3. **Polityka prywatności**: skopiuj `docs/privacy-policy.html`, podmień nazwę gry,
   wrzuć do repo `OrderGlide.github.io` jako `nazwagry-privacy.html`.
4. **Play Console → Utwórz aplikację**, potem wypełnij sekcje z punktu 3 poniżej.
5. **Produkty w aplikacji** (jeśli gra ma zakupy) — patrz punkt 5.
6. **Build i podpis** — patrz punkt 6.
7. Wyślij do sprawdzenia.

---

## 3. Gotowe odpowiedzi do ankiet

Poniższe pasują do każdej kreskówkowej gry z reklamami AdMob i zakupami,
bez kont użytkownika, bez czatu, bez serwera.

### Dane logowania
Nie — gra nie wymaga logowania, zapis trzyma `localStorage` na urządzeniu.

### Docelowi odbiorcy
Zaznacz **13–15, 16–17, 18 lub więcej**. Nigdy nic poniżej 13 lat — gra trafia wtedy
do programu „Rodzina", który wymaga certyfikowanych sieci reklamowych i wyłączenia
reklam spersonalizowanych.

Reklamy: **tak, aplikacja zawiera reklamy**.

### Ocena treści (IARC)
- Kategoria: **Gra**
- Przemoc: **tak, wobec istot innych niż ludzie** → kontekst **fikcyjny**, styl **dla dzieci**,
  reakcje **nierealistyczne**, **często pokazywana z daleka**, krew **brak**,
  stworzenia zachowują się jak ludzie **nie**
- Wymierzona w rzeczywiste zwierzęta: **tak, jeśli wśród przeciwników są realne gatunki**
  (niedźwiedź, goryl, pantera). Odpowiadaj zgodnie z prawdą — podnosi to ocenę najwyżej
  o jeden stopień, a fałszywa deklaracja grozi zdjęciem gry.
- Strach, seks, hazard, język, substancje, humor: **nie**
- Zakupy cyfrowe: **tak**, zaznacz wyłącznie **„Zakupy towarów cyfrowych"**.
  Nagrody wymienialne na pieniądze i NFT: **nie**.
- **Losowe elementy w zakupach: NIE.** Patrz pułapka w punkcie 7.
- Wymiana przedmiotów za prawdziwe pieniądze: **nie**
- Różne (czat, lokalizacja, swastyki, Korea, terroryzm, przestępstwa): wszystko **nie**

Spodziewany wynik: PEGI 7, ESRB Everyone, USK 6, Australia G, Brazylia 14.

### Bezpieczeństwo danych
Pytania ogólne: zbiera dane **tak** (przez AdMob), szyfrowanie **tak**,
tworzenie kont **„aplikacja nie umożliwia tworzenia konta"**, logowanie kontami zewnętrznymi **nie**,
prośba o usunięcie danych **tak** + URL polityki prywatności.

Typy danych — zaznacz dokładnie pięć:

| Typ | Zbierane | Udostępniane | Cel |
|---|---|---|---|
| Przybliżona lokalizacja | tak | tak | Cele marketingowe |
| Identyfikatory urządzenia | tak | tak | Cele marketingowe + Analityka |
| Interakcje z aplikacją | tak | tak | Cele marketingowe + Analityka |
| Dzienniki błędów | tak | nie | Analityka |
| Diagnostyka | tak | nie | Analityka |
| Historia zakupów | tak | nie | Funkcje aplikacji |

Przy każdym: przetwarzanie na bieżąco **nie**, zbieranie **wymagane**.

Aktualna tabela Google dla AdMob:
[developers.google.com/admob/android/privacy/play-data-disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure)

### Identyfikator wyświetlania reklam
**Tak**, cele: **Cele marketingowe + Analityka**. Musi się zgadzać z sekcją Bezpieczeństwo danych.

### Funkcje finansowe
„Moja aplikacja nie zawiera żadnych funkcji finansowych". Zakupy w grze to nie funkcja finansowa.

### Aplikacje do dbania o zdrowie
„W mojej aplikacji nie ma żadnych funkcji związanych ze zdrowiem".

### Deklaracja AI
„Nie oznaczaj zasobów etykietami", jeśli grafiki są renderowane z modeli generowanych kodem.

### Ustawienia sklepu
- Kategoria: dopasuj do gry (Frost Camp: Strategiczne)
- E-mail: alias z polityki prywatności
- Strona: `https://orderglide.github.io/`
- Marketing zewnętrzny: zostaw włączony

---

## 4. Karta sklepu

Teksty PL i EN, ikona 512×512, grafika promocyjna 1024×500, min. 4 zrzuty 1080×1920.
Wzór dla Frost Camp: [`store-listing.md`](store-listing.md), grafiki w [`store/`](../store).

Zrzuty z tabletu są opcjonalne.

---

## 5. Produkty w aplikacji

**Zarabianie → Produkty → Produkty kupowane raz.** Identyfikatory muszą co do znaku
zgadzać się z `src/platform/config.ts`, bo po nich gra pyta sklep o ceny.

Przy każdym produkcie:
- identyfikator opcji zakupu: to samo co ID produktu, ale **z myślnikami zamiast podkreśleń**
  (`gems-small`), bo podkreślenia są tam zabronione
- typ zakupu: **Kup**
- klasyfikacja: **Treści cyfrowe**
- **odznacz „więcej niż 1 sztuka w jednej transakcji"** — kod nie czyta pola `quantity`,
  więc gracz zapłaciłby za trzy paczki, a dostał jedną
- waluta konsumowalna (klejnoty): wielokrotny zakup **tak**
- pakiet startowy i „Bez reklam": wielokrotny zakup **nie**, inaczej gracz straci zakup po reinstalacji
- cena dla Polski + automatyczne przeliczenie na pozostałe kraje

Zakupy działają wyłącznie w aplikacji **zainstalowanej z Google Play**. Przy instalacji
z pliku APK Billing zawsze zwróci błąd — to normalne.

---

## 6. Build, podpis, wysyłka

Sekrety w repo (Settings → Secrets → Actions): `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`,
`KEY_ALIAS`, `KEY_PASSWORD`. Szczegóły w [README](../README.md#klucz-podpisu-i-plik-aab-do-google-play).

Przed zbudowaniem wersji dla Play:

1. `testing: false` w `src/platform/config.ts` — **inaczej gracze zobaczą reklamy testowe
   i nie zarobisz ani złotówki**
2. `versionName` w `android/app/build.gradle`
3. push → GitHub Actions → artefakt `frost-camp-release-aab`

`versionCode` to numer przebiegu w Actions. Przed wgraniem sprawdź, czy pakiet w Play Console
ma ten sam numer co przebieg, z którego pobrałeś plik — łatwo wgrać stary artefakt.

---

## 7. Pułapki, które kosztują najwięcej

**Losowe skrzynki.** Zakup, którego zawartość jest losowa, liczy się dla IARC jako loot box.
Brazylia (ClassInd) i Australia (ACB) dają wtedy **18+/M niezależnie od treści gry**, bez żadnego
deskryptora. Frost Camp dostał 18+ za skrzynię za 20 szmaragdów i zszedł do „dla wszystkich"
dopiero po zmianie jej zawartości na stałą (`CHEST.reward` w `src/data.ts`).
Rób nagrody z zakupów deterministyczne od początku.

**Kliknięcie własnej reklamy.** Po przełączeniu `testing: false` nie dotykaj reklam w swojej
grze na żadnym urządzeniu. AdMob traktuje to jako oszustwo i blokuje konto na stałe,
bez odwołania — razem ze środkami.

**Deklaracja AD_ID.** Przy Androidzie 13+ trzeba zadeklarować korzystanie z identyfikatora
reklamowego, inaczej Play blokuje publikację. Odpowiedź: tak.

**Nazwa pakietu.** Nieodwracalna po pierwszym wgraniu. Przemyśl ją przed pierwszym uploadem.

**Ekonomia gry.** Nie podlega weryfikacji, możesz ją zmieniać aktualizacjami. Ale konto
dewelopera jest wspólne dla wszystkich gier: oceny i skargi z jednego tytułu psują start
następnych. Przy grze bez marketingu pierwsze kilkadziesiąt opinii decyduje o wszystkim,
a pieniądze na starcie idą z reklam, czyli z czasu spędzonego w grze — nie z zakupów.
Dokręcaj ekonomię dopiero na podstawie danych z Play Console, nie przed premierą.

---

## 8. Po publikacji

- pierwsza weryfikacja nowego konta trwa od kilku dni do dwóch tygodni, kolejne aktualizacje
  zwykle godziny
- w AdMob → Prywatność i wiadomości utwórz komunikat zgody RODO, jeśli gra trafia do UE
- w Play Console → Statystyki patrz, do którego etapu docierają gracze i gdzie odpadają
- weryfikacja konta bankowego bywa osobnym procesem (mikroprzelew), zakupy ruszą dopiero po niej
