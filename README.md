# Stromobraní

<p align="center">
  <img src="assets/icon.png" alt="Ikona Stromobraní" width="128" />
</p>

**Objevuj památné stromy, plánuj výlety a sdílej své objevy.** Stromobraní je mobilní aplikace v Expo a React Native. Veřejný repozitář obsahuje klientskou aplikaci a její nativní moduly; server, administraci a databázi provozní služby neobsahuje.

> Aktuální veřejná verze: **1.8.0** · Android `versionCode`: **9**

## Co aplikace umí

- **Prozkoumávat stromy na mapě** s filtry podle druhu, stavu návštěvy a země. Aplikace pracuje s katalogy pro Česko, Slovensko, Itálii, Británii, Rakousko, Německo a Polsko.
- **Vybrat mapový podklad:** MapRiot Outdoor, Reperfect.it Maps přes PMTiles, OpenFreeMap Liberty nebo Positron a české podklady ČÚZK. Když MapRiot není nakonfigurovaný nebo dostupný, aplikace použije OpenFreeMap.
- **Zaznamenávat návštěvy stromů** s ověřením polohy, ukládat oblíbené, poznámky a vlastní seznamy. Návštěvy lze zařadit do fronty offline a odeslat po připojení; dříve prohlédnuté oblasti mapy se ukládají do mezipaměti.
- **Plánovat výpravy:** importovat trasu GPX, hledat stromy poblíž ní, plánovat pěší, cyklistickou nebo automobilovou trasu, zobrazit západ slunce a začátek zlaté hodiny a exportovat trasu.
- **Sledovat vlastní postup:** kalendář návštěv, sbírky druhů, série, odznaky, žebříčky a výzvy.
- **Zapojit se do komunity:** přátelé a jejich feed s reakcemi, profily, sdílené výpravy, souboje a školní či rodinné výzvy.
- **Používat přístupnější rozhraní:** popisky ovládacích prvků pro čtečky obrazovky, podporu systémového zvětšení textu a tmavý režim aplikace na Androidu.
- **Zapnout upozornění na blízké stromy** při používání aplikace nebo volitelně geofencing na pozadí. Noční tichý režim a automatické vypnutí geofencingu při velmi nízké baterii jsou v nastavení.

Některé funkce vyžadují účet, připojení k internetu nebo dostupnost služby Stromobraní. Nabídka předplatného a dalších nákupů v aplikaci závisí na platformě a konfiguraci obchodu.

## Technologie a platformy

- Expo SDK 57, React Native 0.86 a React 19.
- MapLibre Native pro mapy; MapRiot, OpenFreeMap, Reperfect.it Maps a ČÚZK jsou externí poskytovatelé podkladů.
- Vlastní Android Expo moduly pro widget a ověření Play Integrity.
- Hlavní lokální a EAS build konfigurace v repozitáři je pro Android. Projekt obsahuje také iOS identifikátor a některé multiplatformní knihovny; iOS workflow tu není popsané ani garantované.
- Aplikace používá vzdálené služby, zejména API Stromobraní, výpočet tras Valhalla, mapové servery, Google Play a reklamní SDK. Jejich dostupnost a podmínky jsou nezávislé na tomto repozitáři.

Expo Go nestačí: aplikace používá MapLibre, nákupy, reklamy a vlastní nativní moduly. Pro vývoj je potřeba vlastní development build. To odpovídá doporučenému workflow Expo pro knihovny s nativním kódem ([Expo: development builds](https://docs.expo.dev/develop/development-builds/introduction/)).

## Spuštění vývojové verze

### Požadavky

- Node.js **22.13 nebo novější** a npm.
- Android Studio, Android SDK Platform 36 a Android emulator nebo zařízení s povoleným laděním USB.
- Pro lokální nativní build také Java/Gradle prostředí podporované instalovanou verzí Android Gradle Pluginu.

### Instalace

```sh
git clone https://github.com/schmic75-gasos/stromobrani-public.git
cd stromobrani-public
npm ci
```

Volitelně vytvořte lokální konfigurační soubor:

```sh
cp .env.example .env.local
```

Proměnné `EXPO_PUBLIC_*` se vloží do klientské aplikace. **Neukládejte do nich hesla, soukromé tokeny ani jiné serverové tajnosti.**

| Proměnná | Význam |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Volitelná adresa API. Bez nastavení aplikace používá veřejné API Stromobraní. Tento repozitář server neobsahuje. |
| `EXPO_PUBLIC_MAPRIOT_KEY` | Volitelný klíč MapRiot pro vlastní build. Je součástí klientské aplikace a není tajný; bez něj se použije OpenFreeMap. |

### Development build na Androidu

První lokální build vytvoří a nainstaluje aplikaci s potřebným nativním kódem a spustí vývojový server:

```sh
npm run android
```

Pro samostatné spuštění vývojového serveru, pokud už máte odpovídající development build nainstalovaný, použijte:

```sh
npm start
```

Po změně JavaScriptu lze používat rychlé obnovení. Po změně závislostí s nativním kódem, `app.json`, Kotlin modulu nebo config pluginu vytvořte nový development build.

## Buildy a vlastní fork

V `package.json` jsou skripty pro EAS preview APK a produkční Android App Bundle:

```sh
npm run build:preview
npm run build:aab
```

Vyžadují EAS CLI, přihlášení a odpovídající projekt a přihlašovací údaje. Konfigurace tohoto repozitáře odkazuje na EAS projekt Stromobraní a obsahuje identifikátory obchodu. Před sestavením vlastního forku nastavte vlastní EAS project ID a Updates URL, identifikátory aplikace, reklamní a platební produkty, podepisovací klíče a případně vlastní API. K vydání této aplikace v obchodě potřebujete také oprávnění k příslušnému účtu a aplikaci.

## Struktura repozitáře

```text
App.js                       Hlavní aplikace a její obrazovky
app.json, eas.json           Expo a EAS konfigurace
assets/                      Ikony, zvuky a mapové značky
modules/stromobrani-widget/  Android widget
modules/stromobrani-integrity/ Android Play Integrity modul
plugins/                     Expo config pluginy
widgets/                     Expo widget rozhraní
```

Backend, administrační rozhraní, databáze a nástroje pro správu dat jsou záměrně vedené mimo veřejný repozitář. Klient je nakonfigurovaný pro připojení k provozovanému API; jeho lokální spuštění ani vlastní nasazení backendu tento repozitář neposkytuje.

## Soukromí a poloha

Aplikace může používat polohu pro mapu, ověření návštěvy stromu a volitelná upozornění na pozadí. Pozadí i oznámení jsou volitelné a oprávnění lze změnit v nastavení telefonu. Veřejný repozitář neobsahuje server, který zpracovává online požadavky; před používáním sdíleného API si přečtěte jeho [zásady ochrany soukromí](https://stromobrani-9389.rostiapp.cz/privacy).

## Licence

Originální zdrojový kód a materiály vytvořené pro Stromobraní ve veřejné verzi 1.8.0 jsou poskytovány pod licencí [PolyForm Noncommercial 1.0.0](LICENSE). Licence dovoluje nekomerční používání, úpravy a šíření této verze; komerční použití vyžaduje samostatný souhlas držitele práv. Omezení komerčního použití znamená, že projekt není open source podle definice OSI.

Licence Stromobraní se nevztahuje na knihovny, mapová data, fonty, služby ani jiné materiály třetích stran; ty zůstávají pod vlastními licencemi a podmínkami. Název a značky Stromobraní nejsou poskytnuty k označení cizí aplikace. U mapových podkladů respektujte atribuci a podmínky zobrazené v aplikaci.
