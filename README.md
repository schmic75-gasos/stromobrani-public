# Stromobraní

Veřejná kopie mobilní aplikace Stromobraní (Expo / React Native), aktuálně verze 1.8.0. Obsahuje klientskou aplikaci a její nativní moduly; serverová a administrační část zůstává mimo tento repozitář.

## Lokální spuštění

1. Nainstalujte Node.js a Android Studio podle návodu pro Expo.
2. Spusťte `npm ci`.
3. Volitelně zkopírujte `.env.example` do `.env.local`. Aplikace standardně používá veřejné API Stromobraní. Pro MapRiot nastavte `EXPO_PUBLIC_MAPRIOT_KEY`; bez klíče je dostupná OpenFreeMap.
4. Spusťte vývojový server příkazem `npm start`.

Nativní moduly a konfigurace jsou součástí repozitáře. Změny v nich vyžadují nový development client nebo aplikační build.

## Licence

Originální zdrojový kód a materiály vytvořené pro Stromobraní ve veřejné verzi 1.8.0 jsou poskytovány pod licencí [PolyForm Noncommercial 1.0.0](LICENSE). Licence dovoluje nekomerční používání, úpravy a šíření této verze; komerční použití vyžaduje samostatný souhlas držitele práv. Tato podmínka znamená, že projekt není open source podle definice OSI.

Licence nepokrývá knihovny, mapová data, fonty, služby ani jiné materiály třetích stran; ty zůstávají pod svými vlastními podmínkami. Název a značky Stromobraní nejsou licencí poskytnuty k použití jako označení cizí aplikace.
