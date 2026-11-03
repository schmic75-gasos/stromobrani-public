import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text as NativeText, StyleSheet, TouchableOpacity as T, ScrollView, FlatList, TextInput, Image, Animated, Linking, Share,
  Alert, RefreshControl, ActivityIndicator, Platform, StatusBar, Modal, KeyboardAvoidingView, AppState, BackHandler,
  useWindowDimensions, Switch,
} from 'react-native';
import { MaterialCommunityIcons as MCI } from '@expo/vector-icons';
import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Manip from 'expo-image-manipulator';
import * as Network from 'expo-network';
import { DeviceMotion } from 'expo-sensors';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import ViewShot, { captureRef } from 'react-native-view-shot';
import TreeWidget from './widgets/TreeWidget';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

/* ============================== konfigurace ============================== */
const VERSION = '1.4.0';
const API = process.env.EXPO_PUBLIC_API_URL || '';
const MB_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';
const STYLE = process.env.EXPO_PUBLIC_MAPBOX_STYLE || '';
const RADIUS = 25;
if (MB_TOKEN) Mapbox.setAccessToken(MB_TOKEN);

const C = { forest: '#1f3d2b', moss: '#4f7a3a', leaf: '#7fb069', sun: '#e9b44c', bark: '#6b4a2f', cream: '#f7f2e4', paper: '#fffdf6', ink: '#23301f', mute: '#7a8570', line: '#e3dcc3', red: '#c8553d' };
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif' });
let APP_LANG = 'cs';
const I18N = {
  en: { Mapa: 'Map', Radar: 'Radar', Žebříček: 'Leaderboard', Profil: 'Profile', 'Filtr stromů': 'Tree filters', 'Stav návštěvy': 'Visit status', Vše: 'All', Nenavštívené: 'Not visited', Navštívené: 'Visited', 'Přihlášení': 'Sign in', 'Odhlásit': 'Sign out', 'Nastavení': 'Settings', 'Hotovo': 'Done', 'Upozornění': 'Notifications', 'Večerní připomenutí': 'Daily reminder', 'Přidat mezi oblíbené': 'Add to favorites', 'Odebrat z oblíbených': 'Remove from favorites', 'Jen oblíbené': 'Favorites only', 'Naplánovat pěší trasu přes okolní stromy': 'Plan a walking route', 'Navigovat': 'Navigate', 'Navigovat pěšky': 'Walk to tree', 'Počítám pěší trasu…': 'Calculating walking route…', 'Navigovat v Mapách': 'Navigate in Maps', 'Vypočítat trasu': 'Calculate route', 'Profil trasy': 'Route profile', 'Pěšky': 'Walk', 'Cyklo': 'Bike', 'Auto': 'Car', 'Nejkratší vzdálenost': 'Shortest distance', 'Bezbariérová': 'Wheelchair accessible', 'Typ kola': 'Bicycle type', 'Trekové': 'Hybrid', 'Silniční': 'Road', 'Horské': 'Mountain', 'Profil jízdy': 'Riding preference', 'Cyklostezky a mírné kopce': 'Bike paths and gentle hills', 'Silnice': 'Roads', 'Kopce nevadí': 'Hills are fine', 'Upřednostnit dálnice': 'Prefer highways', 'Cyklistická trasa': 'Cycling route', 'Trasa autem': 'Driving route', 'Naplánovat trasu přes okolní stromy': 'Plan a route through nearby trees', 'Zobrazit na mapě': 'Show on map', 'Skrýt mapu': 'Hide map', 'Exportovat GPX': 'Export GPX', 'vzdálenost': 'distance', 'Pokyny': 'Directions', 'Klepnutím otevřeš fotku; v náhledu můžeš přejíždět mezi soutěžními snímky.': 'Tap a photo to open it, then swipe between contest entries.', 'Sdílet odkaz': 'Share link', 'Sdílet kartu': 'Share tree card', 'Fotosoutěž': 'Photo contest', 'Sbírka druhů': 'Species collection', 'Exportovat historii do CSV': 'Export history to CSV', 'Navrhnout opravu údajů': 'Suggest a correction', 'Navrhnout strom': 'Suggest a tree', 'Odeslat ke kontrole': 'Submit for review', 'Přidat přítele': 'Add friend', 'Odebrat přítele': 'Remove friend', 'Přijmout žádost': 'Accept request', 'Okresní a týmové výzvy': 'District and team challenges', 'Přidat se': 'Join', Stromy: 'Trees', Fotky: 'Photos', Výzvy: 'Challenges', Odznaky: 'Badges', 'Kalendář návštěv': 'Visit calendar', 'Historie odkliků': 'Visit history', 'Pěší trasa': 'Walking route', 'Tepelná mapa': 'Visit heatmap', 'Zobrazit detail': 'View details', 'Odkliknout strom': 'Check in', 'První odklik stromu': 'First tree visit', 'Otevřít Mapy': 'Open Maps', 'Načítám…': 'Loading…', 'Hledám polohu…': 'Finding location…', 'Přidat fotku': 'Add photo', 'Vytvořit výzvu': 'Create challenge' },
  sk: { Mapa: 'Mapa', Radar: 'Radar', Žebříček: 'Rebríček', Profil: 'Profil', 'Filtr stromů': 'Filter stromov', 'Stav návštěvy': 'Stav návštevy', Vše: 'Všetko', Nenavštívené: 'Nenavštívené', Navštívené: 'Navštívené', 'Přihlášení': 'Prihlásenie', 'Odhlásit': 'Odhlásiť', 'Nastavení': 'Nastavenia', 'Hotovo': 'Hotovo', 'Upozornění': 'Upozornenia', 'Večerní připomenutí': 'Večerná pripomienka', 'Přidat mezi oblíbené': 'Pridať medzi obľúbené', 'Odebrat z oblíbených': 'Odobrať z obľúbených', 'Jen oblíbené': 'Iba obľúbené', 'Naplánovat pěší trasu přes okolní stromy': 'Naplánovať pešiu trasu', 'Navigovat': 'Navigovať', 'Navigovat pěšky': 'Navigovať pešo', 'Počítám pěší trasu…': 'Počítam pešiu trasu…', 'Navigovat v Mapách': 'Navigovať v Mapách', 'Vypočítat trasu': 'Vypočítať trasu', 'Profil trasy': 'Profil trasy', 'Pěšky': 'Pešo', 'Cyklo': 'Bicykel', 'Auto': 'Auto', 'Nejkratší vzdálenost': 'Najkratšia vzdialenosť', 'Bezbariérová': 'Bezbariérová', 'Typ kola': 'Typ bicykla', 'Trekové': 'Trekový', 'Silniční': 'Cestný', 'Horské': 'Horský', 'Profil jízdy': 'Profil jazdy', 'Cyklostezky a mírné kopce': 'Cyklotrasy a mierne kopce', 'Silnice': 'Cesty', 'Kopce nevadí': 'Kopce neprekážajú', 'Upřednostnit dálnice': 'Uprednostniť diaľnice', 'Cyklistická trasa': 'Cyklotrasa', 'Trasa autem': 'Trasa autom', 'Naplánovat trasu přes okolní stromy': 'Naplánovať trasu cez okolité stromy', 'Zobrazit na mapě': 'Zobraziť na mape', 'Skrýt mapu': 'Skryť mapu', 'Exportovat GPX': 'Exportovať GPX', 'vzdálenost': 'vzdialenosť', 'Pokyny': 'Pokyny', 'Klepnutím otevřeš fotku; v náhledu můžeš přejíždět mezi soutěžními snímky.': 'Ťuknutím otvoríš fotku, potom môžeš prechádzať súťažné snímky.', 'Sdílet odkaz': 'Zdieľať odkaz', 'Sdílet kartu': 'Zdieľať kartu stromu', 'Fotosoutěž': 'Fotosúťaž', 'Sbírka druhů': 'Zbierka druhov', 'Exportovat historii do CSV': 'Exportovať históriu do CSV', 'Navrhnout opravu údajů': 'Navrhnúť opravu údajov', 'Navrhnout strom': 'Navrhnúť strom', 'Odeslat ke kontrole': 'Odoslať na kontrolu', 'Přidat přítele': 'Pridať priateľa', 'Odebrat přítele': 'Odobrať priateľa', 'Přijmout žádost': 'Prijať žiadosť', 'Okresní a týmové výzvy': 'Okresné a tímové výzvy', 'Přidat se': 'Pridať sa', Stromy: 'Stromy', Fotky: 'Fotky', Výzvy: 'Výzvy', Odznaky: 'Odznaky', 'Kalendář návštěv': 'Kalendár návštev', 'Historie odkliků': 'História návštev', 'Pěší trasa': 'Pešia trasa', 'Tepelná mapa': 'Tepelná mapa návštev', 'Zobrazit detail': 'Zobraziť detail', 'Odkliknout strom': 'Zaznamenať návštevu', 'Otevřít Mapy': 'Otvoriť Mapy', 'Načítám…': 'Načítavam…', 'Hledám polohu…': 'Hľadám polohu…', 'Přidat fotku': 'Pridať fotku' }
};
function Text({ children, ...props }) {
  const dict = I18N[APP_LANG] || {};
  const translated = React.Children.map(children, (child) => typeof child === 'string' ? (dict[child] || child) : child);
  return <NativeText {...props}>{translated}</NativeText>;
}
/* ikony = Material Design Icons (stejné názvy používá i server u výzev a odznaků) */
const TR = { walk: ['walk', 'pěšky'], bike: ['bike', 'na kole'], car: ['car', 'autem'], transit: ['bus', 'MHD / vlak'], other: ['dots-horizontal-circle-outline', 'jinak'] };
/* počasí při odkliku (klíče posílá server v poli weather) */
const WX = {
  sunny: ['weather-sunny', 'Slunečno'], partly: ['weather-partly-cloudy', 'Polojasno'], cloudy: ['weather-cloudy', 'Zataženo'], rain: ['weather-pouring', 'Déšť'],
  storm: ['weather-lightning-rainy', 'Bouřka'], snow: ['weather-snowy', 'Sníh'], fog: ['weather-fog', 'Mlha'], wind: ['weather-windy', 'Vítr'],
};
const AVATARS = ['tree', 'pine-tree', 'palm-tree', 'leaf', 'leaf-maple', 'mushroom', 'owl', 'bee', 'butterfly', 'flower', 'sprout', 'hiking', 'compass', 'bird', 'paw', 'turtle'];
const LEVELS = [[0, 'Semínko'], [1, 'Výhonek'], [5, 'Mladý stromek'], [15, 'Průzkumník hájů'], [40, 'Strážce lesa'], [100, 'Dryáda'], [250, 'Pán staletých dubů']];
const MONTHS = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
const WD = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
const treeLink = (kod) => `${API}/s/strom/${kod}`;
const profLink = (id) => `${API}/s/uzivatel/${id}`;

/* soukromí profilu (klíče odpovídají serveru) */
const PRIV = [
  ['board', 'trophy-outline', 'Zobrazovat mě v žebříčku', 'Bez toho tě ostatní nenajdou ani ve vyhledávání uživatelů.'],
  ['bio', 'text-account', 'Krátké představení', ''],
  ['stats', 'chart-box-outline', 'Počty a body', 'Stromy, fotky, lajky, body, titul a pořadí.'],
  ['history', 'history', 'Historie odkliků', 'Včetně kalendáře návštěv a statistik.'],
  ['photos', 'image-multiple-outline', 'Fotky', ''],
  ['challenges', 'flag-checkered', 'Výzvy', ''],
  ['badges', 'medal-outline', 'Odznaky', ''],
];
const UPD = [
  ['wifi', 'wifi', 'Jen přes WiFi', 'Doporučeno. Na mobilních datech se nic nestahuje.'],
  ['always', 'signal-cellular-3', 'WiFi i mobilní data', 'Stahuje se jen tehdy, když se seznam stromů změnil.'],
  ['off', 'cloud-off-outline', 'Vypnuto', 'Seznam stromů aktualizuješ ručně v Offline režimu.'],
];
const DEF_SET = { upd: 'wifi', sound: true, rot: true, dailyReminder: false, nearbyNotif: false, language: 'cs' };

/* filtr mapy */
const F0 = { st: 'all', fv: 'all', sp: [], ob: 0, vy: 0, sa: 0, fav: false };
const OB_P = [[0, 'Libovolný'], [300, 'od 3 m'], [500, 'od 5 m'], [700, 'od 7 m'], [1000, 'od 10 m']];
const VY_P = [[0, 'Libovolná'], [20, 'od 20 m'], [30, 'od 30 m'], [40, 'od 40 m']];
const SA_P = [[0, 'Libovolné'], [100, 'od 100 let'], [200, 'od 200 let'], [300, 'od 300 let'], [500, 'od 500 let'], [1000, 'od 1000 let']];
const fCount = (f) => (f.st !== 'all') + (f.fv !== 'all') + (f.sp.length > 0) + (f.ob > 0) + (f.vy > 0) + (f.sa > 0) + !!f.fav;
/* p = [kod, název, lon, lat, druh, počet, obvod cm, výška m, stáří let] (0 = neznámé) */
function applyFilter(points, f, visited, taken, favorites = []) {
  if (!fCount(f)) return points;
  const sp = f.sp.length ? new Set(f.sp) : null;
  const useTaken = f.fv !== 'all' && taken;
  return points.filter((p) => {
    const v = visited.has(p[0]);
    if (f.fav && !favorites.includes(p[0])) return false;
    if (f.st === 'new' && v) return false;
    if (f.st === 'done' && !v) return false;
    if (sp && !sp.has(p[4] || 'Jiný')) return false;
    if (f.ob && !((p[6] || 0) >= f.ob)) return false;
    if (f.vy && !((p[7] || 0) >= f.vy)) return false;
    if (f.sa && !((p[8] || 0) >= f.sa)) return false;
    if (useTaken && (f.fv === 'free') === taken.has(p[0])) return false;
    return true;
  });
}

/* zvuky úspěchu (assets/win.wav, assets/fanfare.wav) */
const SND = { win: require('./assets/win.wav'), fanfare: require('./assets/fanfare.wav') };
const players = {};
const playSound = (k) => {
  try { const p = (players[k] = players[k] || createAudioPlayer(SND[k])); p.seekTo(0); p.play(); } catch (e) {}
};

/* statické styly vrstev mapy (mimo komponentu = žádné zbytečné překreslování nativní mapy) */
const DEF_CAM = { centerCoordinate: [15.4, 49.8], zoomLevel: 6.3 };
const HIT = { width: 28, height: 28 };
const F_CL = ['has', 'point_count'];
const F_PT = ['!', ['has', 'point_count']];
const F_OK = ['all', ['!', ['has', 'point_count']], ['==', ['get', 'v'], 1]];
const ST_RANGE_F = { fillColor: '#7fb069', fillOpacity: 0.25 };
const ST_RANGE_L = { lineColor: '#4f7a3a', lineWidth: 2, lineDasharray: [2, 2] };
const ST_CL = { circleColor: ['interpolate', ['linear'], ['get', 'point_count'], 10, '#7fb069', 100, '#4f7a3a', 500, '#1f3d2b'], circleRadius: ['step', ['get', 'point_count'], 16, 20, 21, 100, 27], circleStrokeWidth: 3, circleStrokeColor: '#fffdf6' };
const ST_CLN = { textField: ['get', 'point_count_abbreviated'], textSize: 13, textColor: '#ffffff', textFont: ['DIN Pro Bold', 'Arial Unicode MS Bold'], textAllowOverlap: true };
const ST_HEAT = { heatmapWeight: ['interpolate', ['linear'], ['get', 'intensity'], 0, 0, 1, 1], heatmapIntensity: ['interpolate', ['linear'], ['zoom'], 5, 0.7, 14, 2.2], heatmapRadius: ['interpolate', ['linear'], ['zoom'], 5, 14, 14, 34], heatmapOpacity: 0.78, heatmapColor: ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(127,176,105,0)', 0.2, '#7fb069', 0.45, '#e9b44c', 0.7, '#c8553d'] };
const ST_PTH = { circleRadius: ['interpolate', ['linear'], ['zoom'], 8, 7, 16, 16], circleColor: '#fffdf6' };
const ST_PT = { circleRadius: ['interpolate', ['linear'], ['zoom'], 8, 5, 16, 12], circleColor: ['case', ['==', ['get', 'v'], 1], '#e9b44c', '#4f7a3a'], circleStrokeWidth: 2, circleStrokeColor: ['case', ['==', ['get', 'v'], 1], '#a8741a', '#1f3d2b'] };
const ST_OK = { textField: '✓', textSize: 13, textColor: '#4a3200', textAllowOverlap: true };
const ST_MEH = { circleRadius: 13, circleColor: '#2f80ed', circleOpacity: 0.25 };
const ST_MED = { circleRadius: 7, circleColor: '#2f80ed', circleStrokeWidth: 3, circleStrokeColor: '#ffffff' };
const ST_M_TREE = { circleRadius: 10, circleColor: '#1f3d2b', circleStrokeWidth: 2, circleStrokeColor: '#ffffff' };
const ST_M_ALL = { circleRadius: 4, circleColor: '#7fb069', circleOpacity: 0.75, circleStrokeWidth: 1, circleStrokeColor: '#ffffff' };
const ST_M_MINE = { circleRadius: 7, circleColor: '#e9b44c', circleStrokeWidth: 2.5, circleStrokeColor: '#a8741a' };

/* ============================== pomocné funkce ============================== */
let TOKEN = null;
async function api(path, { method, json, form } = {}) {
  const h = {};
  if (TOKEN) h.Authorization = 'Bearer ' + TOKEN;
  let body;
  if (json) { h['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  const r = await fetch(API + '/api' + path, { method: method || (body ? 'POST' : 'GET'), headers: h, body });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'Něco se pokazilo'), { code: r.status });
  return d;
}
/* nahrání souboru: globální fetch v Expu neumí RN FormData část {uri,name,type} ("Unsupported FormDataPart implementation"),
   XMLHttpRequest ji podporuje nativně a nepotřebuje žádný další balíček */
function upload(path, field, uri, name = 'p.jpg') {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', API + '/api' + path);
    if (TOKEN) xhr.setRequestHeader('Authorization', 'Bearer ' + TOKEN);
    xhr.timeout = 90000;
    xhr.onload = () => {
      let d = {}; try { d = JSON.parse(xhr.responseText); } catch (e) {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(d);
      else reject(Object.assign(new Error(d.error || 'Nahrání se nepovedlo'), { code: xhr.status }));
    };
    xhr.onerror = () => reject(new Error('Nahrání selhalo – jsi online?'));
    xhr.ontimeout = () => reject(new Error('Nahrání trvalo příliš dlouho – zkus to znovu.'));
    const form = new FormData();
    form.append(field, { uri, name, type: 'image/jpeg' });
    xhr.send(form);
  });
}
/* seznam stromů s ETagem: server odpoví 304, pokud se nezměnil (šetří data i baterii) */
async function fetchTrees(etag) {
  const r = await fetch(API + '/api/trees', { headers: etag ? { 'If-None-Match': etag } : {} });
  if (r.status === 304) return { same: true };
  if (!r.ok) throw new Error('http ' + r.status);
  return { points: await r.json(), etag: r.headers.get('ETag') || r.headers.get('etag') };
}
async function netInfo() {
  try {
    const n = await Network.getNetworkStateAsync();
    const t = n.type;
    return { on: n.isConnected !== false && n.isInternetReachable !== false, wifi: t === Network.NetworkStateType.WIFI || t === Network.NetworkStateType.ETHERNET };
  } catch (e) { return { on: true, wifi: false }; }
}
async function autoOk(st) {
  if (st.upd === 'off') return false;
  const n = await netInfo();
  return st.upd === 'always' ? n.on : n.on && n.wifi;
}
const jparse = (x, d) => { try { return x ? JSON.parse(x) : d; } catch (e) { return d; } };

/* trvalá lokální kopie profilovky přihlášeného uživatele (documentDirectory = systém ji sám nemaže).
   Maže se jen při změně/odebrání fotky v appce a při odhlášení. Změna z webu se hlídá po startu appky, jen na WiFi. */
const AV_DIR = FileSystem.documentDirectory + 'avatar/';
const AV_KEY = 'sb_avatar';
const avCache = { name: null, uri: null, etag: null, lm: null };   // name = soubor na serveru, uri = lokální kopie
const avListeners = new Set();
let avBusy = false;
const avSet = (v) => { Object.assign(avCache, { name: null, uri: null, etag: null, lm: null }, v || {}); avListeners.forEach((f) => f()); };
async function avClear() {
  try { await FileSystem.deleteAsync(AV_DIR, { idempotent: true }); } catch (e) {}
  avSet(null); AsyncStorage.removeItem(AV_KEY).catch(() => {});
}
async function avLoad() {   // při startu: obnoví údaje o uložené kopii (pokud soubor ještě existuje)
  try {
    const m = jparse(await AsyncStorage.getItem(AV_KEY), null);
    if (!m) return;
    if (m.uri && (await FileSystem.getInfoAsync(m.uri)).exists) avSet(m); else await avClear();
  } catch (e) {}
}
/* stáhne profilovku; vrací true, když se uložila nová kopie (304 / chyba = false) */
async function avFetch(photo, headers) {
  const tmp = AV_DIR + 'tmp.jpg';
  try {
    await FileSystem.makeDirectoryAsync(AV_DIR, { intermediates: true }).catch(() => {});
    const r = await FileSystem.downloadAsync(API + '/uploads/' + photo, tmp, headers ? { headers } : undefined);
    if (r.status !== 200) { await FileSystem.deleteAsync(tmp, { idempotent: true }); return false; }
    const h = {}; for (const k in (r.headers || {})) h[k.toLowerCase()] = r.headers[k];
    const dest = AV_DIR + 'p' + Date.now() + '.jpg', old = avCache.uri;   // vždy nový název souboru, ať Image nedrží starou verzi v paměti
    await FileSystem.moveAsync({ from: tmp, to: dest });
    avSet({ name: photo, uri: dest, etag: h.etag || null, lm: h['last-modified'] || null });
    AsyncStorage.setItem(AV_KEY, JSON.stringify(avCache)).catch(() => {});
    if (old && old !== dest) FileSystem.deleteAsync(old, { idempotent: true }).catch(() => {});
    return true;
  } catch (e) { FileSystem.deleteAsync(tmp, { idempotent: true }).catch(() => {}); return false; }
}
/* check = true při startu appky: na WiFi ověří (podmíněným GETem, ~0 B při 304), zda se fotka na serveru nezměnila */
async function avSync(photo, check) {
  if (avBusy) return;
  avBusy = true;
  try {
    if (!photo) { if (avCache.name) await avClear(); return; }
    const n = await netInfo();
    if (!n.on) return;
    if (avCache.name === photo && avCache.uri) {
      if (!check || !n.wifi) return;
      const hd = {};
      if (avCache.etag) hd['If-None-Match'] = avCache.etag;
      if (avCache.lm) hd['If-Modified-Since'] = avCache.lm;
      await avFetch(photo, Object.keys(hd).length ? hd : null);
    } else if (!avCache.uri || n.wifi) await avFetch(photo, null);   // jiná fotka než v cache: mimo WiFi zůstane stará kopie, dokud se nepřipojíš
  } finally { avBusy = false; }
}
/* uživatel právě změnil fotku v appce: stará kopie pryč, nová se stáhne hned (bez ohledu na síť) */
async function avReplace(photo) { await avClear(); try { await avFetch(photo, null); } catch (e) {} }
function useAvatarUri(photo) {
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump((n) => n + 1); avListeners.add(f); return () => { avListeners.delete(f); }; }, []);
  if (!photo) return null;
  return avCache.name === photo && avCache.uri ? avCache.uri : API + '/uploads/' + photo;
}
const rad = Math.PI / 180;
const hav = (a, b, c, d) => {
  const x = Math.sin(((c - a) * rad) / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(((d - b) * rad) / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(x));
};
const bearing = (la1, lo1, la2, lo2) => {
  const y = Math.sin((lo2 - lo1) * rad) * Math.cos(la2 * rad);
  const x = Math.cos(la1 * rad) * Math.sin(la2 * rad) - Math.sin(la1 * rad) * Math.cos(la2 * rad) * Math.cos((lo2 - lo1) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
};
const fmtD = (m) => (m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km');
const level = (n) => [...LEVELS].reverse().find((l) => n >= l[0]);
const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const fc = (features) => ({ type: 'FeatureCollection', features });
const pointF = (lon, lat, props = {}) => ({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: [lon, lat] } });
function ring(lon, lat, r) {
  const c = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * 2 * Math.PI;
    c.push([lon + (r * Math.cos(a)) / (111320 * Math.cos(lat * rad)), lat + (r * Math.sin(a)) / 110540]);
  }
  return fc([{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [c] } }]);
}
const p2 = (n) => String(n).padStart(2, '0');
const utc = (c) => new Date(String(c).replace(' ', 'T') + 'Z');
const dayKey = (c) => { const t = utc(c); return t.getFullYear() + '-' + p2(t.getMonth() + 1) + '-' + p2(t.getDate()); };
const fmtDay = (k) => { const [y, m, d] = k.split('-'); return `${+d}. ${+m}. ${y}`; };
const hmOf = (c) => { const t = utc(c); return p2(t.getHours()) + ':' + p2(t.getMinutes()); };
const ago = (c) => {
  const t = utc(c), now = new Date();
  const hm = t.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 864e5);
  if (days <= 0) return 'dnes ' + hm;
  if (days === 1) return 'včera ' + hm;
  if (days < 7) return `před ${days} dny`;
  return t.toLocaleDateString('cs-CZ');
};
const dayTree = (points) => (points.length ? points[(Math.floor(Date.now() / 864e5) * 7919) % points.length] : null);
/* odkazy: https://HOST/s/strom/123, https://HOST/s/uzivatel/5, stromobrani://strom/123 */
const parseLink = (url) => {
  const m = /(?:\/s\/|stromobrani:\/\/\/?)(strom|uzivatel)\/(\d+)/.exec(String(url || ''));
  return m ? { type: m[1], id: +m[2] } : null;
};

/* ============================== ikony a drobné komponenty ============================== */
const GM = MCI.glyphMap || {};
const Ic = React.memo(({ n, s: size = 20, c = C.ink, style }) => <MCI name={GM[n] ? n : 'help-circle-outline'} size={size} color={c} style={style} />);
const Close = ({ onPress, style }) => <T style={[s.x, style]} onPress={onPress} hitSlop={8}><Ic n="close" s={18} /></T>;

/* hodnocení: výběr (onChange) i pouhé zobrazení */
const Stars = React.memo(({ v, onChange, size = 36 }) => (
  <View style={{ flexDirection: 'row', gap: 4, marginVertical: 6 }}>
    {[1, 2, 3, 4, 5].map((i) => (
      <T key={i} disabled={!onChange} onPress={() => onChange(i)} hitSlop={4}>
        <Ic n={i <= v ? 'star' : 'star-outline'} s={size} c={i <= v ? C.sun : '#cfc9ae'} />
      </T>
    ))}
  </View>
));
const Rate = React.memo(({ v, s: size = 14 }) => (
  <View style={{ flexDirection: 'row' }}>
    {[1, 2, 3, 4, 5].map((i) => <Ic key={i} n={i <= Math.round(v) ? 'star' : 'star-outline'} s={size} c={i <= Math.round(v) ? C.sun : '#cfc9ae'} />)}
  </View>
));
const Btn = ({ title, icon, onPress, disabled, ghost, style }) => (
  <T onPress={onPress} disabled={disabled} activeOpacity={0.8}
    style={[s.btn, ghost && s.btnGhost, disabled && { backgroundColor: '#c9c6b2' }, style]}>
    <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      {!!icon && <Ic n={icon} s={20} c={ghost ? C.forest : '#fff'} />}
      <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={2} style={[s.btnT, { flexShrink: 1, textAlign: 'center' }, ghost && { color: C.forest }]}>{title}</Text>
    </View>
  </T>
);
/* avatar: vlastní fotka (photo) má přednost; jinak ikona (nové avatary) nebo emoji (starší účty) */
const Av = React.memo(({ a, photo, size = 42 }) => {
  const uri = useAvatarUri(photo);   // lokální kopie, je-li to fotka přihlášeného uživatele; jinak ze serveru
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#dfeccf', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {photo
        ? <Image source={{ uri }} resizeMethod="resize" fadeDuration={0} style={{ width: size, height: size }} />
        : GM[a] ? <Ic n={a} s={size * 0.58} c={C.moss} /> : <Text style={{ fontSize: size * 0.55 }}>{a}</Text>}
    </View>
  );
});
const H3 = ({ t, off, style }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, style]}>
    <Text style={s.h3}>{t}</Text>
    {off && <Ic n="eye-off-outline" s={16} c={C.mute} />}
  </View>
);
const Hidden = ({ t = 'Tuto část profilu uživatel skryl.' }) => (
  <View style={s.hid}><Ic n="eye-off-outline" s={18} c={C.mute} /><Text style={[s.sm, { flex: 1 }]}>{t}</Text></View>
);
const Bars = ({ rows, color }) => {
  const mx = Math.max(1, ...rows.map((r) => r[1]));
  return rows.map(([l, n]) => (
    <View key={l} style={s.brow}>
      <Text style={s.bl} numberOfLines={1}>{l}</Text>
      <View style={s.bt}><View style={{ width: (n / mx) * 100 + '%', height: '100%', backgroundColor: color || C.leaf, borderRadius: 6 }} /></View>
      <Text style={s.bn}>{n}</Text>
    </View>
  ));
};
const Seg = ({ v, opts, onChange }) => (
  <View style={s.seg}>
    {opts.map(([k, l]) => (
      <T key={k} onPress={() => onChange(k)} style={[s.segi, v === k && s.segOn]}><Text style={[s.segt, v === k && { color: '#fff' }]}>{l}</Text></T>
    ))}
  </View>
);
const Presets = ({ v, opts, onChange }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
    {opts.map(([k, l]) => (
      <T key={k} onPress={() => onChange(k)} style={[s.chip, v === k && s.chipOn]}><Text style={[s.chipT, v === k && { color: '#fff' }]}>{l}</Text></T>
    ))}
  </View>
);
/* dendrometrické údaje stromu (druh, obvod, výška, stáří) */
const Facts = React.memo(({ t }) => {
  const it = [
    t.druh && t.druh !== 'Jiný' ? ['tree', t.druh] : null,
    t.obvod ? ['tape-measure', `obvod ${t.obvod} cm`] : null,
    t.vyska ? ['human-male-height', `výška ${String(t.vyska).replace('.', ',')} m`] : null,
    t.stari ? ['history', `stáří ~${t.stari} let`] : null,
  ].filter(Boolean);
  if (!it.length) return null;
  return <View style={s.facts}>{it.map(([i, l]) => <View key={l} style={s.fact}><Ic n={i} s={15} c={C.moss} /><Text style={s.factT}>{l}</Text></View>)}</View>;
});
const Credits = () => {
  const L = ({ h, t, url }) => (
    <T disabled={!url} onPress={() => url && Linking.openURL(url)} style={{ marginTop: 8 }}>
      <Text style={s.credH2}>{h}</Text>
      <Text style={[s.credT, !!url && { color: C.moss }]}>{t}{url ? ' ↗' : ''}</Text>
    </T>
  );
  return (
    <View style={s.cred}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Ic n="information-outline" s={18} c={C.mute} /><Text style={s.credH}>Zdroje a poděkování</Text></View>
      <L h="Data památných stromů" t="© AOPK ČR – Ústřední seznam ochrany přírody" url="https://drusop.nature.cz" />
      <L h="Chráněné stromy na Slovensku" t="© Štátna ochrana prírody SR" url="https://www.sopsr.sk" />
      <L h="Obvod, výška a stáří stromů" t="© přispěvatelé OpenStreetMap (ODbL)" url="https://www.openstreetmap.org/copyright" />
      <L h="Mapové podklady" t="© Mapbox, © OpenStreetMap" url="https://www.mapbox.com/about/maps/" />
      <L h="Ikony" t="Material Design Icons (Pictogrammers)" url="https://pictogrammers.com/library/mdi/" />
      <L h="Výpočet tras" t="© 2018 Valhalla contributors · © 2015–2017 Mapillary AB, Mapzen · MIT" url="https://github.com/valhalla/valhalla/blob/master/COPYING" />
      <L h="Technologie" t="Expo, React Native, Flask" />
      <Text style={s.copy}>(C) Michal Schneider 2026</Text>
      <Text style={[s.credT, { textAlign: 'center' }]}>Stromobraní {VERSION}</Text>
    </View>
  );
};

/* ============================== fotka na celou obrazovku ============================== */
function Full({ photos = [], photoId, onClose, onLike, onPhotoChange, canLike, onProfile }) {
  const { width, height } = useWindowDimensions();
  const listRef = useRef(null);
  const [index, setIndex] = useState(0);
  const selectedIndex = photos.findIndex((photo) => photo.id === photoId);
  useEffect(() => {
    if (selectedIndex < 0) return;
    setIndex(selectedIndex);
    requestAnimationFrame(() => listRef.current?.scrollToIndex({ index: selectedIndex, animated: false }));
  }, [photoId, selectedIndex]);
  const activeIndex = selectedIndex >= 0 ? selectedIndex : index;
  const p = photos[activeIndex];
  if (photoId == null || !p) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <FlatList ref={listRef} data={photos} horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyExtractor={(photo) => String(photo.id)} initialScrollIndex={Math.max(0, selectedIndex)} getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })} onMomentumScrollEnd={(e) => { const next = Math.round(e.nativeEvent.contentOffset.x / width); setIndex(next); if (photos[next]) onPhotoChange?.(photos[next].id); }} renderItem={({ item }) => <T activeOpacity={1} onPress={onClose} style={{ width, height, alignItems: 'center', justifyContent: 'center' }}><Image source={{ uri: item.uri || API + '/uploads/' + item.file }} resizeMode="contain" style={{ width, height: height * 0.85 }} /></T>} />
        <Close onPress={onClose} style={{ top: 40, backgroundColor: '#fffdf6dd' }} />
        {photos.length > 1 && <View pointerEvents="none" style={{ position: 'absolute', top: 46, left: 22, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#0008' }}><Text style={{ color: '#fff', fontWeight: '800' }}>{activeIndex + 1} / {photos.length}</Text></View>}
        <View pointerEvents="box-none" style={{ position: 'absolute', bottom: 34, left: 0, right: 0, alignItems: 'center', gap: 10 }}>
          {!!p.username && <T disabled={!p.uid || !onProfile} onPress={() => p.uid && onProfile?.(p.uid)} accessibilityRole="button" accessibilityLabel={`Otevřít profil uživatele ${p.username}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ffffff22', borderRadius: 24, paddingHorizontal: 12, paddingVertical: 7 }}><Av a={p.avatar} photo={p.authorPhoto || p.photo} size={30} /><Text style={{ color: '#fff', fontWeight: '700' }}>{p.username}</Text>{!!p.uid && <Ic n="chevron-right" s={16} c="#fff" />}</T>}
          {!!onLike && (!canLike || canLike(p)) && <T onPress={() => onLike(p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: p.liked ? C.red : '#ffffff33', borderRadius: 99, paddingHorizontal: 20, paddingVertical: 10 }}><Ic n="heart" s={18} c="#fff" /><Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{p.likes}</Text></T>}
        </View>
      </View>
    </Modal>
  );
}

/* ============================== druh stromu: spodní panel s odkliknutými stromy ============================== */
function SpeciesSheet({ name, trees = [], onClose, onTree }) {
  const { height } = useWindowDimensions();
  if (!name) return null;
  const seen = new Set();
  const list = trees.filter((t) => { if (seen.has(t.kod)) return false; seen.add(t.kod); return true; })
    .sort((a, b) => String(b.created).localeCompare(String(a.created)));
  const n = list.length, word = n === 1 ? 'strom' : n >= 2 && n <= 4 ? 'stromy' : 'stromů';
  const first = n ? list[n - 1] : null;
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#1f3d2bcc', justifyContent: 'flex-end' }}>
        <T activeOpacity={1} onPress={onClose} style={{ flex: 1 }} accessibilityLabel="Zavřít" />
        <View style={{ backgroundColor: C.paper, maxHeight: height * 0.78, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }}>
          <View style={{ backgroundColor: C.forest, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 16 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#ffffff44', alignSelf: 'center', marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 44 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#ffffff22', alignItems: 'center', justifyContent: 'center' }}><Ic n="tree" s={28} c={C.sun} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontFamily: SERIF, fontWeight: '800', fontSize: 22 }} numberOfLines={2}>{name}</Text>
                <Text style={{ color: '#dbe7d4', marginTop: 2 }}>Odklikáno: {n} {word}{first ? `  ·  první ${fmtDay(dayKey(first.created))}` : ''}</Text>
              </View>
            </View>
            <Close onPress={onClose} style={{ top: 22, right: 14 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 28 }}>
            {list.map((t) => (
              <T key={t.kod} style={s.row} onPress={() => { onClose(); onTree(t.kod); }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#dfeccf', alignItems: 'center', justifyContent: 'center' }}><Ic n="tree" s={22} c={C.moss} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.b} numberOfLines={1}>{t.name}</Text>
                  <Text style={s.sm} numberOfLines={1}>{fmtDay(dayKey(t.created))}{t.okres ? `  ·  ${t.okres}` : ''}{t.pts ? `  ·  +${t.pts} b` : ''}</Text>
                </View>
                <Rate v={t.rating} />
                <Ic n="chevron-right" s={20} c={C.mute} />
              </T>
            ))}
            {!n && <Text style={s.sm}>Žádné odklikané stromy tohoto druhu.</Text>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function decodePolyline6(encoded) {
  let index = 0, lat = 0, lon = 0;
  const points = [];
  while (index < encoded.length) {
    const read = () => {
      let result = 0, shift = 0, byte;
      do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20 && index < encoded.length);
      return (result & 1) ? ~(result >> 1) : (result >> 1);
    };
    lat += read(); lon += read();
    points.push([lon / 1e6, lat / 1e6]);
  }
  return points;
}

function WalkingRouteModal({ route, treeName, routeProfile = 'pedestrian', onClose, onOpenMaps }) {
  const [showMap, setShowMap] = useState(false);
  const coordinates = useMemo(() => (route?.trip?.legs || []).flatMap((leg) => leg.shape ? decodePolyline6(leg.shape) : []), [route]);
  const routeFeature = useMemo(() => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } }), [coordinates]);
  if (!route) return null;
  const summary = route.trip.summary;
  const modeLabel = routeProfile === 'bicycle' ? 'Cyklistická trasa' : routeProfile === 'auto' ? 'Trasa autem' : 'Pěší trasa';
  const maneuvers = route.trip.legs?.[0]?.maneuvers || [];
  const distance = summary.length < 1
    ? `${Math.round(summary.length * 1000)} m`
    : `${summary.length.toFixed(1).replace('.', ',')} km`;
  const exportGpx = async () => {
    if (coordinates.length < 2) return Alert.alert('GPX není dostupné', 'Valhalla neposkytla geometrii trasy.');
    const safeName = (treeName || 'strom').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'strom';
    const track = coordinates.map(([lon, lat]) => `      <trkpt lat="${lat}" lon="${lon}"></trkpt>`).join('\n');
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Stromobraní" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${safeName}</name></metadata><trk><name>${modeLabel} – ${safeName}</name><trkseg>\n${track}\n    </trkseg></trk></gpx>`;
    try {
      const uri = FileSystem.cacheDirectory + `stromobrani-${safeName}.gpx`;
      await FileSystem.writeAsStringAsync(uri, gpx, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/gpx+xml', dialogTitle: 'Exportovat GPX' });
      else Alert.alert('GPX exportováno', uri);
    } catch (e) { Alert.alert('Export GPX se nezdařil', e.message || 'Zkus to prosím znovu.'); }
  };
  const bounds = coordinates.length ? coordinates.reduce((b, [lon, lat]) => ({ west: Math.min(b.west, lon), east: Math.max(b.east, lon), south: Math.min(b.south, lat), north: Math.max(b.north, lat) }), { west: 180, east: -180, south: 90, north: -90 }) : null;
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#1f3d2bcc', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.paper, maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 26 }}>
          <View style={[s.rowi, { justifyContent: 'space-between', paddingRight: 42 }]}>
            <View style={{ flex: 1 }}><Text style={s.h2}>{modeLabel}</Text><Text style={s.sm} numberOfLines={2}>{treeName} · Valhalla</Text></View>
            <Close onPress={onClose} style={{ top: 0, right: 0 }} />
          </View>
          <View style={[s.card, { flexDirection: 'row', justifyContent: 'space-around', marginTop: 14 }]}>
            <View style={{ alignItems: 'center' }}><Text style={s.h3}>{distance}</Text><Text style={s.sm}>vzdálenost</Text></View>
            <View style={{ alignItems: 'center' }}><Text style={s.h3}>~{Math.max(1, Math.round(summary.time / 60))} min</Text><Text style={s.sm}>{routeProfile === 'bicycle' ? 'na kole' : routeProfile === 'auto' ? 'autem' : 'pěšky'}</Text></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Btn style={{ flex: 1 }} ghost icon={showMap ? 'map-marker-off-outline' : 'map-outline'} title={showMap ? 'Skrýt mapu' : 'Zobrazit na mapě'} onPress={() => setShowMap((v) => !v)} />
            <Btn style={{ flex: 1 }} ghost icon="export-variant" title="Exportovat GPX" onPress={exportGpx} />
          </View>
          {showMap && <View style={[s.mini, { height: 220, marginTop: 10, overflow: 'hidden' }]}>
            {coordinates.length > 1 ? <Mapbox.MapView style={{ flex: 1 }} styleURL={STYLE} logoEnabled attributionEnabled rotateEnabled={false} pitchEnabled={false}>
              <Mapbox.Camera defaultSettings={{ bounds: { ne: [bounds.east, bounds.north], sw: [bounds.west, bounds.south], paddingTop: 24, paddingBottom: 24, paddingLeft: 24, paddingRight: 24 } }} />
              <Mapbox.ShapeSource id="walking-route-preview" shape={routeFeature}>
                <Mapbox.LineLayer id="walking-route-preview-line" style={{ lineColor: C.moss, lineWidth: 5, lineCap: 'round', lineJoin: 'round' }} />
              </Mapbox.ShapeSource>
            </Mapbox.MapView> : <Text style={[s.sm, { padding: 16 }]}>Mapu trasy se nepodařilo načíst.</Text>}
          </View>}
          <Text style={[s.b, { marginTop: 12, marginBottom: 6 }]}>Pokyny</Text>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 7, paddingBottom: 8 }}>
            {maneuvers.length ? maneuvers.map((m, i) => (
              <View key={`${i}-${m.type}`} style={[s.rowi, { alignItems: 'flex-start', backgroundColor: '#f5f1e5', borderRadius: 12, padding: 10 }]}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#e3f1d3', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C.forest, fontSize: 12, fontWeight: '800' }}>{i + 1}</Text></View>
                <View style={{ flex: 1 }}><Text style={{ color: C.ink, fontWeight: '700' }}>{m.instruction || m.verbal_pre_transition_instruction || 'Pokračuj po trase'}</Text>{m.length > 0 && <Text style={s.sm}>{m.length < 1 ? `${Math.round(m.length * 1000)} m` : `${m.length.toFixed(1).replace('.', ',')} km`}</Text>}</View>
              </View>
            )) : <Text style={s.sm}>Valhalla vypočítala trasu. Podrobné pokyny nejsou k dispozici.</Text>}
          </ScrollView>
          <Btn icon="navigation-variant-outline" title="Navigovat v Mapách" onPress={onOpenMaps} />
        </View>
      </View>
    </Modal>
  );
}

/* ============================== kalendář návštěv ============================== */
const Cal = React.memo(function Cal({ trees, onTree }) {
  const [ym, setYm] = useState(() => { const n = new Date(); return [n.getFullYear(), n.getMonth()]; });
  const [sd, setSd] = useState(null);
  const byDay = useMemo(() => { const m = {}; trees.forEach((t) => { (m[dayKey(t.created)] ??= []).push(t); }); return m; }, [trees]);
  const [y, mo] = ym;
  const lead = (new Date(y, mo, 1).getDay() + 6) % 7, dim = new Date(y, mo + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const key = (d) => `${y}-${p2(mo + 1)}-${p2(d)}`;
  const total = cells.reduce((a, d) => a + (d ? (byDay[key(d)] || []).length : 0), 0);
  const nw = new Date(), tk = nw.getFullYear() + '-' + p2(nw.getMonth() + 1) + '-' + p2(nw.getDate());
  const shift = (n) => { const d = new Date(y, mo + n, 1); setYm([d.getFullYear(), d.getMonth()]); setSd(null); };
  const list = sd && byDay[sd] ? [...byDay[sd]].sort((a, b) => (a.created < b.created ? -1 : 1)) : null;
  return (
    <View style={s.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T onPress={() => shift(-1)} style={s.arr}><Ic n="chevron-left" s={28} c={C.forest} /></T>
        <Text style={s.h3}>{MONTHS[mo]} {y}</Text>
        <T onPress={() => shift(1)} style={s.arr}><Ic n="chevron-right" s={28} c={C.forest} /></T>
      </View>
      <Text style={[s.sm, { textAlign: 'center', marginBottom: 8 }]}>{total ? `${total}× v tomto měsíci` : 'V tomto měsíci žádné návštěvy'}</Text>
      <View style={s.wk}>{WD.map((w) => <Text key={w} style={s.wd}>{w}</Text>)}</View>
      <View style={s.wk}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={s.cd} />;
          const k = key(d), n = (byDay[k] || []).length;
          return (
            <T key={i} style={s.cd} disabled={!n} onPress={() => setSd(sd === k ? null : k)}>
              <View style={[s.cdi, n > 0 && { backgroundColor: n >= 3 ? C.moss : n === 2 ? C.leaf : '#cfe3bd' }, k === tk && { borderWidth: 2, borderColor: C.sun }, sd === k && { borderWidth: 2, borderColor: C.forest }]}>
                <Text style={[s.cdt, n >= 2 && { color: '#fff' }]}>{d}</Text>
                {n > 1 && <Text style={s.cdn}>{n}×</Text>}
              </View>
            </T>
          );
        })}
      </View>
      {list && (
        <View style={{ marginTop: 10 }}>
          <Text style={s.b}>{fmtDay(sd)}</Text>
          {list.map((t) => (
            <T key={t.vid} style={s.row} onPress={() => onTree(t.kod)}>
              <Av a={TR[t.transport][0]} size={36} />
              <View style={{ flex: 1 }}><Text style={s.b} numberOfLines={1}>{t.name}</Text><Text style={s.sm}>{hmOf(t.created)} · {TR[t.transport][1]}</Text></View>
              <Rate v={t.rating} />
            </T>
          ))}
        </View>
      )}
    </View>
  );
});

/* ============================== statistiky odkliků ============================== */
const Stats = React.memo(function Stats({ trees }) {
  const st = useMemo(() => {
    const cnt = (f) => { const m = {}; trees.forEach((t) => { const k = f(t); if (k != null && k !== '') m[k] = (m[k] || 0) + 1; }); return m; };
    const top = (m, n = 6) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n);
    const days = [...new Set(trees.map((t) => dayKey(t.created)))].sort();
    let best = 0, run = 0, prev = null;
    days.forEach((d) => { const cur = new Date(d + 'T12:00:00'); run = prev && Math.round((cur - prev) / 864e5) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = cur; });
    /* aktuální série: po sobě jdoucí dny s odklikem; trvá, pokud poslední odklik byl dnes nebo včera */
    let cur = 0;
    if (days.length) {
      const tk = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      const now = new Date(), yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const last = days[days.length - 1];
      if (last === tk(now) || last === tk(yest)) {
        cur = 1;
        for (let i = days.length - 1; i > 0; i--) {
          const a = new Date(days[i] + 'T12:00:00'), b = new Date(days[i - 1] + 'T12:00:00');
          if (Math.round((a - b) / 864e5) === 1) cur++; else break;
        }
      }
    }
    const wd = [0, 0, 0, 0, 0, 0, 0];
    trees.forEach((t) => { wd[(utc(t.created).getDay() + 6) % 7]++; });
    const mcount = cnt((t) => dayKey(t.created).slice(0, 7));
    const now = new Date(), months = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push([MONTHS[d.getMonth()].slice(0, 3), mcount[d.getFullYear() + '-' + p2(d.getMonth() + 1)] || 0]); }
    return {
      avg: trees.length ? trees.reduce((a, t) => a + t.rating, 0) / trees.length : 0, active: days.length, streak: best, cur,
      sections: [
        ['Podle dopravy', top(cnt((t) => (TR[t.transport] ? TR[t.transport][1] : null)))],
        ['Počasí', top(cnt((t) => (WX[t.weather] ? WX[t.weather][1] : null)))],
        ['Hodnocení', [5, 4, 3, 2, 1].map((r) => [r + ' ★', trees.filter((t) => t.rating === r).length])],
        ['Dny v týdnu', WD.map((w, i) => [w, wd[i]])],
        ['Posledních 6 měsíců', months],
        ['Typ stromu', top(cnt((t) => t.druh))],
        ['Okres', top(cnt((t) => t.okres))],
      ].filter(([, rows]) => rows.some((r) => r[1] > 0)),
    };
  }, [trees]);
  if (!trees.length) return <Text style={s.sm}>Zatím žádná data.</Text>;
  return (
    <View style={s.card}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[[st.active, 'aktivních dní'], [st.streak, 'nejdelší série'], [st.cur, 'aktuální série'], [st.avg.toFixed(1).replace('.', ','), 'průměr']].map(([n, l]) => (
          <View key={l} style={s.stat}><Text style={s.statN}>{n}</Text><Text style={[s.sm, { fontSize: 11, textAlign: 'center' }]}>{l}</Text></View>
        ))}
      </View>
      {st.sections.map(([t, rows]) => (
        <View key={t} style={{ marginTop: 14 }}><Text style={[s.b, { marginBottom: 4 }]}>{t}</Text><Bars rows={rows} /></View>
      ))}
    </View>
  );
});

const DistrictCoverage = React.memo(function DistrictCoverage({ trees, points }) {
  const coverage = useMemo(() => {
    const districtByKod = new Map();
    (points || []).forEach((point) => {
      const kod = Array.isArray(point) ? point[0] : point && (point.kod ?? point.KOD);
      const district = Array.isArray(point) ? point[9] : point && (point.okres ?? point.district ?? point.OKRES);
      if (kod != null && district) districtByKod.set(String(kod), district);
    });
    if (!districtByKod.size) return null;

    const totals = new Map();
    districtByKod.forEach((district) => totals.set(district, (totals.get(district) || 0) + 1));
    const mine = new Set((trees || []).map((tree) => String(tree.kod)));
    const started = new Set();
    mine.forEach((kod) => {
      const district = districtByKod.get(kod);
      if (district) started.add(district);
    });
    if (!started.size) return null;

    const total = [...started].reduce((sum, district) => sum + (totals.get(district) || 0), 0);
    const visited = [...mine].filter((kod) => started.has(districtByKod.get(kod))).length;
    if (!total) return null;
    return { percent: Math.round((visited / total) * 100), visited, total, districts: started.size };
  }, [trees, points]);

  if (!coverage) return null;
  return (
    <View style={s.card}>
      <Text style={s.h3}>Stromy v načatých okresech</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <View style={s.stat}><Text style={s.statN}>{coverage.percent} %</Text><Text style={s.sm}>máš z nich</Text></View>
        <View style={s.stat}><Text style={s.statN}>{coverage.visited}/{coverage.total}</Text><Text style={s.sm}>stromů</Text></View>
        <View style={s.stat}><Text style={s.statN}>{coverage.districts}</Text><Text style={s.sm}>okresů</Text></View>
      </View>
    </View>
  );
});

/* ============================== mini mapa odkliků ============================== */
const TreeMap = React.memo(function TreeMap({ kod, tree }) {
  const [pts, setPts] = useState(null);
  const [bad, setBad] = useState(false);
  const [big, setBig] = useState(false);
  useEffect(() => {
    let dead = false; setPts(null); setBad(false);
    api(`/tree/${kod}/clicks`).then((r) => !dead && setPts(r)).catch(() => { if (!dead) { setBad(true); setPts([]); } });
    return () => { dead = true; };
  }, [kod]);
  const sh = useMemo(() => ({
    all: fc((pts || []).filter((p) => !p[2]).map((p) => pointF(p[0], p[1]))),
    mine: fc((pts || []).filter((p) => p[2]).map((p) => pointF(p[0], p[1]))),
    tree: fc(tree.pts.map((p) => pointF(p[0], p[1]))),
  }), [pts, tree]);
  const cs = useMemo(() => {
    let w = 180, e = -180, so = 90, n = -90;
    [...tree.pts, ...(pts || [])].forEach((p) => { w = Math.min(w, p[0]); e = Math.max(e, p[0]); so = Math.min(so, p[1]); n = Math.max(n, p[1]); });
    if (e - w < 0.0006 && n - so < 0.0004) return { centerCoordinate: [(w + e) / 2, (so + n) / 2], zoomLevel: 18 };
    return { bounds: { ne: [e, n], sw: [w, so], paddingTop: 30, paddingBottom: 30, paddingLeft: 30, paddingRight: 30 } };
  }, [pts, tree]);
  const mineN = pts ? pts.filter((p) => p[2]).length : 0;
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={s.h3}>Kde se odklikává</Text>
      {pts === null ? <ActivityIndicator color={C.moss} style={{ margin: 16 }} />
        : bad ? <Text style={[s.sm, { marginTop: 6 }]}>Mapa odkliků je dostupná jen online.</Text>
        : !pts.length ? <Text style={[s.sm, { marginTop: 6 }]}>Zatím žádné odkliky.</Text> : (<>
          <View style={[s.mini, { height: big ? 340 : 170 }]}>
            <Mapbox.MapView key={kod} style={{ flex: 1 }} styleURL={STYLE} scrollEnabled={big} zoomEnabled={big} rotateEnabled={false} pitchEnabled={false}
              compassEnabled={false} scaleBarEnabled={false} logoEnabled attributionEnabled>
              <Mapbox.Camera defaultSettings={cs} />
              <Mapbox.ShapeSource id="mm-tree" shape={sh.tree}><Mapbox.CircleLayer id="mm-tree-l" style={ST_M_TREE} /></Mapbox.ShapeSource>
              <Mapbox.ShapeSource id="mm-all" shape={sh.all}><Mapbox.CircleLayer id="mm-all-l" style={ST_M_ALL} /></Mapbox.ShapeSource>
              <Mapbox.ShapeSource id="mm-mine" shape={sh.mine}><Mapbox.CircleLayer id="mm-mine-l" style={ST_M_MINE} /></Mapbox.ShapeSource>
            </Mapbox.MapView>
            <T style={s.expand} onPress={() => setBig((b) => !b)}><Ic n={big ? 'arrow-collapse' : 'arrow-expand'} s={18} /></T>
          </View>
          <Text style={[s.sm, { marginTop: 6 }]}>
            <Text style={{ color: C.forest }}>●</Text> strom   <Text style={{ color: C.leaf }}>●</Text> ostatní ({pts.length - mineN})   <Text style={{ color: C.sun }}>●</Text> moje ({mineN})
          </Text>
        </>)}
    </View>
  );
});

/* ============================== pole odkliku (nový odklik i úprava) ============================== */
const VisitFields = ({ rating, setRating, tr, setTr, wx, setWx, comment, setComment }) => (
  <View>
    <Stars v={rating} onChange={setRating} />
    <Text style={s.sm}>Jak ses k němu dostal(a)?</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 }}>
      {Object.entries(TR).map(([k, v]) => (
        <T key={k} onPress={() => setTr(k)} style={[s.chip, { flexDirection: 'row', alignItems: 'center', gap: 6 }, tr === k && s.chipOn]}>
          <Ic n={v[0]} s={17} c={tr === k ? '#fff' : C.ink} />
          <Text style={[s.chipT, tr === k && { color: '#fff' }]}>{v[1]}</Text>
        </T>
      ))}
    </View>
    <Text style={s.sm}>Jaké je počasí? (nepovinné)</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 }}>
      {Object.entries(WX).map(([k, v]) => (
        <T key={k} onPress={() => setWx(wx === k ? null : k)} style={[s.chip, { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11 }, wx === k && s.chipOn]}>
          <Ic n={v[0]} s={18} c={wx === k ? '#fff' : C.ink} />
          <Text style={[s.chipT, wx === k && { color: '#fff' }]}>{v[1]}</Text>
        </T>
      ))}
    </View>
    <TextInput style={[s.input, { height: 70 }]} multiline maxLength={500} value={comment} onChangeText={setComment} placeholder="Poznámka, tip na cestu… (nepovinné)" placeholderTextColor={C.mute} />
  </View>
);
/* zpětná úprava vlastního odkliku (hodnocení, doprava, počasí, poznámka); body se nemění */
function EditVisit({ v, onClose, onSaved }) {
  const [rating, setRating] = useState(v.rating || 0);
  const [tr, setTr] = useState(v.transport || null);
  const [wx, setWx] = useState(v.weather || null);
  const [comment, setComment] = useState(v.comment || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await api('/visit/' + v.id, { method: 'PUT', json: { rating, transport: tr, weather: wx, comment } });
      onSaved();
    } catch (e) { setErr(e.code ? e.message : 'Jsi offline – úpravu nelze uložit.'); }
    setBusy(false);
  };
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#1f3d2bcc', justifyContent: 'flex-end' }}>
        <ScrollView style={{ maxHeight: '92%', backgroundColor: C.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26 }} contentContainerStyle={{ padding: 20, paddingBottom: 36 }} keyboardShouldPersistTaps="handled">
          <Text style={s.h2}>Upravit odklik</Text>
          <Text style={s.sm}>{v.created ? fmtDay(dayKey(v.created)) + ' v ' + hmOf(v.created) : ''}</Text>
          <VisitFields rating={rating} setRating={setRating} tr={tr} setTr={setTr} wx={wx} setWx={setWx} comment={comment} setComment={setComment} />
          {!!err && <Text style={s.warn}>{err}</Text>}
          <Btn icon="content-save-outline" title={busy ? 'Ukládám…' : 'Uložit změny'} disabled={busy || !rating || !tr} onPress={save} />
          <Btn ghost title="Zrušit" onPress={onClose} style={{ borderWidth: 0 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ============================== detail stromu ============================== */
function TreeSheet({ kod, tree, pos, me, onClose, onAuth, onVisited, toast, onProfile, bottom, queued, onQueue, favorites, onFavorite, onSuggest }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [rating, setRating] = useState(0);
  const [tr, setTr] = useState(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [fid, setFid] = useState(null);
  const [wx, setWx] = useState(null);
  const [ev, setEv] = useState(null);
  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeProfile, setRouteProfile] = useState('pedestrian');
  const [routeShortest, setRouteShortest] = useState(false);
  const [bikeType, setBikeType] = useState('hybrid');
  const [bikePreference, setBikePreference] = useState('paths');
  const [preferHighways, setPreferHighways] = useState(false);
  const [wheelchair, setWheelchair] = useState(false);
  const shareCardRef = useRef(null);
  const load = useCallback(async () => {
    try { setD(await api('/tree/' + kod)); setErr(null); } catch (e) {
      if (e.code) return setErr(e.message);
      const qi = queued.find((x) => x.kod === kod);   // offline: základní info z uložených dat
      setD({ offline: true, name: tree.name, count: tree.count || 1, visits: 0, avg: 0, photos: [], reviews: [], url: null, my_visits: [], reward: null, mine: qi ? { rating: qi.rating, transport: qi.transport, comment: qi.comment, weather: qi.weather } : null });
      setErr(null);
    }
  }, [kod]);
  useEffect(() => { setD(null); setRating(0); setTr(null); setWx(null); setComment(''); setFid(null); setEv(null); setRoute(null); setRouteLoading(false); load(); }, [kod]);

  const dist = pos ? Math.min(...tree.pts.map((p) => hav(pos.lat, pos.lon, p[1], p[0]))) : null;
  const near = dist != null && dist <= RADIUS;
  const mine = d && d.mine;
  const rw = d && d.reward;
  const doneToday = !!d && (queued.some((x) => x.kod === kod) || !!(rw && rw.today));

  const submit = async () => {
    if (!me) return onAuth();
    setBusy(true);
    try {
      const r = await api(`/tree/${kod}/visit`, { json: { rating, transport: tr, weather: wx || undefined, comment, lat: pos.lat, lon: pos.lon } });
      const got = r.total != null ? r.total : (r.pts || 0) + (r.bonus || 0);
      onVisited(kod, got, r.challenges || []);
      toast(r.bonus ? `Prvonávštěvník! +${got} b` : got ? `Strom odklikán! +${got} b` : 'Odklik zapsán (bez bodů – stejné roční období)', r.bonus ? 'star' : 'tree');
      setRating(0); setTr(null); setWx(null); setComment(''); await load();
    } catch (e) {
      if (!e.code) {   // bez signálu → fronta, odešle se automaticky po připojení
        onQueue({ kod, rating, transport: tr, weather: wx || undefined, comment, lat: pos.lat, lon: pos.lon });
        onVisited(kod, null, []); setD((x) => ({ ...x, mine: { rating, transport: tr, comment, weather: wx } }));
        toast('Bez signálu – návštěva uložena a odešle se po připojení', 'cloud-off-outline');
      } else toast(e.message, 'alert-circle-outline');
    }
    setBusy(false);
  };
  const photo = (cam) => async () => {
    try {
      if (cam) { const perm = await ImagePicker.requestCameraPermissionsAsync(); if (!perm.granted) return toast('Chybí oprávnění k fotoaparátu', 'camera-off'); }
      else { try { await ImagePicker.requestMediaLibraryPermissionsAsync(); } catch (e) {} }   // systémový výběr fotek funguje i bez udělení
      const r = cam ? await ImagePicker.launchCameraAsync({ quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ['images'] });
      if (r.canceled) return;
      const a = r.assets[0];
      toast('Nahrávám fotku…', 'upload');
      const m = await Manip.manipulateAsync(a.uri, a.width > 1400 ? [{ resize: { width: 1400 } }] : [], { compress: 0.8, format: Manip.SaveFormat.JPEG });
      await upload(`/tree/${kod}/photo`, 'photo', m.uri, 'p.jpg');
      toast('Fotka přidána', 'camera'); load();
    } catch (e) { toast(e.message, 'alert-circle-outline'); }
  };
  const like = async (p) => {
    if (!me) return onAuth();
    try {
      const r = await api(`/photo/${p.id}/like`, { method: 'POST' });
      setD((x) => ({ ...x, photos: x.photos.map((q) => (q.id === p.id ? { ...q, likes: r.likes, liked: r.liked } : q)) }));
      Haptics.selectionAsync();
    } catch (e) { toast(e.message, 'alert-circle-outline'); }
  };
  const openNativeWalkingNavigation = async () => {
    const [lo, la] = tree.pts[0];
    const label = encodeURIComponent(d.name || 'Památný strom');
    const travelMode = routeProfile === 'bicycle' ? 'bicycling' : routeProfile === 'auto' ? 'driving' : 'walking';
    const web = `https://www.google.com/maps/dir/?api=1&destination=${la},${lo}&travelmode=${travelMode}`;
    const links = Platform.OS === 'ios'
      ? [routeProfile === 'bicycle' ? web : `http://maps.apple.com/?daddr=${la},${lo}&dirflg=${routeProfile === 'auto' ? 'd' : 'w'}`, web]
      : Platform.OS === 'android'
        ? [`google.navigation:q=${la},${lo}&mode=${routeProfile === 'auto' ? 'd' : routeProfile === 'bicycle' ? 'b' : 'w'}`, `geo:0,0?q=${la},${lo}(${label})`, web]
        : [web];
    for (const url of links) {
      try { await Linking.openURL(url); return; } catch (e) {}
    }
    toast('Nenašla se aplikace pro otevření trasy.', 'alert-circle-outline');
  };
  const goThere = async () => {
    if (!pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lon)) {
      Alert.alert('Poloha není dostupná', 'Valhalla potřebuje aktuální polohu. Můžeš otevřít cíl v mapové aplikaci.', [
        { text: 'Zrušit', style: 'cancel' }, { text: 'Otevřít v Mapách', onPress: openNativeWalkingNavigation },
      ]);
      return;
    }
    const [lon, lat] = tree.pts[0];
    setRouteLoading(true);
    try {
      const costingOptions = routeProfile === 'pedestrian'
        ? { pedestrian: { shortest: routeShortest && !wheelchair, ...(wheelchair ? { type: 'wheelchair' } : {}) } }
        : routeProfile === 'bicycle'
          ? { bicycle: { shortest: routeShortest, bicycle_type: bikeType, use_roads: bikePreference === 'roads' ? 0.75 : 0.1, use_hills: bikePreference === 'hills' ? 0.8 : 0.2 } }
          : { auto: { shortest: routeShortest, use_highways: preferHighways ? 0.75 : 0.2 } };
      const response = await fetch('https://valhalla1.openstreetmap.de/route', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations: [{ lat: pos.lat, lon: pos.lon }, { lat, lon }], costing: routeProfile, costing_options: costingOptions, units: 'kilometers', language: 'cs-CZ' }),
      });
      if (!response.ok) throw new Error('Valhalla trasu nespočítala.');
      const data = await response.json();
      if (!data.trip?.summary) throw new Error('Valhalla nevrátila trasu.');
      setRoute({ ...data, _profile: routeProfile });
    } catch (e) {
      Alert.alert('Trasu se nepodařilo spočítat', 'Zkusím otevřít strom v mapové aplikaci v telefonu.', [
        { text: 'Zrušit', style: 'cancel' }, { text: 'Otevřít v Mapách', onPress: openNativeWalkingNavigation },
      ]);
    } finally { setRouteLoading(false); }
  };
  const share = async () => {
    try {
      const uri = await captureRef(shareCardRef.current, { format: 'png', quality: 1 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Sdílet kartu stromu' });
    } catch (e) {
      Share.share({ message: `Objev strom „${d.name}“ ve Stromobraní 🌳 ${treeLink(kod)}` });
    }
  };
  const shareLink = async () => {
    try { await Share.share({ message: `Objev strom „${d.name}“ ve Stromobraní 🌳 ${treeLink(kod)}`, title: d.name }); }
    catch (e) { toast(e.message, 'alert-circle-outline'); }
  };
  const loadMore = async () => {
    try {
      const r = await api(`/tree/${kod}/visits?offset=${d.reviews.length}&limit=20`);
      setD((x) => ({ ...x, reviews: [...x.reviews, ...r.reviews] }));
    } catch (e) { toast(e.message, 'alert-circle-outline'); }
  };
  const report = (kind, ref) => {
    if (!me) return onAuth();
    Alert.alert('Nahlásit obsah', 'Nahlásit tento obsah jako nevhodný?', [{ text: 'Zrušit', style: 'cancel' },
      { text: 'Nahlásit', style: 'destructive', onPress: async () => { try { await api('/report', { json: { kind, ref } }); toast('Díky, nahlášeno. Obsah posoudíme.', 'flag'); } catch (e) { toast(e.message, 'alert-circle-outline'); } } }]);
  };
  const msg = !me ? 'Pro odklikávání se přihlas.' : dist == null ? 'Čekám na polohu…' : !near ? `Jsi ${fmtD(dist)} daleko. Přibliž se alespoň na ${RADIUS} m.` : null;

  return (
    <View style={[s.sheet, { bottom }]}>
      <Close onPress={onClose} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, paddingBottom: 30 }}>
        {err ? <Text style={s.warn}>{err}</Text> : !d ? <ActivityIndicator color={C.moss} style={{ margin: 30 }} /> : (<>
          <Text style={[s.h2, { paddingRight: 36 }]}>{d.name}</Text>
          <View style={s.meta}>
            <View style={[s.badgeV, mine && { backgroundColor: C.sun }]}>
              <Ic n={mine ? 'check' : 'circle-outline'} s={14} c={mine ? '#4a3200' : '#fff'} />
              <Text style={[s.badgeVt, mine && { color: '#4a3200' }]}>{mine ? 'Navštíveno' : 'Nenavštíveno'}</Text>
            </View>
            <View style={s.rowi}><Ic n="tree" s={15} c={C.mute} /><Text style={s.sm}>{d.count > 1 ? d.count + ' stromy' : '1 strom'}</Text></View>
            <View style={s.rowi}><Ic n="map-marker" s={15} c={C.mute} /><Text style={s.sm}>{dist == null ? '—' : fmtD(dist)}</Text></View>
            {d.visits ? <View style={s.rowi}><Rate v={d.avg} /><Text style={s.sm}>{d.avg.toFixed(1).replace('.', ',')} ({d.visits}×)</Text></View> : <Text style={s.sm}>zatím bez hodnocení</Text>}
          </View>
          <Facts t={{ druh: d.druh || tree.druh, obvod: d.obvod || tree.obvod, vyska: d.vyska || tree.vyska, stari: d.stari || tree.stari }} />
          <Btn ghost icon={favorites.includes(kod) ? 'heart' : 'heart-outline'} title={favorites.includes(kod) ? 'Odebrat z oblíbených' : 'Přidat mezi oblíbené'} onPress={() => onFavorite(kod)} />
          {d.offline && <View style={[s.warn, { flexDirection: 'row', gap: 8, alignItems: 'center' }]}><Ic n="cloud-off-outline" s={18} c="#8a3a22" /><Text style={{ color: '#8a3a22', fontSize: 13, flex: 1 }}>Offline – recenze a fotky se načtou po připojení.</Text></View>}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Btn ghost icon={routeProfile === 'bicycle' ? 'bike' : routeProfile === 'auto' ? 'car' : 'walk'} style={{ flex: 1, marginTop: 0 }} title={routeLoading ? 'Počítám trasu…' : 'Vypočítat trasu'} disabled={routeLoading} onPress={goThere} />
            <Btn ghost icon="link-variant" style={{ flex: 1, marginTop: 0 }} title="Sdílet odkaz" onPress={shareLink} />
          </View>
          <Text style={[s.sm, { marginTop: 10, fontWeight: '800' }]}>Profil trasy</Text>
          <Presets v={routeProfile} opts={[["pedestrian", "Pěšky"], ["bicycle", "Cyklo"], ["auto", "Auto"]]} onChange={setRouteProfile} />
          {routeProfile === 'pedestrian' && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            <T onPress={() => setRouteShortest((v) => !v)} style={[s.chip, routeShortest && s.chipOn]}><Text style={[s.chipT, routeShortest && { color: '#fff' }]}>Nejkratší vzdálenost</Text></T>
            <T onPress={() => setWheelchair((v) => { const next = !v; if (next) setRouteShortest(false); return next; })} style={[s.chip, wheelchair && s.chipOn]}><Text style={[s.chipT, wheelchair && { color: '#fff' }]}>Bezbariérová</Text></T>
          </View>}
          {routeProfile === 'bicycle' && <>
            <Text style={[s.sm, { marginTop: 8 }]}>Typ kola</Text>
            <Presets v={bikeType} opts={[["hybrid", "Trekové"], ["road", "Silniční"], ["mountain", "Horské"]]} onChange={setBikeType} />
            <Text style={[s.sm, { marginTop: 8 }]}>Profil jízdy</Text>
            <Presets v={bikePreference} opts={[["paths", "Cyklostezky a mírné kopce"], ["roads", "Silnice"], ["hills", "Kopce nevadí"]]} onChange={setBikePreference} />
            <T onPress={() => setRouteShortest((v) => !v)} style={[s.chip, routeShortest && s.chipOn, { alignSelf: 'flex-start', marginTop: 8 }]}><Text style={[s.chipT, routeShortest && { color: '#fff' }]}>Nejkratší vzdálenost</Text></T>
          </>}
          {routeProfile === 'auto' && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            <T onPress={() => setPreferHighways((v) => !v)} style={[s.chip, preferHighways && s.chipOn]}><Text style={[s.chipT, preferHighways && { color: '#fff' }]}>Upřednostnit dálnice</Text></T>
            <T onPress={() => setRouteShortest((v) => !v)} style={[s.chip, routeShortest && s.chipOn]}><Text style={[s.chipT, routeShortest && { color: '#fff' }]}>Nejkratší vzdálenost</Text></T>
          </View>}
          <Btn ghost icon="share-variant-outline" title="Sdílet kartu" onPress={share} />
          <Btn ghost icon="file-edit-outline" title="Navrhnout opravu údajů" onPress={() => onSuggest({ kind: 'fix', kod, name: d.name })} />

          {!!d.first_bonus && <View style={s.firstB}><Ic n="star-circle" s={20} c={C.bark} /><Text style={s.firstBt}>Prvonávštěvník: za první odklik tohoto stromu v letošním roce +50 b navíc!</Text></View>}
          {mine && (
            <View style={s.card}>
              <Text style={s.b}>Tvé návštěvy ({d.my_visits.length || 1}×)</Text>
              {(d.my_visits.length ? d.my_visits : [{ created: null, ...mine }]).map((v, i) => (
                <View key={i} style={{ marginTop: 8 }}>
                  <View style={s.rowi}>
                    <Ic n="calendar-check-outline" s={16} c={C.ink} />
                    <Text style={{ color: C.ink, fontWeight: '700' }}>{v.created ? fmtDay(dayKey(v.created)) + ' v ' + hmOf(v.created) : 'čeká na odeslání'}</Text>
                    <Rate v={v.rating} />
                    {!!v.id && <T onPress={() => setEv(v)} hitSlop={8} style={{ marginLeft: 'auto' }}><Ic n="pencil-outline" s={20} c={C.moss} /></T>}
                  </View>
                  <View style={[s.rowi, { marginTop: 2 }]}>
                    <Ic n={TR[v.transport][0]} s={15} c={C.mute} />
                    <Text style={s.sm}>{TR[v.transport][1]}</Text>
                    {!!WX[v.weather] && <><Ic n={WX[v.weather][0]} s={15} c={C.mute} /><Text style={s.sm}>{WX[v.weather][1]}</Text></>}
                    <Text style={s.sm}>{(v.pts || 0) + (v.bonus || 0) > 0 ? `·  +${(v.pts || 0) + (v.bonus || 0)} b` : ''}{queued.some((x) => x.kod === kod) && i === 0 ? '·  čeká na odeslání' : ''}</Text>
                  </View>
                  {!!v.comment && <Text style={{ color: C.ink }}>{v.comment}</Text>}
                </View>
              ))}
            </View>
          )}
          {doneToday ? (mine && <Text style={[s.sm, { marginVertical: 6 }]}>Dnes už jsi tento strom odklikl(a). Další odklik půjde zítra.</Text>) : (
            <View style={s.card}>
              <Text style={s.b}>{mine ? 'Odklikni strom znovu' : 'Odklikni strom a ohodnoť ho'}</Text>
              {!!rw && <Text style={s.sm}>{rw.base ? `+${rw.base} b${mine ? ' – jiné roční období než minule' : ' za první odklik'}` : 'Bez bodů – stejné roční období jako minule'}{rw.bonus ? '  ·  +50 b prvonávštěvník' : ''}</Text>}
              <VisitFields rating={rating} setRating={setRating} tr={tr} setTr={setTr} wx={wx} setWx={setWx} comment={comment} setComment={setComment} />
              {msg && <Text style={s.warn}>{msg}</Text>}
              <Btn icon={!me ? 'login' : 'check-circle-outline'} title={!me ? 'Přihlásit se' : busy ? 'Ukládám…' : 'Odkliknout strom'} disabled={me && (busy || !near || !rating || !tr)} onPress={submit} />
            </View>
          )}

          <TreeMap kod={kod} tree={tree} />

          <Text style={[s.h3, { marginTop: 16 }]}>Fotky</Text>
          {mine ? <Btn ghost icon="camera-plus-outline" title="Přidat fotku" onPress={() => Alert.alert('Přidat fotku', '', [{ text: 'Fotoaparát', onPress: photo(true) }, { text: 'Galerie', onPress: photo(false) }, { text: 'Zrušit', style: 'cancel' }])} />
            : <Text style={[s.sm, { marginVertical: 6 }]}>Fotky může přidat ten, kdo strom navštívil.</Text>}
          <View style={s.grid}>
            {d.photos.map((p) => (
              <T key={p.id} activeOpacity={0.9} onPress={() => setFid(p.id)} onLongPress={() => report('photo', p.id)} style={s.ph}>
                <Image source={{ uri: API + '/uploads/' + p.file }} resizeMethod="resize" style={{ width: '100%', height: '100%' }} />
                <T style={[s.lk, p.liked && { backgroundColor: C.red }]} onPress={() => like(p)}><Ic n="heart" s={12} c="#fff" /><Text style={s.lkT}>{p.likes}</Text></T>
              </T>
            ))}
            {!d.photos.length && <Text style={s.sm}>Zatím žádné fotky.</Text>}
          </View>

          <Text style={[s.h3, { marginTop: 16 }]}>Poslední návštěvy ({d.visits})</Text>
          <Text style={[s.sm, { fontSize: 11 }]}>Nevhodný obsah (fotku, recenzi) nahlásíš dlouhým stisknutím.</Text>
          {d.reviews.map((r, i) => (
            <T key={i} style={s.row} onPress={() => onProfile(r.uid)} onLongPress={() => r.uid !== (me && me.id) && report('review', r.vid)}>
              <Av a={r.avatar} photo={r.photo} />
              <View style={{ flex: 1 }}>
                <Text style={s.b}>{r.username}</Text>
                <View style={[s.rowi, { marginTop: 2 }]}><Rate v={r.rating} s={13} /><Ic n={TR[r.transport][0]} s={14} c={C.mute} />{!!WX[r.weather] && <Ic n={WX[r.weather][0]} s={14} c={C.mute} />}<Text style={s.sm}>{TR[r.transport][1]}  ·  {ago(r.created)}</Text></View>
                {!!r.comment && <Text style={{ color: C.ink, marginTop: 2 }}>{r.comment}</Text>}
              </View>
            </T>
          ))}
          {!d.reviews.length && <Text style={s.sm}>Zatím tu nikdo nebyl. Buď první!</Text>}
          {d.reviews.length < d.visits && !d.offline && <Btn ghost title={`Zobrazit další (${d.visits - d.reviews.length})`} onPress={loadMore} />}
          {!!d.url && <Text style={[s.sm, { marginTop: 12, color: C.moss }]} onPress={() => Linking.openURL(d.url)}>Více v databázi AOPK ČR ↗</Text>}
        </>)}
      </ScrollView>
      {!!d && <ViewShot ref={shareCardRef} options={{ format: 'png', quality: 1 }} style={{ position: 'absolute', left: -1000, top: 0, width: 360 }}><View style={{ backgroundColor: C.forest, padding: 22, width: 360 }}><Text style={{ color: C.sun, fontWeight: '900', letterSpacing: 2 }}>STROMOBRANÍ · PAMÁTNÉ STROMY</Text>{d.photos && d.photos[0] && <Image source={{ uri: API + '/uploads/' + d.photos[0].file }} style={{ width: 316, height: 190, borderRadius: 16, marginTop: 16 }} />}<Text style={{ color: '#fff', fontFamily: SERIF, fontWeight: '800', fontSize: 28, marginTop: 14 }}>{d.name}</Text><Text style={{ color: '#dbe7d4', marginTop: 8 }}>{d.druh || tree.druh || 'Památný strom'} · {fmtD(dist || 0)}</Text><Text style={{ color: C.sun, fontWeight: '800', marginTop: 12 }}>{mine ? 'Navštíveno ve Stromobraní 🌳' : 'Pojď ho objevit 🌳'}</Text><Text style={{ color: '#dbe7d4', marginTop: 12 }}>{treeLink(kod)}</Text></View></ViewShot>}
      <Full photos={d?.photos || []} photoId={fid} onPhotoChange={setFid} onClose={() => setFid(null)} onLike={like} onProfile={onProfile} />
      <WalkingRouteModal route={route} routeProfile={route?._profile} treeName={d?.name || tree.name} onClose={() => setRoute(null)} onOpenMaps={openNativeWalkingNavigation} />
      {!!ev && <EditVisit v={ev} onClose={() => setEv(null)} onSaved={() => { setEv(null); toast('Odklik upraven', 'check-circle-outline'); load(); }} />}
    </View>
  );
}

/* ============================== žebříček + hledání uživatelů ============================== */
const MEDAL = ['#d9a520', '#9aa3ab', '#b0713a'];
const UserRow = React.memo(({ r, mine, onPress }) => (
  <T style={[s.row, mine && { borderColor: C.moss, backgroundColor: '#eef6e4' }]} onPress={() => onPress(r.id)}>
    <View style={{ width: 30, alignItems: 'center' }}>
      {r.rank && r.rank <= 3 ? <Ic n="medal" s={26} c={MEDAL[r.rank - 1]} /> : <Text style={s.rk}>{r.rank || '·'}</Text>}
    </View>
    <Av a={r.avatar} photo={r.photo} />
    <View style={{ flex: 1 }}>
      <Text style={s.b} numberOfLines={1}>{r.username}</Text>
      <View style={s.rowi}>
        <Ic n="tree" s={13} c={C.mute} /><Text style={s.sm}>{r.visits}</Text>
        <Ic n="camera" s={13} c={C.mute} /><Text style={s.sm}>{r.photos}</Text>
        <Ic n="heart" s={13} c={C.mute} /><Text style={s.sm}>{r.likes}</Text>
      </View>
    </View>
    <Text style={{ fontFamily: SERIF, fontWeight: '800', fontSize: 18, color: C.forest }}>{r.score}</Text>
  </T>
));
function Board({ me, onProfile, top, bottom }) {
  const [rows, setRows] = useState(null);
  const [ref, setRef] = useState(false);
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [sb, setSb] = useState(false);
  const [friendsOnly, setFriendsOnly] = useState(false);
  const load = async () => {
    setRef(true);
    try { const r = await api('/leaderboard' + (friendsOnly ? '?friends=1' : '')); setRows(r.map((x, i) => ({ ...x, rank: x.rank || i + 1 }))); } catch (e) {}
    setRef(false);
  };
  useEffect(() => { load(); }, [friendsOnly, me && me.id]);
  useEffect(() => {
    const k = q.trim();
    if (k.length < 2) { setRes(null); setSb(false); return; }
    let dead = false; setSb(true);
    const id = setTimeout(async () => {
      try { const r = await api('/users?q=' + encodeURIComponent(k)); if (!dead) setRes(r); } catch (e) { if (!dead) setRes([]); }
      if (!dead) setSb(false);
    }, 300);
    return () => { dead = true; clearTimeout(id); };
  }, [q]);
  const data = res || rows || [];
  const renderItem = useCallback(({ item }) => <UserRow r={item} mine={!!me && me.id === item.id} onPress={onProfile} />, [me && me.id, onProfile]);
  const header = (
    <View>
      <Text style={[s.h2, { fontSize: 28 }]}>Žebříček</Text>
      <Text style={[s.sm, { marginBottom: 10 }]}>První odklik stromu 10 b., další roční období 5 b., prvonávštěvník +50 b., fotka 3 b., lajk 1 b. a body za splněné výzvy.</Text>
      {!!me && <View style={{ marginBottom: 8 }}><Seg v={friendsOnly ? 'friends' : 'all'} onChange={(v) => setFriendsOnly(v === 'friends')} opts={[["all", "Všichni"], ["friends", "Přátelé"]]} /></View>}
      {!!me && !!me.priv && me.priv.board === false && <Hidden t="V žebříčku se nezobrazuješ (změníš v Profil → Nastavení → Soukromí)." />}
      <View style={[s.search, { elevation: 0, borderWidth: 2, borderColor: C.line, marginTop: 8 }]}>
        <Ic n="magnify" s={20} c={C.mute} />
        <TextInput style={{ flex: 1, paddingVertical: 10, color: C.ink, fontWeight: '600' }} placeholder="Najít uživatele…" placeholderTextColor={C.mute}
          value={q} onChangeText={setQ} autoCapitalize="none" autoCorrect={false} maxLength={30} />
        {sb ? <ActivityIndicator size="small" color={C.moss} /> : !!q && <T onPress={() => setQ('')}><Ic n="close" s={18} c={C.mute} /></T>}
      </View>
      {res && <Text style={[s.sm, { marginTop: 8 }]}>{res.length ? `Nalezeno: ${res.length}` : ''}</Text>}
    </View>
  );
  return (
    <FlatList style={s.panel} data={data} keyExtractor={(r) => String(r.id)} renderItem={renderItem}
      contentContainerStyle={{ paddingTop: top + 14, paddingBottom: bottom + 20, paddingHorizontal: 16 }}
      ListHeaderComponent={header} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      initialNumToRender={12} maxToRenderPerBatch={10} windowSize={7} removeClippedSubviews
      ListEmptyComponent={res ? (sb ? null : <Text style={s.sm}>Nikdo takový nenalezen.</Text>) : !rows ? <ActivityIndicator color={C.moss} style={{ marginTop: 20 }} /> : <Text style={s.sm}>Zatím tu nikdo není. Buď první!</Text>}
      refreshControl={<RefreshControl refreshing={ref} onRefresh={load} tintColor={C.moss} />} />
  );
}

/* ============================== profil ============================== */
const Badge = React.memo(({ i, n, ok }) => (
  <View style={[s.bdg, !ok && { opacity: 0.3 }]}><Ic n={i} s={26} c={ok ? C.moss : C.mute} /><Text style={[s.sm, { textAlign: 'center', fontSize: 10 }]}>{n}</Text></View>
));
const Challenge = React.memo(({ c }) => (
  <View style={[s.row, { marginTop: 8 }, c.done && { backgroundColor: '#eef6e4', borderColor: C.leaf }]}>
    <View style={[s.chI, c.done && { backgroundColor: C.moss }]}><Ic n={c.icon} s={22} c={c.done ? '#fff' : C.mute} /></View>
    <View style={{ flex: 1 }}>
      <Text style={s.b}>{c.name}</Text>
      <Text style={s.sm}>{c.desc}</Text>
      <View style={s.bar}><View style={{ width: (c.cur / c.goal) * 100 + '%', height: '100%', backgroundColor: c.done ? C.moss : C.leaf }} /></View>
    </View>
    <View style={{ alignItems: 'flex-end', gap: 2 }}>
      {c.done ? <Ic n="check-circle" s={22} c={C.moss} /> : <Text style={s.sm}>{c.cur}/{c.goal}</Text>}
      <Text style={[s.chP, c.done && { color: C.moss }]}>+{c.pts} b</Text>
    </View>
  </View>
));
function PhotoContest({ me, onAuth, toast, onProfile }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [photoId, setPhotoId] = useState(null);
  const [authorProfiles, setAuthorProfiles] = useState({});
  const load = () => api('/photo-contest').then(setData).catch(() => setData({ photos: [] }));
  useEffect(() => { load(); }, []);
  const activeAuthorId = data?.photos?.find((p) => p.id === photoId)?.uid;
  useEffect(() => {
    if (!activeAuthorId || authorProfiles[activeAuthorId]) return;
    let current = true;
    api('/user/' + activeAuthorId).then((profile) => {
      if (current) setAuthorProfiles((items) => ({ ...items, [activeAuthorId]: { avatar: profile.avatar, photo: profile.photo } }));
    }).catch(() => {});
    return () => { current = false; };
  }, [activeAuthorId, authorProfiles]);
  const vote = async (id) => {
    if (!me) return onAuth();
    setBusy(id);
    try { await api(`/photo-contest/${id}/vote`, { method: 'POST' }); await load(); toast('Hlas započítán', 'trophy-outline'); }
    catch (e) { toast(e.message, 'alert-circle-outline'); }
    setBusy(null);
  };
  const viewerPhotos = (data?.photos || []).map((p) => ({ ...p, ...authorProfiles[p.uid], likes: p.votes, liked: p.my_vote === p.id }));
  return <>
    <Text style={[s.h3, { marginTop: 18 }]}>Fotosoutěž {data && data.month}</Text>
    {!!data?.photos?.length && <Text style={[s.sm, { marginTop: 4 }]}>Klepnutím otevřeš fotku; v náhledu můžeš přejíždět mezi soutěžními snímky.</Text>}
    {!data ? <ActivityIndicator color={C.moss} /> : !data.photos.length ? <Text style={s.sm}>Tento měsíc zatím nikdo nepřidal fotku.</Text> : data.photos.map((p, i) => (
      <View key={p.id} style={[s.row, s.card, { alignItems: 'center', padding: 10, marginTop: 8 }]}>
        <Text style={s.rk}>#{i + 1}</Text>
        <T onPress={() => setPhotoId(p.id)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`Otevřít fotku: ${p.name}`} style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden' }}>
          <Image source={{ uri: API + '/uploads/' + p.file }} resizeMethod="resize" style={{ width: '100%', height: '100%' }} />
        </T>
        <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 8 }}><Text style={s.b} numberOfLines={2}>{p.name}</Text><Text style={s.sm} numberOfLines={1}>{p.username} · {p.votes} hlasů</Text></View>
        {p.uid !== (me && me.id) && <T onPress={() => vote(p.id)} disabled={busy === p.id} hitSlop={8}><Ic n={p.my_vote === p.id ? 'heart' : 'heart-outline'} s={23} c={p.my_vote === p.id ? C.red : C.moss} /></T>}
      </View>
    ))}
    <Full photos={viewerPhotos} photoId={photoId} onPhotoChange={setPhotoId} onClose={() => setPhotoId(null)} onLike={(p) => vote(p.id)} canLike={(p) => p.uid !== (me && me.id)} onProfile={onProfile} />
  </>;
}
function SuggestModal({ draft, pos, onClose, toast }) {
  const [name, setName] = useState(draft && draft.name || '');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  if (!draft) return null;
  const submit = async () => {
    if (!details.trim() && draft.kind === 'fix') return toast('Popiš, co je potřeba opravit.', 'alert-circle-outline');
    if (draft.kind === 'new' && (!pos || name.trim().length < 3)) return toast('Doplň název a povol polohu.', 'alert-circle-outline');
    setBusy(true);
    try {
      await api('/tree-suggestions', { json: { kind: draft.kind, tree_kod: draft.kod, name, lat: draft.kind === 'new' ? pos.lat : undefined, lon: draft.kind === 'new' ? pos.lon : undefined, details } });
      toast('Návrh byl odeslán ke kontrole.', 'check-circle-outline'); onClose();
    } catch (e) { toast(e.message, 'alert-circle-outline'); }
    setBusy(false);
  };
  return <Modal transparent animationType="slide" onRequestClose={onClose}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#1f3d2bcc', justifyContent: 'flex-end' }}><View style={{ backgroundColor: C.paper, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
    <Text style={s.h2}>{draft.kind === 'new' ? 'Navrhnout strom' : 'Navrhnout opravu'}</Text>
    {draft.kind === 'new' && <TextInput style={s.input} placeholder="Název stromu" value={name} onChangeText={setName} />}
    <TextInput style={[s.input, { height: 110, marginTop: 8 }]} multiline maxLength={2000} placeholder={draft.kind === 'new' ? 'Popiš strom, zdroj údajů nebo další podrobnosti' : 'Co je chybně a jakou hodnotu navrhuješ?'} value={details} onChangeText={setDetails} />
    {draft.kind === 'new' && <Text style={[s.sm, { marginTop: 6 }]}>{pos ? `Poloha: ${pos.lat.toFixed(5)}, ${pos.lon.toFixed(5)}` : 'Poloha není dostupná.'}</Text>}
    <Btn title={busy ? 'Odesílám…' : 'Odeslat ke kontrole'} disabled={busy} onPress={submit} /><Btn ghost title="Zrušit" onPress={onClose} />
  </View></KeyboardAvoidingView></Modal>;
}
const CC_LABEL = { fontWeight: '800', color: C.forest, fontSize: 13, marginBottom: 5 };
function CommunityChallenges({ me, onAuth, toast }) {
  const [items, setItems] = useState(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState(''); const [district, setDistrict] = useState(''); const [goal, setGoal] = useState('10');
  const [districts, setDistricts] = useState([]); const [distFocus, setDistFocus] = useState(false);
  useEffect(() => { if (creating && !districts.length) api('/districts').then((d) => Array.isArray(d) && setDistricts(d)).catch(() => {}); }, [creating]);
  const dq = norm(district.trim());
  const exactDistrict = districts.find((d) => norm(d) === dq);   // shoda bez ohledu na diakritiku a velikost písmen
  const suggestions = !distFocus || exactDistrict && exactDistrict === district.trim() ? [] : [...districts.filter((d) => norm(d).startsWith(dq)), ...districts.filter((d) => dq && !norm(d).startsWith(dq) && norm(d).includes(dq))].slice(0, 6);
  const load = () => api('/community-challenges').then(setItems).catch(() => setItems([]));
  useEffect(() => { if (me) load(); else setItems([]); }, [me && me.id]);
  const create = async () => {
    if (!me) return onAuth();
    if (districts.length && !exactDistrict) return toast('Vyber okres z nabídky.', 'alert-circle-outline');
    try { await api('/community-challenges', { json: { name, district: exactDistrict || district, goal: Number(goal), days: 30 } }); setCreating(false); setName(''); setDistrict(''); await load(); toast('Okresní výzva vytvořena.', 'flag-checkered'); }
    catch (e) { toast(e.message, 'alert-circle-outline'); }
  };
  const join = async (id) => { try { await api(`/community-challenges/${id}/join`, { method: 'POST' }); await load(); } catch (e) { toast(e.message, 'alert-circle-outline'); } };
  return <View style={{ marginTop: 20 }}>
    <View style={[s.rowi, { justifyContent: 'space-between' }]}><Text style={s.h3}>Okresní a týmové výzvy</Text><T onPress={() => setCreating(!creating)}><Ic n="plus-circle-outline" s={23} c={C.moss} /></T></View>
    {creating && <View style={s.card}>
      <Text style={CC_LABEL}>Název výzvy</Text>
      <TextInput style={s.input} placeholder="Např. Jarní stromobraní" value={name} onChangeText={setName} />
      <Text style={[CC_LABEL, { marginTop: 10 }]}>Okres</Text>
      <TextInput style={s.input} placeholder="Začni psát, např. Kolín" value={district} onChangeText={setDistrict} autoCorrect={false} autoCapitalize="words" onFocus={() => setDistFocus(true)} onBlur={() => setTimeout(() => setDistFocus(false), 200)} />
      {suggestions.length > 0 && <View style={{ borderWidth: 1, borderColor: C.line || '#e3dcc3', borderRadius: 10, backgroundColor: '#fffdf6', marginTop: 4, overflow: 'hidden' }}>
        {suggestions.map((d) => <T key={d} onPress={() => { setDistrict(d); setDistFocus(false); }} style={{ paddingVertical: 11, paddingHorizontal: 12 }}><Text style={s.b}>{d}</Text></T>)}
      </View>}
      {!!district.trim() && !!districts.length && !exactDistrict && !suggestions.length && <Text style={[s.sm, { marginTop: 4 }]}>Takový okres tu není. Vyber jeden z nabídky.</Text>}
      <Text style={[CC_LABEL, { marginTop: 10 }]}>Cíl (počet stromů)</Text>
      <TextInput style={s.input} placeholder="Např. 10" keyboardType="number-pad" value={goal} onChangeText={setGoal} />
      <Text style={[s.sm, { marginTop: 6 }]}>Výzva trvá 30 dní. Splníš ji, když společně odkliknete zadaný počet stromů.</Text>
      <Btn title="Vytvořit na 30 dní" onPress={create} />
    </View>}
    {!items ? <ActivityIndicator color={C.moss} /> : !items.length ? <Text style={s.sm}>Zatím žádná aktivní výzva. Vytvoř první pro svůj okres.</Text> : items.map((c) => <View key={c.id} style={s.card}><View style={s.rowi}><Ic n="map-marker-radius" s={20} c={C.moss} /><Text style={[s.b, { flex: 1 }]}>{c.name} · {c.district}</Text><Text style={s.sm}>{c.progress}/{c.goal}</Text></View><View style={s.bar}><View style={{ width: Math.min(100, c.progress / c.goal * 100) + '%', height: '100%', backgroundColor: C.leaf }} /></View><Text style={s.sm}>{c.members} účastníků · ty: {c.my_progress} stromů</Text>{!c.joined && <Btn ghost title="Přidat se" onPress={() => join(c.id)} />}</View>)}
  </View>;
}
function Profile({ id, me, top, bottom, onAuth, onTree, onProfile, onLogout, onEdit, onDelete, onSettings, toast, allSpecies = [], points = [] }) {
  const [u, setU] = useState(null);
  const [err, setErr] = useState(null);
  const [nt, setNt] = useState(15);
  const [np, setNp] = useState(18);
  const [fp, setFp] = useState(null);
  const [sp, setSp] = useState(null);          // právě otevřený druh ve sbírce
  const [selfPh, setSelfPh] = useState(false);  // vlastní profilovka na celou obrazovku
  const [friendState, setFriendState] = useState(null);
  const pk = me && me.priv ? PRIV.map((x) => (me.priv[x[0]] === false ? 0 : 1)).join('') : '';
  useEffect(() => {
    if (!id) return;
    setU(null); setErr(null); setNt(15); setNp(18);
    api('/user/' + id).then(setU).catch((e) => setErr(e.message));
  }, [id, me && me.avatar, me && me.bio, me && me.photo, pk]);
  useEffect(() => {
    setFriendState(null);
    if (!me || !id || me.id === id) return;
    api('/friends').then((r) => {
      const out = (r.outgoing || []).find((x) => x.id === id);
      const inc = (r.incoming || []).some((x) => x.id === id);
      setFriendState(out ? out.status : inc ? 'incoming' : 'none');
    }).catch(() => setFriendState('none'));
  }, [id, me && me.id]);
  const friendAction = async () => {
    if (!me) return onAuth();
    try {
      if (friendState === 'accepted') { await api('/friend/' + id, { method: 'DELETE' }); setFriendState('none'); }
      else { const r = await api('/friend/' + id, { method: 'POST' }); setFriendState(r.status); }
    } catch (e) { toast(e.message, 'alert-circle-outline'); }
  };
  const pad = { paddingTop: top + 14, paddingBottom: bottom + 20, paddingHorizontal: 16 };
  if (!id) return (
    <ScrollView style={s.panel} contentContainerStyle={pad}>
      <Text style={s.h2}>Profil</Text>
      <View style={[s.card, { alignItems: 'center' }]}>
        <Ic n="sprout" s={54} c={C.moss} />
        <Text style={{ textAlign: 'center', color: C.ink, marginVertical: 8 }}>Přihlas se, odklikávej stromy, nahrávej fotky a vyšplhej na vrchol žebříčku.</Text>
        <Btn title="Přihlásit / Registrovat" onPress={onAuth} style={{ alignSelf: 'stretch' }} />
      </View>
      <Btn ghost icon="cog-outline" title="Nastavení aplikace" onPress={onSettings} />
      <Credits />
    </ScrollView>
  );
  if (err) return <View style={s.panel}><Text style={[s.warn, { margin: 20, marginTop: top + 20 }]}>{err}</Text></View>;
  if (!u) return <View style={s.panel}><ActivityIndicator color={C.moss} style={{ marginTop: top + 80 }} /></View>;
  const isMe = me && me.id === u.id, hide = u.hide || {};
  const off = (k) => isMe && u.priv && u.priv[k] === false;   // u vlastního profilu značí, co je skryté ostatním
  const lv = u.visits != null ? level(u.visits) : null, next = lv ? LEVELS.find((l) => l[0] > u.visits) : null;
  const pct = lv && next ? ((u.visits - lv[0]) / (next[0] - lv[0])) * 100 : 100;
  const reportUser = () => {
    if (!me) return onAuth();
    Alert.alert('Nahlásit profil', 'Nahlásit tento profil (jméno, fotku nebo popis) jako nevhodný?', [{ text: 'Zrušit', style: 'cancel' },
      { text: 'Nahlásit', style: 'destructive', onPress: async () => { try { await api('/report', { json: { kind: 'user', ref: u.id } }); toast('Díky, nahlášeno. Obsah posoudíme.', 'flag'); } catch (e) { toast(e.message, 'alert-circle-outline'); } } }]);
  };
  const chDone = (u.challenges || []).filter((c) => c.done).length;
  const collected = new Set((u.trees || []).map((t) => t.druh).filter((x) => x && x !== 'Jiný'));
  const bySp = {};
  const seenBySp = {};
  (u.trees || []).forEach((t) => {
    if (!t.druh) return;
    const seen = (seenBySp[t.druh] ||= new Set());
    if (seen.has(t.kod)) return;
    seen.add(t.kod);
    (bySp[t.druh] = bySp[t.druh] || []).push(t);
  });
  const totalBySp = {};
  const seenSpeciesTrees = new Set();
  points.forEach((p) => {
    const name = p[4];
    if (!name || name === 'Jiný') return;
    const key = name + '\u0000' + p[0];
    if (seenSpeciesTrees.has(key)) return;
    seenSpeciesTrees.add(key);
    totalBySp[name] = (totalBySp[name] || 0) + 1;
  });
  const exportCsv = async () => {
    const cell = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const lines = [['Datum', 'Strom', 'Druh', 'Okres', 'Hodnocení', 'Doprava', 'Počasí', 'Body'], ...(u.trees || []).map((t) => [t.created, t.name, t.druh, t.okres, t.rating, t.transport, t.weather, t.pts])];
    try {
      const uri = FileSystem.cacheDirectory + 'stromobrani-historie.csv';
      await FileSystem.writeAsStringAsync(uri, '\uFEFFsep=;\n' + lines.map((r) => r.map(cell).join(';')).join('\n'), { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Export historie Stromobraní' });
    } catch (e) { toast('CSV se nepodařilo připravit.', 'alert-circle-outline'); }
  };
  return (
    <ScrollView style={s.panel} contentContainerStyle={pad}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        {isMe && u.photo
          ? <T activeOpacity={0.85} onPress={() => setSelfPh(true)} accessibilityRole="button" accessibilityLabel="Zobrazit profilovou fotku na celou obrazovku"><Av a={u.avatar} photo={u.photo} size={72} /></T>
          : <Av a={u.avatar} photo={u.photo} size={72} />}
        <View style={{ flex: 1 }}>
          <Text style={[s.h2, { fontSize: 26 }]} numberOfLines={1}>{u.username}</Text>
          {lv ? <Text style={s.sm}><Text style={s.badge}> {lv[1]} </Text>{u.rank ? `  #${u.rank} v žebříčku` : ''}</Text> : null}
        </View>
      </View>
      {!!u.bio && <View style={[s.rowi, { alignItems: 'flex-start', marginTop: 10 }]}><Text style={{ color: C.ink, flex: 1 }}>{u.bio}</Text>{off('bio') && <Ic n="eye-off-outline" s={16} c={C.mute} />}</View>}
      {hide.stats ? <Hidden t="Uživatel skryl své počty a body." /> : (<>
        <View style={s.bar}><View style={{ width: pct + '%', height: '100%', backgroundColor: C.leaf }} /></View>
        <Text style={s.sm}>{next ? `Do titulu „${next[1]}“ zbývá ${next[0] - u.visits} stromů` : 'Nejvyšší titul dosažen'}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: off('stats') ? 4 : 14 }}>
          {[[u.visits, 'stromů'], [u.photos, 'fotek'], [u.likes, 'lajků'], [u.score, 'bodů']].map(([n, l]) => (
            <View key={l} style={s.stat}><Text style={s.statN}>{n}</Text><Text style={s.sm}>{l}</Text></View>
          ))}
        </View>
        {off('stats') && <Text style={[s.sm, { marginBottom: 10 }]}>Skryto před ostatními.</Text>}
      </>)}
      {isMe ? (<>
        <Btn ghost icon="file-download-outline" title="Exportovat historii do CSV" onPress={exportCsv} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn ghost icon="pencil-outline" style={{ flex: 1, marginTop: 0, paddingHorizontal: 6 }} title="Upravit" onPress={onEdit} />
          <Btn ghost icon="cog-outline" style={{ flex: 1, marginTop: 0, paddingHorizontal: 6 }} title="Nastavení" onPress={onSettings} />
          <Btn ghost icon="share-variant-outline" style={{ flex: 1, marginTop: 0, paddingHorizontal: 6 }} title="Sdílet" onPress={() => Share.share({
            message: `Mám ${u.visits} stromů a titul „${lv ? lv[1] : ''}“ ve Stromobraní 🌳${u.rank ? ` (#${u.rank} v žebříčku)` : ''} ${profLink(u.id)}` })} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn ghost icon="logout" style={{ flex: 1 }} title="Odhlásit" onPress={onLogout} />
          <Btn ghost icon="trash-can-outline" style={{ flex: 1, borderColor: '#e8b9ad' }} title="Smazat účet" onPress={onDelete} />
        </View>
      </>) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {!!me && <Btn ghost icon={friendState === 'accepted' ? 'account-check' : 'account-plus-outline'} style={{ flex: 1, marginTop: 0 }} title={friendState === 'accepted' ? 'Odebrat přítele' : friendState === 'incoming' ? 'Přijmout žádost' : friendState === 'pending' ? 'Žádost odeslána' : 'Přidat přítele'} disabled={friendState === 'pending'} onPress={friendAction} />}
          <Btn ghost icon="share-variant-outline" style={{ flex: 1, marginTop: 0 }} title="Sdílet" onPress={() => Share.share({ message: `Podívej se na profil ${u.username} ve Stromobraní 🌳 ${profLink(u.id)}` })} />
        </View>
      )}
      {!isMe && <T onPress={reportUser} style={[s.rowi, { marginTop: 12 }]}><Ic n="flag-outline" s={16} c={C.red} /><Text style={[s.sm, { color: C.red }]}>Nahlásit profil</Text></T>}
      <Text style={[s.sm, { marginTop: 10, color: C.moss }]} onPress={() => Linking.openURL(API + '/privacy')}>Zásady ochrany soukromí ↗</Text>

      <H3 style={{ marginTop: 18 }} t="Odznaky" off={off('badges')} />
      {hide.badges || !u.badges ? <Hidden /> : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {u.badges.map(([i, n, ok]) => <Badge key={n} i={i} n={n} ok={ok} />)}
        </View>
      )}

      <H3 style={{ marginTop: 18 }} t={`Výzvy${u.challenges ? ` (${chDone}/${u.challenges.length})` : ''}`} off={off('challenges')} />
      {hide.challenges || !u.challenges ? <Hidden /> : u.challenges.map((c) => <Challenge key={c.id} c={c} />)}
      {isMe && <CommunityChallenges me={me} onAuth={onAuth} toast={toast} />}

      <H3 style={{ marginTop: 18 }} t={`Sbírka druhů (${collected.size}/${allSpecies.length})`} />
      {hide.history ? <Hidden /> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 }}>
        {allSpecies.map((name) => {
          const has = collected.has(name);
          const mine = (bySp[name] || []).length;
          const total = totalBySp[name] || 0;
          const percent = total ? Math.min(100, Math.round((mine / total) * 100)) : 0;
          if (!has) return <View key={name} style={[s.chip, { flexDirection: 'row', gap: 5 }]}><Ic n="lock-outline" s={15} c={C.mute} /><Text style={s.chipT}>{name}</Text><Text style={[s.chipT, { opacity: 0.7 }]}>{percent} %</Text></View>;
          return (
            <T key={name} activeOpacity={0.8} onPress={() => setSp(name)} accessibilityRole="button" accessibilityLabel={`Zobrazit odklikané stromy druhu ${name}`} style={[s.chip, s.chipOn, { flexDirection: 'row', alignItems: 'center', gap: 5 }]}>
              <Ic n="check-circle" s={15} c="#fff" /><Text style={[s.chipT, { color: '#fff' }]}>{name}</Text>
              <Text style={{ color: '#ffffffcc', fontWeight: '800', fontSize: 12 }}>{mine} · {percent} %</Text>
            </T>
          );
        })}
        {!allSpecies.length && <Text style={s.sm}>Načti seznam stromů, aby se zobrazila sbírka.</Text>}
      </View>}
      {!hide.history && collected.size > 0 && <Text style={[s.sm, { marginTop: 6 }]}>Klepnutím na odemčený druh zobrazíš odklikané stromy.</Text>}

      <H3 style={{ marginTop: 18 }} t="Kalendář návštěv" off={off('history')} />
      {hide.history ? <Hidden /> : (<>
        <Cal trees={u.trees} onTree={onTree} />
        <Text style={[s.h3, { marginTop: 8 }]}>Statistiky</Text>
        <DistrictCoverage trees={u.trees} points={points} />
        <Stats trees={u.trees} />
      </>)}

      <H3 style={{ marginTop: 8 }} t="Fotky" off={off('photos')} />
      {hide.photos ? <Hidden /> : (<>
        <View style={s.grid}>
          {u.photo_list.slice(0, np).map((p) => (
            <T key={p.id} activeOpacity={0.9} onPress={() => setFp({ ...p, avatar: u.avatar, username: u.username })} style={s.ph}><Image source={{ uri: API + '/uploads/' + p.file }} resizeMethod="resize" style={{ width: '100%', height: '100%' }} />
              <View style={s.lk}><Ic n="heart" s={12} c="#fff" /><Text style={s.lkT}>{p.likes}</Text></View></T>
          ))}
          {!u.photo_list.length && <Text style={s.sm}>Žádné fotky.</Text>}
        </View>
        {u.photo_list.length > np && <Btn ghost title={`Zobrazit další fotky (${u.photo_list.length - np})`} onPress={() => setNp((n) => n + 18)} />}
      </>)}

      <PhotoContest me={me} onAuth={onAuth} toast={toast} onProfile={onProfile} />

      <H3 style={{ marginTop: 18 }} t="Historie odkliků" off={off('history')} />
      {hide.history ? <Hidden /> : (<>
        {u.trees.slice(0, nt).map((t) => (
          <T key={t.vid} style={s.row} onPress={() => onTree(t.kod)}>
            <Av a={TR[t.transport][0]} />
            <View style={{ flex: 1 }}><Text style={s.b} numberOfLines={1}>{t.name}</Text><Text style={s.sm}>{fmtDay(dayKey(t.created))}{t.pts ? `  ·  +${t.pts} b` : ''}</Text></View>
            <Rate v={t.rating} />
          </T>
        ))}
        {!u.trees.length && <Text style={s.sm}>Zatím žádné.</Text>}
        {u.trees.length > nt && <Btn ghost title={`Zobrazit další (${u.trees.length - nt})`} onPress={() => setNt((n) => n + 20)} />}
      </>)}
      <Credits />
      <Full
        photos={u.photo_list.map((p) => ({ ...p, uid: u.id, avatar: u.avatar, photo: u.photo, username: u.username }))}
        photoId={fp?.id}
        onPhotoChange={(photoId) => { const p = u.photo_list.find((x) => x.id === photoId); if (p) setFp({ ...p, uid: u.id, avatar: u.avatar, photo: u.photo, username: u.username }); }}
        onClose={() => setFp(null)}
        onProfile={onProfile}
      />
      <Full
        photos={isMe && selfPh && u.photo ? [{ id: 'avatar', file: u.photo, uri: avCache.name === u.photo && avCache.uri ? avCache.uri : null }] : []}
        photoId={isMe && selfPh && u.photo ? 'avatar' : null}
        onClose={() => setSelfPh(false)}
      />
      <SpeciesSheet name={sp} trees={sp ? bySp[sp] || [] : []} onClose={() => setSp(null)} onTree={onTree} />
    </ScrollView>
  );
}

/* ============================== radar (kompas ke stromu) ============================== */
function Radar({ near, heading, points, top, bottom, onOpen, onShow, visited, onRoute }) {
  const { width } = useWindowDimensions();
  const dial = Math.min(190, Math.round(width * 0.52));
  const t = near[0];
  const day = dayTree(points);
  const ang = t && heading != null ? (bearing(...[t.pos.lat, t.pos.lon, t.p[3], t.p[2]]) - heading + 360) % 360 : null;
  const inR = t && t.d <= RADIUS;
  return (
    <ScrollView style={s.panel} contentContainerStyle={{ paddingTop: top + 14, paddingBottom: bottom + 20, paddingHorizontal: 16 }}>
      <Text style={s.h2}>Radar</Text>
      {!t ? <Text style={s.sm}>Čekám na polohu…</Text> : (
        <View style={[s.card, { alignItems: 'center', backgroundColor: inR ? '#e3f1d3' : C.paper }]}>
          <Text style={s.sm}>Nejbližší nenavštívený strom</Text>
          <Text style={[s.h3, { textAlign: 'center', marginTop: 4 }]}>{t.p[1]}</Text>
          <View style={[s.dial, { width: dial, height: dial, borderRadius: dial / 2 }, inR && { borderColor: C.moss }]}>
            {ang != null ? <View style={{ transform: [{ rotate: ang + 'deg' }] }}><Ic n="arrow-up-bold" s={dial * 0.5} c={inR ? C.moss : C.forest} /></View>
              : <Ic n="tree" s={dial * 0.45} c={C.moss} />}
          </View>
          <Text style={{ fontFamily: SERIF, fontSize: 38, fontWeight: '800', color: C.forest }}>{fmtD(t.d)}</Text>
          <Text style={s.sm}>{inR ? 'Jsi tady! Odklikni strom.' : ang != null ? 'Otoč se podle šipky a jdi' : 'Kompas není k dispozici'}</Text>
          <Btn icon={inR ? 'check-circle-outline' : 'information-outline'} title={inR ? 'Odkliknout' : 'Zobrazit detail'} onPress={() => onOpen(t.p[0])} style={{ alignSelf: 'stretch' }} />
        </View>
      )}
      {!!t && near.length > 1 && <Btn ghost icon="map-marker-path" title="Naplánovat trasu přes okolní stromy" onPress={() => {
        const stops = near.slice(0, 5);
        Alert.alert('Profil trasy', 'Vyber způsob dopravy.', [
          { text: 'Pěšky', onPress: () => onRoute(stops, 'pedestrian') },
          { text: 'Cyklo', onPress: () => onRoute(stops, 'bicycle') },
          { text: 'Auto', onPress: () => onRoute(stops, 'auto') },
        ]);
      }} />}
      {day && (
        <View style={[s.card, { backgroundColor: '#fbf0cf' }]}>
          <View style={s.rowi}><Ic n="weather-sunny" s={16} c={C.bark} /><Text style={s.sm}>STROM DNE</Text></View>
          <Text style={[s.h3, { marginVertical: 4 }]}>{day[1]}</Text>
          <Text style={s.sm}>{visited.has(day[0]) ? 'Už ho máš' : 'Dnes ho zkus navštívit – pro všechny hráče stejný!'}</Text>
          <Btn ghost title="Ukázat na mapě" onPress={() => onShow(day[0])} />
        </View>
      )}
      <Text style={[s.h3, { marginTop: 8 }]}>V okolí</Text>
      {!near.length && <Text style={[s.sm, { marginTop: 6 }]}>{points.length ? 'Čekám na polohu – zapni GPS a povol ji appce.' : 'Seznam stromů zatím není načtený.'}</Text>}
      {near.length === 1 && <Text style={[s.sm, { marginTop: 6 }]}>Další nenavštívené stromy v okolí nejsou.</Text>}
      {near.slice(1, 10).map((n) => (
        <T key={n.p[0]} style={s.row} onPress={() => onShow(n.p[0])}>
          <Ic n="tree" s={24} c={C.moss} />
          <View style={{ flex: 1 }}><Text style={s.b} numberOfLines={1}>{n.p[1]}</Text></View>
          <Text style={s.sm}>{fmtD(n.d)}</Text>
        </T>
      ))}
    </ScrollView>
  );
}

/* ============================== přihlášení / úprava profilu ============================== */
function Auth({ mode: m0, me, onClose, onDone, onMe }) {
  const [mode, setMode] = useState(m0);
  const [u, setU] = useState(''); const [pw, setPw] = useState('');
  const [av, setAv] = useState(me ? me.avatar : AVATARS[0]);
  const [bio, setBio] = useState(me ? me.bio : '');
  const [ph, setPh] = useState(me ? me.photo : null);
  const [upl, setUpl] = useState(false);
  const [err, setErr] = useState(null);
  const edit = mode === 'edit';
  const go = async () => {
    try {
      if (edit) { await api('/me', { json: { avatar: av, bio } }); onDone({ ...me, avatar: av, bio, photo: ph }); return; }
      const r = await api(mode === 'reg' ? '/register' : '/login', { json: { username: u, password: pw, avatar: av } });
      onDone(r.user, r.token);
    } catch (e) { setErr(e.message); }
  };
  const pickPhoto = async () => {
    try {
      try { await ImagePicker.requestMediaLibraryPermissionsAsync(); } catch (e) {}
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (r.canceled) return;
      setUpl(true); setErr(null);
      const a = r.assets[0], side = Math.min(a.width || 0, a.height || 0), opt = { compress: 0.8, format: Manip.SaveFormat.JPEG };
      let m;
      try {   // čtvercový výřez ze středu (bez nativního editoru – ten v Modalu na Androidu padal)
        m = await Manip.manipulateAsync(a.uri, [{ crop: { originX: Math.floor((a.width - side) / 2), originY: Math.floor((a.height - side) / 2), width: side, height: side } }, { resize: { width: 400 } }], opt);
      } catch (e2) { m = await Manip.manipulateAsync(a.uri, [{ resize: { width: 400 } }], opt); }
      const res = await upload('/me/avatar', 'avatar', m.uri, 'a.jpg');
      setPh(res.user.photo); onMe({ ...me, photo: res.user.photo }); avReplace(res.user.photo);
    } catch (e) { setErr(e.message); }
    setUpl(false);
  };
  const removePhoto = async () => {
    try { await api('/me/avatar', { method: 'DELETE' }); setPh(null); onMe({ ...me, photo: null }); avClear(); } catch (e) { setErr(e.message); }
  };
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#1f3d2bcc', justifyContent: 'flex-end' }}>
        <ScrollView style={{ maxHeight: '92%', backgroundColor: C.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26 }} contentContainerStyle={{ padding: 20, paddingBottom: 36 }} keyboardShouldPersistTaps="handled">
          <Text style={s.h2}>{edit ? 'Upravit profil' : mode === 'reg' ? 'Vítej v lese' : 'Přihlášení'}</Text>
          {!edit && <>
            <TextInput style={[s.input, { marginTop: 12 }]} placeholder="Uživatelské jméno" placeholderTextColor={C.mute} autoCapitalize="none" value={u} onChangeText={setU} />
            <TextInput style={[s.input, { marginTop: 8 }]} placeholder="Heslo (min. 6 znaků)" placeholderTextColor={C.mute} secureTextEntry value={pw} onChangeText={setPw} />
          </>}
          {edit && (
            <View style={{ alignItems: 'center', marginVertical: 10 }}>
              <Av a={av} photo={ph} size={96} />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <Btn ghost icon="image-outline" style={{ flex: 1 }} title={upl ? 'Nahrávám…' : 'Vlastní fotka'} disabled={upl} onPress={pickPhoto} />
                {!!ph && <Btn ghost style={{ flex: 1 }} title="Odebrat fotku" onPress={removePhoto} />}
              </View>
            </View>
          )}
          {mode !== 'login' && <>
            <Text style={[s.sm, { marginTop: 12 }]}>{edit ? 'Avatar (zobrazí se, když nemáš fotku)' : 'Vyber si avatar'}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 10 }}>
              {AVATARS.map((a) => <T key={a} onPress={() => setAv(a)} style={[{ borderRadius: 24, borderWidth: 2, borderColor: 'transparent' }, av === a && { borderColor: C.moss }]}><Av a={a} size={44} /></T>)}
            </View>
          </>}
          {edit && <TextInput style={[s.input, { height: 70 }]} multiline maxLength={160} placeholder="Krátké představení" placeholderTextColor={C.mute} value={bio} onChangeText={setBio} />}
          {err && <Text style={s.warn}>{err}</Text>}
          <Btn title={edit ? 'Uložit' : mode === 'reg' ? 'Vytvořit účet' : 'Přihlásit se'} onPress={go} />
          {!edit && <Btn ghost title={mode === 'reg' ? 'Už mám účet' : 'Nemám účet – registrovat'} onPress={() => { setErr(null); setMode(mode === 'reg' ? 'login' : 'reg'); }} />}
          {!edit && <Text style={[s.sm, { textAlign: 'center', marginTop: 10 }]}>Registrací souhlasíš se <Text style={{ color: C.moss }} onPress={() => Linking.openURL(API + '/privacy')}>zásadami ochrany soukromí</Text>.</Text>}
          <Btn ghost title="Zrušit" onPress={onClose} style={{ borderWidth: 0 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ============================== nastavení (soukromí, heslo, aktualizace, zvuk) ============================== */
function SettingsModal({ me, settings, onSet, onClose, onMe }) {
  const [priv, setPriv] = useState(() => ({ board: true, bio: true, stats: true, history: true, photos: true, challenges: true, badges: true, ...((me && me.priv) || {}) }));
  const [pwOpen, setPwOpen] = useState(false);
  const [o, setO] = useState(''); const [n1, setN1] = useState(''); const [n2, setN2] = useState('');
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);
  const togglePriv = async (k, v) => {
    setPriv((p) => ({ ...p, [k]: v })); setNote(null);
    try {
      const r = await api('/me/privacy', { json: { priv: { [k]: v } } });
      onMe({ ...me, ...r.user });
    } catch (e) { setPriv((p) => ({ ...p, [k]: !v })); setNote({ ok: false, t: e.code ? e.message : 'Jsi offline – nastavení soukromí se nepodařilo uložit.' }); }
  };
  const savePw = async () => {
    if (!o) return setNote({ ok: false, t: 'Zadej původní heslo.' });
    if (n1.length < 6) return setNote({ ok: false, t: 'Nové heslo musí mít aspoň 6 znaků.' });
    if (n1 !== n2) return setNote({ ok: false, t: 'Nová hesla se neshodují.' });
    setBusy(true); setNote(null);
    try {
      await api('/me/password', { json: { old: o, new: n1 } });
      setNote({ ok: true, t: 'Heslo bylo změněno.' }); setPwOpen(false); setO(''); setN1(''); setN2('');
    } catch (e) { setNote({ ok: false, t: e.code ? e.message : 'Jsi offline – heslo nelze změnit.' }); }
    setBusy(false);
  };
  const Sw = ({ v, on }) => <Switch value={v} onValueChange={on} trackColor={{ false: '#d8d2b8', true: C.leaf }} thumbColor={v ? C.moss : '#f4f1e6'} />;
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#1f3d2bcc', justifyContent: 'flex-end' }}>
        <ScrollView style={{ maxHeight: '92%', backgroundColor: C.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26 }} contentContainerStyle={{ padding: 20, paddingBottom: 36 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={s.h2}>Nastavení</Text>
            <T onPress={onClose} hitSlop={8}><Ic n="close" s={24} c={C.forest} /></T>
          </View>
          <H3 t="Jazyk" style={{ marginTop: 10 }} />
          <Seg v={settings.language || 'cs'} onChange={(language) => onSet({ language })} opts={[["cs", "Čeština"], ["sk", "Slovenčina"], ["en", "English"]]} />
          {!!note && <View style={[s.warn, { flexDirection: 'row', gap: 8, alignItems: 'center' }, note.ok && { backgroundColor: '#e3f1d3' }]}><Ic n={note.ok ? 'check-circle' : 'alert-circle-outline'} s={18} c={note.ok ? C.moss : '#8a3a22'} /><Text style={{ flex: 1, color: note.ok ? C.forest : '#8a3a22', fontSize: 13 }}>{note.t}</Text></View>}

          <H3 t="Aktualizace seznamu stromů" style={{ marginTop: 14 }} />
          {UPD.map(([k, ic, t, sub]) => {
            const on = settings.upd === k;
            return (
              <T key={k} style={[s.row, on && { borderColor: C.moss, backgroundColor: '#eef6e4' }]} onPress={() => onSet({ upd: k })}>
                <Ic n={ic} s={22} c={on ? C.moss : C.mute} />
                <View style={{ flex: 1 }}><Text style={s.b}>{t}</Text><Text style={s.sm}>{sub}</Text></View>
                <Ic n={on ? 'radiobox-marked' : 'radiobox-blank'} s={22} c={on ? C.moss : C.mute} />
              </T>
            );
          })}

          <H3 t="Zvuky" style={{ marginTop: 18 }} />
          <View style={s.row}>
            <Ic n="music-note" s={22} c={C.moss} />
            <View style={{ flex: 1 }}><Text style={s.b}>Vítězný zvuk při odkliku</Text><Text style={s.sm}>Přehraje se po odkliknutí stromu a splnění výzvy.</Text></View>
            <Sw v={settings.sound} on={(v) => { onSet({ sound: v }); if (v) playSound('win'); }} />
          </View>

          <H3 t="Mapa" style={{ marginTop: 18 }} />
          <View style={s.row}>
            <Ic n="compass-outline" s={22} c={C.moss} />
            <View style={{ flex: 1 }}><Text style={s.b}>Otáčení mapy</Text><Text style={s.sm}>Po vypnutí zůstane mapa vždy otočená na sever a kompas se skryje.</Text></View>
            <Sw v={settings.rot} on={(v) => onSet({ rot: v })} />
          </View>
          <H3 t="Upozornění" style={{ marginTop: 18 }} />
          <View style={s.row}>
            <Ic n="bell-outline" s={22} c={C.moss} />
            <View style={{ flex: 1 }}><Text style={s.b}>Denní připomenutí</Text><Text style={s.sm}>Každý den v 10:00 připomene výpravu za stromem.</Text></View>
            <Sw v={settings.dailyReminder} on={async (v) => {
              if (!v) { await Notifications.cancelAllScheduledNotificationsAsync(); onSet({ dailyReminder: false }); return; }
              if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'Stromobraní', importance: Notifications.AndroidImportance.DEFAULT });
              const current = await Notifications.getPermissionsAsync();
              const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
              if (!permission.granted) { setNote({ ok: false, t: 'Povol oznámení v nastavení telefonu.' }); return; }
              onSet({ dailyReminder: true });
            }} />
          </View>
          <View style={s.row}>
            <Ic n="map-marker-check-outline" s={22} c={C.moss} />
            <View style={{ flex: 1 }}><Text style={s.b}>Strom v okolí</Text><Text style={s.sm}>Upozorní, když se přiblížíš k nenavštívenému stromu.</Text></View>
            <Sw v={settings.nearbyNotif} on={async (v) => {
              if (!v) { onSet({ nearbyNotif: false }); return; }
              if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'Stromobraní', importance: Notifications.AndroidImportance.DEFAULT });
              const p = await Notifications.getPermissionsAsync(); const r = p.granted ? p : await Notifications.requestPermissionsAsync();
              if (r.granted) onSet({ nearbyNotif: true }); else setNote({ ok: false, t: 'Povol oznámení v nastavení telefonu.' });
            }} />
          </View>

          {!!me && (<>
            <H3 t="Soukromí profilu" style={{ marginTop: 18 }} />
            <Text style={[s.sm, { marginTop: 4 }]}>Vyber, co o tobě uvidí ostatní. Hodnocení, poznámka a fotky přidané přímo u stromu zůstávají u stromu viditelné pod tvým jménem.</Text>
            {PRIV.map(([k, ic, t, sub]) => (
              <View key={k} style={s.row}>
                <Ic n={ic} s={22} c={priv[k] ? C.moss : C.mute} />
                <View style={{ flex: 1 }}><Text style={s.b}>{t}</Text>{!!sub && <Text style={s.sm}>{sub}</Text>}</View>
                <Sw v={priv[k]} on={(v) => togglePriv(k, v)} />
              </View>
            ))}

            <H3 t="Heslo" style={{ marginTop: 18 }} />
            {!pwOpen ? <Btn ghost icon="lock-reset" title="Změnit heslo" onPress={() => { setNote(null); setPwOpen(true); }} /> : (
              <View style={s.card}>
                <TextInput style={s.input} placeholder="Původní heslo" placeholderTextColor={C.mute} secureTextEntry value={o} onChangeText={setO} autoCapitalize="none" />
                <TextInput style={[s.input, { marginTop: 8 }]} placeholder="Nové heslo (min. 6 znaků)" placeholderTextColor={C.mute} secureTextEntry value={n1} onChangeText={setN1} autoCapitalize="none" />
                <TextInput style={[s.input, { marginTop: 8 }]} placeholder="Nové heslo znovu" placeholderTextColor={C.mute} secureTextEntry value={n2} onChangeText={setN2} autoCapitalize="none" />
                <Btn icon="content-save-outline" title={busy ? 'Ukládám…' : 'Uložit nové heslo'} disabled={busy} onPress={savePw} />
                <Btn ghost title="Zrušit" onPress={() => { setPwOpen(false); setO(''); setN1(''); setN2(''); }} />
              </View>
            )}
          </>)}
          <Btn title="Hotovo" onPress={onClose} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ============================== filtr mapy ============================== */
function FilterModal({ init, points, visited, taken, species, dendro, loadTaken, onApply, onClose, favorites }) {
  const [f, setF] = useState(init);
  useEffect(() => { loadTaken(false); }, []);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const cnt = useMemo(() => new Set(applyFilter(points, f, visited, taken, favorites).map((p) => p[0])).size, [f, points, visited, taken, favorites]);
  const togSp = (n) => set({ sp: f.sp.includes(n) ? f.sp.filter((x) => x !== n) : [...f.sp, n] });
  const Sec = ({ ic, t, children }) => (
    <View style={{ marginTop: 16 }}>
      <View style={s.rowi}><Ic n={ic} s={18} c={C.moss} /><Text style={s.b}>{t}</Text></View>
      {children}
    </View>
  );
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#1f3d2b99', justifyContent: 'flex-end' }}>
        <T style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={{ maxHeight: '86%', backgroundColor: C.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18 }}>
            <Text style={s.h2}>Filtr stromů</Text>
            <T onPress={() => setF(F0)} disabled={!fCount(f)} style={[s.rowi, !fCount(f) && { opacity: 0.35 }]}><Ic n="filter-remove-outline" s={18} c={C.moss} /><Text style={{ color: C.moss, fontWeight: '800' }}>Zrušit filtry</Text></T>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 14 }} keyboardShouldPersistTaps="handled">
            <Sec ic="check-circle-outline" t="Stav návštěvy"><View style={{ marginTop: 8 }}><Seg v={f.st} onChange={(v) => set({ st: v })} opts={[['all', 'Vše'], ['new', 'Nenavštívené'], ['done', 'Navštívené']]} /></View></Sec>
            <T style={[s.row, f.fav && { borderColor: C.moss, backgroundColor: '#eef6e4' }]} onPress={() => set({ fav: !f.fav })}><Ic n={f.fav ? 'heart' : 'heart-outline'} s={20} c={f.fav ? C.red : C.moss} /><Text style={s.b}>Jen oblíbené ({favorites.length})</Text><View style={{ flex: 1 }} /><Ic n={f.fav ? 'checkbox-marked' : 'checkbox-blank-outline'} s={21} c={f.fav ? C.moss : C.mute} /></T>
            <Sec ic="star-circle-outline" t="Prvonávštěva (+50 b v letošním roce)">
              <View style={{ marginTop: 8 }}><Seg v={f.fv} onChange={(v) => set({ fv: v })} opts={[['all', 'Vše'], ['free', 'K dispozici'], ['taken', 'Obsazená']]} /></View>
              {f.fv !== 'all' && !taken && <Text style={[s.sm, { marginTop: 6, color: '#8a3a22' }]}>Údaje o prvonávštěvách se nepodařilo načíst (jsi online?) – filtr se zatím nepoužije.</Text>}
              {f.fv !== 'all' && !!taken && <Text style={[s.sm, { marginTop: 6 }]}>{f.fv === 'free' ? 'Stromy, které letos ještě nikdo neodkliknul.' : 'Stromy, které už letos někdo odkliknul.'}</Text>}
            </Sec>
            <Sec ic="tree-outline" t={`Druh stromu${f.sp.length ? ` (${f.sp.length})` : ''}`}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {species.map(([n, c]) => {
                  const on = f.sp.includes(n);
                  return <T key={n} onPress={() => togSp(n)} style={[s.chip, on && s.chipOn]}><Text style={[s.chipT, on && { color: '#fff' }]}>{n} <Text style={{ fontWeight: '600', opacity: 0.7 }}>{c}</Text></Text></T>;
                })}
              </View>
            </Sec>
            <Sec ic="tape-measure" t="Obvod kmene">
              {dendro.ob ? <Presets v={f.ob} opts={OB_P} onChange={(v) => set({ ob: v })} /> : <Text style={[s.sm, { marginTop: 6 }]}>Údaje o obvodu zatím nejsou k dispozici.</Text>}
            </Sec>
            <Sec ic="human-male-height" t="Výška">
              {dendro.vy ? <Presets v={f.vy} opts={VY_P} onChange={(v) => set({ vy: v })} /> : <Text style={[s.sm, { marginTop: 6 }]}>Údaje o výšce zatím nejsou k dispozici.</Text>}
            </Sec>
            <Sec ic="history" t="Stáří">
              {dendro.sa ? <Presets v={f.sa} opts={SA_P} onChange={(v) => set({ sa: v })} /> : <Text style={[s.sm, { marginTop: 6 }]}>Údaje o stáří zatím nejsou k dispozici.</Text>}
            </Sec>
            {(f.ob > 0 || f.vy > 0 || f.sa > 0) && <Text style={[s.sm, { marginTop: 12 }]}>Údaje o obvodu, výšce a stáří existují jen u části stromů (obvod {dendro.ob}, výška {dendro.vy}, stáří {dendro.sa}) – ostatní se při takovém filtru skryjí.</Text>}
          </ScrollView>
          <View style={{ paddingHorizontal: 20, paddingBottom: 22, paddingTop: 4 }}>
            <Btn icon="filter-check-outline" title={`Zobrazit ${cnt} ${cnt === 1 ? 'strom' : cnt >= 2 && cnt <= 4 ? 'stromy' : 'stromů'}`} onPress={() => onApply(f)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ============================== offline správce ============================== */
const around = (lon, lat, r) => { const dLa = r / 110540, dLo = r / (111320 * Math.cos(lat * rad)); return [[lon + dLo, lat + dLa], [lon - dLo, lat - dLa]]; };
function OfflineModal({ onClose, mapRef, pos, meta, queue, onTrees, onSync, onSettings, settings, toast, msg }) {
  const [packs, setPacks] = useState([]);
  const [prog, setProg] = useState(null);
  const loadPacks = async () => {
    try {
      const ps = await Mapbox.offlineManager.getPacks();
      setPacks(await Promise.all((ps || []).map(async (p) => { const st = await p.status(); return { name: p.name, pct: Math.round(st.percentage), mb: st.completedResourceSize / 1048576 }; })));
    } catch (e) {}
  };
  useEffect(() => { loadPacks(); }, []);
  const dl = async (name, bounds, minZoom, maxZoom) => {
    setProg({ name, pct: 0 });
    try { await Mapbox.offlineManager.deletePack(name); } catch (e) {}
    try {
      await Mapbox.offlineManager.createPack({ name, styleURL: STYLE, bounds, minZoom, maxZoom },
        (pk, st) => { setProg({ name, pct: Math.round(st.percentage) }); if (st.percentage >= 100) { setProg(null); loadPacks(); toast('Mapa uložena offline', 'map-check-outline'); } },
        () => { setProg(null); toast('Stahování mapy selhalo (jsi online? limit dlaždic?)', 'alert-circle-outline'); });
    } catch (e) { setProg(null); toast(e.message, 'alert-circle-outline'); }
  };
  const view = async () => { try { const b = await mapRef.current.getVisibleBounds(); dl('vyrez', b, 10, 16); } catch (e) { toast('Výřez nelze zjistit', 'alert-circle-outline'); } };
  const del = async (name) => { try { await Mapbox.offlineManager.deletePack(name); } catch (e) {} loadPacks(); };
  const NAMES = { okoli: 'Okolí 8 km', vyrez: 'Vybraný výřez', cr: 'Celá ČR (přehled)' };
  const Row = ({ ic, t, sub, onPress, disabled }) => (
    <T style={[s.row, disabled && { opacity: 0.4 }]} disabled={disabled || !!prog} onPress={onPress}>
      <Ic n={ic} s={22} c={C.moss} />
      <View style={{ flex: 1 }}><Text style={s.b}>{t}</Text><Text style={s.sm}>{sub}</Text></View><Ic n="download" s={22} c={C.forest} />
    </T>
  );
  const upd = UPD.find((x) => x[0] === settings.upd) || UPD[0];
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#1f3d2bcc', justifyContent: 'flex-end' }}>
        <ScrollView style={{ maxHeight: '90%', backgroundColor: C.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26 }} contentContainerStyle={{ padding: 20, paddingBottom: 36 }}>
          <View style={s.rowi}><Ic n="download-circle-outline" s={28} c={C.forest} /><Text style={s.h2}>Offline režim</Text></View>
          {!!msg && <Text style={[s.warn, { backgroundColor: '#e3f1d3', color: C.forest, marginBottom: 8 }]}>{msg}</Text>}
          <Text style={s.h3}>Stromy</Text>
          <View style={s.card}>
            <Text style={s.b}>{meta ? `${meta.count} objektů uloženo v telefonu` : 'Zatím nic uloženo'}</Text>
            <Text style={s.sm}>{meta ? 'Naposledy staženo: ' + new Date(meta.ts).toLocaleString('cs-CZ') : ''}{meta && meta.chk ? '\nNaposledy zkontrolováno: ' + new Date(meta.chk).toLocaleString('cs-CZ') : ''}</Text>
            <View style={[s.rowi, { marginTop: 8 }]}><Ic n={upd[1]} s={16} c={C.moss} /><Text style={[s.sm, { flex: 1 }]}>Automatická aktualizace: {upd[2]}</Text><Text style={[s.sm, { color: C.moss }]} onPress={onSettings}>Změnit</Text></View>
            <Btn ghost icon="refresh" title="Stáhnout / aktualizovat stromy" onPress={onTrees} />
          </View>
          <Text style={s.h3}>Mapa bez signálu</Text>
          <Row ic="crosshairs-gps" t="Okolí 8 km" sub="Zoom 10–16, kolem tvé polohy" disabled={!pos} onPress={() => pos && dl('okoli', around(pos.lon, pos.lat, 8000), 10, 16)} />
          <Row ic="vector-rectangle" t="Aktuální výřez mapy" sub="Zoom 10–16 · drž ho malý (do cca 15 km)" onPress={view} />
          <Row ic="map-outline" t="Celá ČR – přehled" sub="Zoom 5–11, pár desítek MB" onPress={() => dl('cr', [[18.95, 51.1], [12.0, 48.5]], 5, 11)} />
          {prog && <View style={s.card}><Text style={s.b}>Stahuji {NAMES[prog.name] || prog.name}… {prog.pct} %</Text>
            <View style={s.bar}><View style={{ width: prog.pct + '%', height: '100%', backgroundColor: C.leaf }} /></View></View>}
          {packs.length > 0 && <Text style={[s.h3, { marginTop: 10 }]}>Uložené mapy</Text>}
          {packs.map((p) => (
            <View key={p.name} style={s.row}>
              <View style={{ flex: 1 }}><Text style={s.b}>{NAMES[p.name] || p.name}</Text><Text style={s.sm}>{p.pct} % · {p.mb.toFixed(1).replace('.', ',')} MB</Text></View>
              <T onPress={() => del(p.name)} hitSlop={8}><Ic n="trash-can-outline" s={22} c={C.red} /></T>
            </View>
          ))}
          <Text style={[s.sm, { marginTop: 8 }]}>Mapbox omezuje počet offline dlaždic na účet (výchozí limit je zhruba 6 000), proto nestahuj velké oblasti ve vysokém zoomu.</Text>
          <Text style={[s.h3, { marginTop: 14 }]}>Fronta návštěv</Text>
          <View style={s.card}>
            <View style={s.rowi}><Ic n={queue.length ? 'clock-outline' : 'check-circle-outline'} s={20} c={queue.length ? C.bark : C.moss} /><Text style={s.b}>{queue.length ? `${queue.length} návštěv čeká na odeslání` : 'Vše odesláno'}</Text></View>
            <Text style={s.sm}>Stromy odkliknuté bez signálu se odešlou samy, jakmile se připojíš (poloha a čas ověření se uloží s nimi).</Text>
            {queue.length > 0 && <Btn ghost icon="cloud-upload-outline" title="Odeslat teď" onPress={onSync} />}
          </View>
          <Btn title="Hotovo" onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ============================== základní mapa (memo = nepřekresluje se při psaní, toastech apod.) ============================== */
const MapBase = React.memo(function MapBase({ mapRef, cam, src, geo, range, meF, heatF, onPress, tabh, rot, ctop, initCam, onIdle }) {
  const lp = useMemo(() => ({ bottom: tabh + 4, left: 8 }), [tabh]);
  const ap = useMemo(() => ({ bottom: tabh + 4, left: 96 }), [tabh]);
  const cp = useMemo(() => ({ top: ctop, right: 12 }), [ctop]);
  return (
    <Mapbox.MapView ref={mapRef} style={{ flex: 1 }} styleURL={STYLE} logoEnabled attributionEnabled logoPosition={lp} attributionPosition={ap} scaleBarEnabled={false} rotateEnabled={rot} compassEnabled={rot} compassFadeWhenNorth compassPosition={cp} onMapIdle={onIdle}>
      <Mapbox.Camera ref={cam} defaultSettings={initCam} />
      <Mapbox.ShapeSource id="range" shape={range}>
        <Mapbox.FillLayer id="range-f" style={ST_RANGE_F} />
        <Mapbox.LineLayer id="range-l" style={ST_RANGE_L} />
      </Mapbox.ShapeSource>
      <Mapbox.ShapeSource id="trees" ref={src} shape={geo} cluster clusterRadius={46} clusterMaxZoomLevel={12} onPress={onPress} hitbox={HIT}>
        <Mapbox.CircleLayer id="cl" filter={F_CL} style={ST_CL} />
        <Mapbox.SymbolLayer id="cln" filter={F_CL} style={ST_CLN} />
        <Mapbox.CircleLayer id="pt-h" filter={F_PT} style={ST_PTH} />
        <Mapbox.CircleLayer id="pt" filter={F_PT} style={ST_PT} />
        <Mapbox.SymbolLayer id="pt-ok" minZoomLevel={11} filter={F_OK} style={ST_OK} />
      </Mapbox.ShapeSource>
      <Mapbox.ShapeSource id="me" shape={meF}>
        <Mapbox.CircleLayer id="me-h" style={ST_MEH} />
        <Mapbox.CircleLayer id="me-d" style={ST_MED} />
      </Mapbox.ShapeSource>
      <Mapbox.ShapeSource id="visit-heat" shape={heatF}><Mapbox.HeatmapLayer id="visit-heat-layer" style={ST_HEAT} /></Mapbox.ShapeSource>
    </Mapbox.MapView>
  );
});

const Fab = React.memo(({ bottom, icon, onPress, badge, badgeColor }) => (
  <T style={[s.fab, { bottom }]} onPress={onPress} activeOpacity={0.8}>
    <Ic n={icon} s={24} c={C.forest} />
    {badge > 0 && <View style={[s.fbadge, { backgroundColor: badgeColor || C.red }]}><Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{badge}</Text></View>}
  </T>
));

/* ============================== hlavní aplikace ============================== */
function Main() {
  const ins = useSafeAreaInsets();
  const TABH = 62 + ins.bottom;
  const [me, setMe] = useState(null);
  const [visited, setVisited] = useState(new Set());
  const [favorites, setFavorites] = useState([]);
  const [widgetStreak, setWidgetStreak] = useState(0);
  const [points, setPoints] = useState([]);
  const [ready, setReady] = useState(false);
  const [pos, setPos] = useState(null);
  const [heading, setHeading] = useState(null);
  const [heatOn, setHeatOn] = useState(false);
  const [heatPoints, setHeatPoints] = useState([]);
  const headingRef = useRef(null);
  const [tab, setTab] = useState('map');
  const [sel, setSel] = useState(null);
  const [flt, setFlt] = useState(F0);
  const [fOpen, setFOpen] = useState(false);
  const [taken, setTaken] = useState(null);
  const [q, setQ] = useState('');
  const [profId, setProfId] = useState(null);
  const [auth, setAuth] = useState(null);
  const [msg, setMsg] = useState(null);
  const [meta, setMeta] = useState(null);
  const [queue, setQueue] = useState([]);
  const [off, setOff] = useState(false);
  const [suggesting, setSuggesting] = useState(null);
  const [sett, setSett] = useState(false);
  const [settings, setSettings] = useState(DEF_SET);
  APP_LANG = settings.language || 'cs';
  const cam = useRef(null), src = useRef(null), lastIn = useRef(null), first = useRef(true);
  const skipFirstLocationCenter = useRef(false);
  const mapRef = useRef(null), queueRef = useRef([]), syncing = useRef(false);
  const lastCam = useRef({ ...DEF_CAM });   // poslední poloha kamery – mapa se na jiných záložkách odpojuje a po návratu se obnoví tady
  const tabRef = useRef('map'), profFrom = useRef(null), linkRef = useRef(null), applyRef = useRef(() => {}), pressRef = useRef(() => {});
  const locSubs = useRef([]), locBusy = useRef(false), lastPos = useRef(null), mockRef = useRef(false);
  const [mock, setMock] = useState(false);
  const settingsRef = useRef(DEF_SET), metaRef = useRef(null), pointsRef = useRef([]), fltRef = useRef(F0), takenTs = useRef(0);
  const burst = useRef(new Animated.Value(0)).current;
  const [bp, setBp] = useState(10);
  const [bch, setBch] = useState([]);
  const tm = useRef();
  tabRef.current = tab; pointsRef.current = points; fltRef.current = flt;

  /* kamera: pohyb + zapamatování (kdyby mapa právě nebyla připojená, objeví se po návratu na správném místě) */
  const flyTo = (o) => {
    const l = lastCam.current;
    if (o.centerCoordinate) l.centerCoordinate = o.centerCoordinate;
    if (o.zoomLevel != null) l.zoomLevel = o.zoomLevel;
    if (o.heading != null) l.heading = o.heading;
    if (o.padding) l.padding = o.padding;
    if (cam.current) cam.current.setCamera(o);
  };
  const onMapIdle = useCallback((st) => {
    try {
      const p = st && st.properties; if (!p) return;
      const l = lastCam.current; l.centerCoordinate = p.center; l.zoomLevel = p.zoom; l.heading = p.heading || 0;
    } catch (e) {}
  }, []);
  const toast = (m, ic) => { setMsg({ t: m, ic }); clearTimeout(tm.current); tm.current = setTimeout(() => setMsg(null), 2800); };
  useEffect(() => () => clearTimeout(tm.current), []);
  const byKod = useMemo(() => { const o = {}; points.forEach((p) => { (o[p[0]] ??= { pts: [], name: p[1], count: p[5], druh: p[4], obvod: p[6] || 0, vyska: p[7] || 0, stari: p[8] || 0 }).pts.push([p[2], p[3]]); }); return o; }, [points]);
  const species = useMemo(() => {
    const m = {}, seen = new Set();
    for (const p of points) { if (seen.has(p[0])) continue; seen.add(p[0]); const d = p[4] || 'Jiný'; m[d] = (m[d] || 0) + 1; }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [points]);
  const dendro = useMemo(() => {
    let ob = 0, vy = 0, sa = 0; const seen = new Set();
    for (const p of points) { if (seen.has(p[0])) continue; seen.add(p[0]); if (p[6]) ob++; if (p[7]) vy++; if (p[8]) sa++; }
    return { ob, vy, sa };
  }, [points]);

  /* zvuk: přehrávat i při vypnutém zvonění a nepřerušovat hudbu */
  useEffect(() => { setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {}); }, []);
  useEffect(() => {
    (async () => {
      if (!settings.dailyReminder) { await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {}); return; }
      await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
      await Notifications.scheduleNotificationAsync({ content: { title: 'Čas na Stromobraní 🌳', body: 'Vydej se objevit další památný strom.' }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 10, minute: 0 } }).catch(() => {});
    })();
  }, [settings.dailyReminder]);

  /* Android tlačítko Zpět: zavře vrstvy od nejvyšší, vrátí se odkud jsi přišel, na mapě ukončí aplikaci druhým stiskem */
  const bk = useRef(), lastBack = useRef(0);
  bk.current = () => {
    if (suggesting) { setSuggesting(null); return true; }
    if (sett) { setSett(false); return true; }
    if (fOpen) { setFOpen(false); return true; }
    if (off) { setOff(false); return true; }
    if (auth) { setAuth(null); return true; }
    if (sel) { setSel(null); return true; }
    if (q) { setQ(''); return true; }
    if (tab === 'prof' && profFrom.current && profId && !(me && me.id === profId)) { const t = profFrom.current; profFrom.current = null; setTab(t); return true; }
    if (tab !== 'map') { setTab('map'); return true; }
    if (Date.now() - lastBack.current < 2000) { BackHandler.exitApp(); return true; }
    lastBack.current = Date.now(); toast('Stiskni zpět znovu pro ukončení', 'exit-to-app'); return true;
  };
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => bk.current()); return () => sub.remove(); }, []);

  /* poloha: jen v popředí a s filtrem drobných pohybů (šetří baterii i překreslování) */
  const startLoc = async () => {
    if (locSubs.current.length || locBusy.current) return;
    locBusy.current = true;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return toast('Povol polohu, jinak nelze odklikávat stromy', 'crosshairs-off');
      const sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 3, timeInterval: 3000 }, handleLoc);
      locSubs.current = [sub];
    } catch (e) {} finally { locBusy.current = false; }
  };
  /* zpracování polohy + detekce falešné (mock) polohy – příznak `mocked` hlásí Android */
  const handleLoc = (l) => {
    const m = !!(l && l.mocked);
    if (m !== mockRef.current) {
      mockRef.current = m; setMock(m);
      if (m) { lastPos.current = null; setPos(null); onMockStart(); }
    }
    if (m) return;
    const n = { lat: l.coords.latitude, lon: l.coords.longitude }, p = lastPos.current;
    if (p && hav(p.lat, p.lon, n.lat, n.lon) < 2) return;
    lastPos.current = n; setPos(n);
  };
  /* první použití = jen varování, každé další (nová epizoda) = −1 bod; nevyřízené penalizace čekají na připojení / přihlášení */
  const onMockStart = async () => {
    const c = jparse(await AsyncStorage.getItem('sb_mock'), { n: 0, pen: 0 });
    c.n += 1; if (c.n > 1) c.pen += 1;
    await AsyncStorage.setItem('sb_mock', JSON.stringify(c));
    flushPenalty();
  };
  const flushPenalty = async () => {
    if (!TOKEN) return;
    const c = jparse(await AsyncStorage.getItem('sb_mock'), { n: 0, pen: 0 });
    if (!c.pen) return;
    let done = 0;
    try {
      while (c.pen > 0) { await api('/me/mock-penalty', { method: 'POST' }); c.pen--; done++; await AsyncStorage.setItem('sb_mock', JSON.stringify(c)); }
    } catch (e) { if (e.code && e.code !== 401) { c.pen = 0; await AsyncStorage.setItem('sb_mock', JSON.stringify(c)); } }
    if (done) { toast(`Falešná poloha: −${done} b`, 'map-marker-alert-outline'); loadMe(); }
  };
  const recheckLoc = () => Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(handleLoc).catch(() => {});
  /* po zablokování se poloha průběžně znovu ověřuje, aby se appka odblokovala sama, jakmile mock přestane */
  useEffect(() => {
    if (!mock) return;
    recheckLoc(); const id = setInterval(recheckLoc, 4000);
    return () => clearInterval(id);
  }, [mock]);
  const stopLoc = () => { locSubs.current.forEach((x) => x.remove()); locSubs.current = []; };

  /* kompas jen na záložce Radar a jen při změně o ≥ 4° */
  useEffect(() => {
    if (tab !== 'radar') return;
    let sub, motionSub, dead = false;
    Location.watchHeadingAsync((h) => {
      const v = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
      const old = headingRef.current;
      const delta = old == null ? 0 : ((v - old + 540) % 360) - 180;
      headingRef.current = old == null ? v : (old + delta * 0.28 + 360) % 360;
      setHeading(headingRef.current);
    }).then((x) => { if (dead) x.remove(); else sub = x; }).catch(() => {});
    DeviceMotion.setUpdateInterval(50);
    motionSub = DeviceMotion.addListener((m) => {
      if (headingRef.current == null || !m.rotationRate) return;
      const dt = Math.min(0.12, Math.max(0.02, (m.interval || 50) / 1000));
      headingRef.current = (headingRef.current + (m.rotationRate.gamma || 0) * dt + 360) % 360;
      setHeading(headingRef.current);
    });
    return () => { dead = true; if (sub) sub.remove(); if (motionSub) motionSub.remove(); };
  }, [tab]);

  /* init */
  useEffect(() => {
    (async () => {
      TOKEN = await AsyncStorage.getItem('sb_token');
      await avLoad();
      const [cached, m, cm, cq, cs] = await Promise.all(['sb_trees', 'sb_meta', 'sb_me', 'sb_queue', 'sb_settings'].map((k) => AsyncStorage.getItem(k)));
      setFavorites(jparse(await AsyncStorage.getItem('sb_favorites'), []));
      const st = { ...DEF_SET, ...jparse(cs, {}) }; settingsRef.current = st; setSettings(st);
      const qq = jparse(cq, []);
      queueRef.current = qq; setQueue(qq);
      const pts = jparse(cached, null);
      if (pts) { pointsRef.current = pts; setPoints(pts); }
      const mm = jparse(m, null);
      if (mm) { metaRef.current = mm; setMeta(mm); }
      const c = jparse(cm, null);
      if (TOKEN && c) { setMe(c.me); setVisited(new Set([...c.visited, ...qq.map((x) => x.kod)])); }
      /* bez uložených (nebo starých, bez údajů o obvodu/výšce) dat se stahuje vždy; jinak podle nastavení (WiFi / vždy / vypnuto) */
      const stale = !pts || !pts.length || (pts[0] && pts[0].length < 9);
      if (stale) await downloadTrees(false, true);
      else if (await autoOk(st)) await downloadTrees(false);
      setReady(true);
      if (TOKEN) { await loadMe(true); syncQueue(); flushPenalty(); }
    })();
    Linking.getInitialURL().then((u) => { const l = parseLink(u); if (l) { linkRef.current = l; applyRef.current(); } }).catch(() => {});
    const lsub = Linking.addEventListener('url', ({ url }) => { const l = parseLink(url); if (l) { linkRef.current = l; applyRef.current(); } });
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') { startLoc(); syncQueue(); maybeUpdate(); if (fltRef.current.fv !== 'all') loadTaken(true); } else stopLoc();
    });
    const iv = setInterval(() => { if (AppState.currentState === 'active') syncQueue(); }, 60000);
    startLoc();
    return () => { stopLoc(); sub.remove(); lsub.remove(); clearInterval(iv); };
  }, []);
  const toggleFavorite = (kod) => setFavorites((old) => {
    const next = old.includes(kod) ? old.filter((x) => x !== kod) : [...old, kod];
    AsyncStorage.setItem('sb_favorites', JSON.stringify(next)).catch(() => {});
    return next;
  });
  const patchMe = (u) => { setMe(u); AsyncStorage.getItem('sb_me').then((c) => { const o = jparse(c, { visited: [] }); AsyncStorage.setItem('sb_me', JSON.stringify({ ...o, me: u })); }).catch(() => {}); };
  const loadMe = async (check) => {
    try {
      const r = await api('/me');
      setMe(r.user); setVisited(new Set([...r.visited, ...queueRef.current.map((x) => x.kod)]));
      AsyncStorage.setItem('sb_me', JSON.stringify({ me: r.user, visited: r.visited }));
      avSync(r.user.photo, check === true);
    } catch (e) { if (e.code === 401) { TOKEN = null; AsyncStorage.multiRemove(['sb_token', 'sb_me']); setMe(null); } }   // bez signálu zůstávají uložená data
  };
  const saveMeta = (mt) => { metaRef.current = mt; setMeta(mt); AsyncStorage.setItem('sb_meta', JSON.stringify(mt)); };
  const downloadTrees = async (manual, force) => {
    try {
      const old = metaRef.current;
      const r = await fetchTrees(force ? null : old && old.etag);
      const now = Date.now();
      if (r.same) {
        if (old) saveMeta({ ...old, chk: now });
        if (manual) toast('Seznam stromů je aktuální', 'check-circle-outline');
        return;
      }
      const mt = { ts: now, chk: now, etag: r.etag, count: new Set(r.points.map((x) => x[0])).size };
      pointsRef.current = r.points; setPoints(r.points); saveMeta(mt);
      await AsyncStorage.setItem('sb_trees', JSON.stringify(r.points));
      if (manual) toast(`Stromy uloženy offline (${mt.count})`, 'content-save-outline');
    } catch (e) { if (manual || !pointsRef.current.length) toast('Stromy se nepodařilo stáhnout – jsi online?', 'cloud-off-outline'); }
  };
  /* automatická kontrola po návratu do appky (nejdřív po 6 hodinách, jen když to nastavení dovoluje) */
  const maybeUpdate = async () => {
    const m = metaRef.current;
    if (m && Date.now() - (m.chk || m.ts || 0) < 6 * 36e5) return;
    if (await autoOk(settingsRef.current)) downloadTrees(false);
  };
  const setSetting = (patch) => {
    const n = { ...settingsRef.current, ...patch }; settingsRef.current = n; setSettings(n);
    AsyncStorage.setItem('sb_settings', JSON.stringify(n)).catch(() => {});
    if (patch.rot === false) flyTo({ heading: 0, animationDuration: 300 });   // srovnat na sever
  };
  const loadTaken = useCallback(async (force) => {
    if (!force && takenTs.current && Date.now() - takenTs.current < 60000) return true;
    try { const r = await api('/trees/taken'); setTaken(new Set(r.kods)); takenTs.current = Date.now(); return true; } catch (e) { return false; }
  }, []);
  const saveQueue = (qq) => { queueRef.current = qq; setQueue(qq); AsyncStorage.setItem('sb_queue', JSON.stringify(qq)); };
  const addQueue = (it) => saveQueue([...queueRef.current, it]);
  const syncQueue = async () => {
    if (TOKEN) flushPenalty();
    if (!TOKEN || syncing.current || !queueRef.current.length) return;
    syncing.current = true; let ok = 0, chs = [];
    for (const it of [...queueRef.current]) {
      try { const r = await api(`/tree/${it.kod}/visit`, { json: it }); ok++; if (r.challenges) chs = chs.concat(r.challenges); }
      catch (e) { if (!e.code || e.code === 401) break; }   // síť/odhlášení → zkusit později; ostatní chyby (409…) položku zahodí
      saveQueue(queueRef.current.filter((x) => x !== it));
    }
    syncing.current = false;
    if (ok) {
      if (chs.length) celebrate(null, chs);
      toast(`Odesláno offline návštěv: ${ok}${chs.length ? ` · splněno výzev: ${chs.length}` : ''}`, 'cloud-check-outline'); loadMe();
    }
  };
  /* při každém otevření záložky Radar: čerstvá poloha, návštěvy ze serveru (ty se z „V okolí“ vyřazují) a kontrola seznamu stromů
     (ETag → když se nezměnil, přenese se ~0 B; respektuje nastavení aktualizací WiFi / vždy / vypnuto). „near“ i „Strom dne“ se přepočítají samy. */
  useEffect(() => {
    if (tab !== 'radar') return;
    startLoc();
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(handleLoc).catch(() => {});
    if (TOKEN) (async () => { await syncQueue(); await loadMe(); })();
    autoOk(settingsRef.current).then((ok) => { if (ok) downloadTrees(false); });
  }, [tab]);
  useEffect(() => {
    if (!pos || !first.current || !cam.current) return;
    first.current = false;
    if (skipFirstLocationCenter.current) {
      skipFirstLocationCenter.current = false;
      return;
    }
    flyTo({ centerCoordinate: [pos.lon, pos.lat], zoomLevel: 15.5, animationDuration: 1500 });
  }, [pos]);

  /* nejbližší nenavštívené stromy (levný průchod s ploskou aproximací, přesná vzdálenost jen pro pár kandidátů) */
  const near = useMemo(() => {
    if (!pos || !points.length) return [];
    const kx = Math.cos(pos.lat * rad) * 111320, ky = 110540, K = 40;
    const best = []; let worst = Infinity;
    for (const p of points) {
      if (visited.has(p[0])) continue;
      const dx = (p[2] - pos.lon) * kx, dy = (p[3] - pos.lat) * ky, d2 = dx * dx + dy * dy;
      if (best.length >= K && d2 >= worst) continue;
      let i = best.length; best.push(null);
      while (i > 0 && best[i - 1][0] > d2) { best[i] = best[i - 1]; i--; }
      best[i] = [d2, p];
      if (best.length > K) best.pop();
      if (best.length === K) worst = best[K - 1][0];
    }
    const seen = new Set(), out = [];
    for (const [, p] of best) { if (seen.has(p[0])) continue; seen.add(p[0]); out.push({ d: hav(pos.lat, pos.lon, p[3], p[2]), p, pos }); }
    out.sort((a, b) => a.d - b.d);
    return out.slice(0, 10);
  }, [pos && Math.round(pos.lat * 20000), pos && Math.round(pos.lon * 20000), points, visited]);

  useEffect(() => {
    if (!me) { setWidgetStreak(0); return; }
    let dead = false;
    api('/user/' + me.id).then((r) => {
      const days = new Set((r.trees || []).map((x) => dayKey(x.created)));
      const d = new Date();
      if (!days.has(dayKey(`${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} 12:00:00`))) d.setDate(d.getDate() - 1);
      let streak = 0;
      while (streak < 1000) {
        const k = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
        if (!days.has(k)) break;
        streak++; d.setDate(d.getDate() - 1);
      }
      if (!dead) setWidgetStreak(streak);
    }).catch(() => {});
    return () => { dead = true; };
  }, [me && me.id, visited.size]);
  useEffect(() => {
    TreeWidget.updateSnapshot({ streak: widgetStreak, treeName: near[0] ? near[0].p[1] : '', distance: near[0] ? fmtD(near[0].d) : '' });
  }, [widgetStreak, near[0] && near[0].p[0], near[0] && Math.round(near[0].d)]);

  /* haptika + oznámení při vstupu do dosahu */
  useEffect(() => {
    const n = near[0];
    if (n && n.d <= RADIUS && lastIn.current !== n.p[0]) {
      lastIn.current = n.p[0];
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast(`Jsi u stromu „${n.p[1]}“! Můžeš ho odkliknout.`, 'map-marker-check');
      if (settings.nearbyNotif) Notifications.scheduleNotificationAsync({ content: { title: 'Strom poblíž 🌳', body: `Jsi u stromu „${n.p[1]}“.` }, trigger: { seconds: 1 } }).catch(() => {});
    } else if (n && n.d > RADIUS + 15) lastIn.current = null;
  }, [near, settings.nearbyNotif]);

  /* data mapy (filtr se aplikuje na zdroj, aby seděly počty ve shlucích) */
  const shown = useMemo(() => applyFilter(points, flt, visited, taken, favorites), [points, flt, visited, taken, favorites]);
  const geo = useMemo(() => fc(shown.map((p) => pointF(p[2], p[3], { k: p[0], v: visited.has(p[0]) ? 1 : 0 }))), [shown, visited]);
  const heatF = useMemo(() => fc(heatPoints.map(([lon, lat]) => pointF(lon, lat, { intensity: 1 }))), [heatPoints]);
  const range = useMemo(() => (pos ? ring(pos.lon, pos.lat, RADIUS) : fc([])), [pos && pos.lat, pos && pos.lon]);
  const meF = useMemo(() => (pos ? fc([pointF(pos.lon, pos.lat)]) : fc([])), [pos]);
  const results = useMemo(() => {
    if (q.length < 2) return [];
    const k = norm(q), seen = new Set(), out = [];
    for (const p of points) { if (!seen.has(p[0]) && norm(p[1]).includes(k)) { seen.add(p[0]); out.push(p); if (out.length >= 6) break; } }
    return out;
  }, [q, points]);

  const openTree = useCallback((kod, fly = true) => {
    // Jakmile uživatel vybral konkrétní strom, první automatické centrování na GPS
    // nesmí přepsat jeho výběr (platí pro odkazy, profil, Radar i vyhledávání).
    if (first.current) skipFirstLocationCenter.current = true;
    setTab('map'); setSel(+kod); setQ('');
    const t = byKod[kod];
    if (fly && t) flyTo({ centerCoordinate: t.pts[0], zoomLevel: 16.5, padding: { paddingBottom: 420, paddingTop: 0, paddingLeft: 0, paddingRight: 0 }, animationDuration: 700 });
  }, [byKod]);
  pressRef.current = async (e) => {
    const f = e.features && e.features[0]; if (!f) return;
    if (f.properties.cluster) {
      const z = await src.current.getClusterExpansionZoom(f);
      flyTo({ centerCoordinate: f.geometry.coordinates, zoomLevel: z + 0.5, animationDuration: 500 });
    } else openTree(f.properties.k);
  };
  const onMapPress = useCallback((e) => pressRef.current(e), []);

  /* oslava: zvuk + haptika + animace (fanfára, pokud se splnila výzva) */
  const confetti = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * 2 * Math.PI + (i % 2) * 0.2, r = 120 + (i % 3) * 40;
    return {
      ic: ['star-four-points', 'leaf', 'star'][i % 3], c: [C.sun, C.leaf, C.moss, '#e9845c'][i % 4],
      x: burst.interpolate({ inputRange: [0, 0.55], outputRange: [0, Math.cos(a) * r], extrapolate: 'clamp' }),
      y: burst.interpolate({ inputRange: [0, 0.55], outputRange: [0, Math.sin(a) * r - 20], extrapolate: 'clamp' }),
    };
  }), []);
  const celebrate = (pts, chs) => {
    const hasCh = !!(chs && chs.length);
    setBp(pts); setBch(chs || []);
    if (settingsRef.current.sound) playSound(hasCh ? 'fanfare' : 'win');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    burst.setValue(0); Animated.timing(burst, { toValue: 1, duration: hasCh ? 2800 : 1800, useNativeDriver: true }).start();
  };
  const onVisited = (kod, pts, chs) => {
    setVisited((v) => new Set(v).add(kod));
    setTaken((t) => (t ? new Set(t).add(kod) : t));
    celebrate(pts === undefined ? 10 : pts, chs);
  };
  const authDone = async (user, token) => {
    if (token) { if (settingsRef.current.sound) playSound('win'); TOKEN = token; await AsyncStorage.setItem('sb_token', token); await loadMe(); toast('Vítej, ' + user.username, 'hand-wave-outline'); } else patchMe(user);
    setAuth(null);
  };
  const logout = async () => { TOKEN = null; await AsyncStorage.multiRemove(['sb_token', 'sb_me']); avClear(); saveQueue([]); setMe(null); setVisited(new Set()); setProfId(null); setSett(false); };
  const deleteAccount = () => Alert.alert('Smazat účet?', 'Trvale se smaže tvůj účet, návštěvy, fotky i lajky. Nelze vrátit zpět.', [{ text: 'Zrušit', style: 'cancel' },
    { text: 'Smazat natrvalo', style: 'destructive', onPress: async () => { try { await api('/me', { method: 'DELETE' }); await logout(); toast('Účet byl smazán', 'account-remove-outline'); } catch (e) { toast(e.message, 'alert-circle-outline'); } } }]);
  const goTab = (t) => { profFrom.current = null; setTab(t); if (t !== 'map') setSel(null); if (t === 'prof') setProfId(me ? me.id : null); };
  const planRoute = async (stops, routeProfile = 'pedestrian') => {
    if (!pos || !stops.length) return;
    const locations = [{ lat: pos.lat, lon: pos.lon }, ...stops.map((x) => ({ lat: x.p[3], lon: x.p[2] }))];
    const fallback = () => {
      const origin = `${pos.lat},${pos.lon}`, destination = `${stops[stops.length - 1].p[3]},${stops[stops.length - 1].p[2]}`;
      const waypoints = stops.slice(0, -1).map((x) => `${x.p[3]},${x.p[2]}`).join('|');
      const travelMode = routeProfile === 'bicycle' ? 'bicycling' : routeProfile === 'auto' ? 'driving' : 'walking';
      const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}&travelmode=${travelMode}`;
      Linking.openURL(url).catch(() => {});
    };
    try {
      const costing_options = routeProfile === 'bicycle' ? { bicycle: { bicycle_type: 'hybrid', use_roads: 0.1, use_hills: 0.2 } } : routeProfile === 'auto' ? { auto: { use_highways: 0.2 } } : { pedestrian: {} };
      const response = await fetch('https://valhalla1.openstreetmap.de/route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locations, costing: routeProfile, costing_options, units: 'kilometers', language: 'cs-CZ' }) });
      if (!response.ok) throw new Error('Trasu se nepodařilo spočítat.');
      const data = await response.json(), summary = data.trip && data.trip.summary;
      if (!summary) throw new Error('Služba nevrátila trasu.');
      const title = routeProfile === 'bicycle' ? 'Cyklistická trasa' : routeProfile === 'auto' ? 'Trasa autem' : 'Pěší trasa';
      Alert.alert(title, `${summary.length.toFixed(1).replace('.', ',')} km · přibližně ${Math.round(summary.time / 60)} min`, [
        { text: 'Otevřít v Mapách', onPress: fallback }, { text: 'Hotovo' },
      ]);
    } catch (e) {
      Alert.alert('Výpočet trasy není dostupný', 'Veřejný Valhalla server může být vytížený. Otevřu zastávky v Mapách.', [{ text: 'Otevřít Mapy', onPress: fallback }, { text: 'Zrušit', style: 'cancel' }]);
    }
  };
  const toggleHeat = async () => {
    if (heatOn) return setHeatOn(false);
    if (!me) return setAuth('login');
    try { const r = await api('/me/heatmap'); setHeatPoints(r.points || []); setHeatOn(true); }
    catch (e) { toast(e.message || 'Tepelnou mapu se nepodařilo načíst.', 'alert-circle-outline'); }
  };
  const openSuggest = (draft) => { if (!me) return setAuth('login'); setSuggesting(draft); };
  const openProfile = useCallback((id) => { profFrom.current = tabRef.current === 'prof' ? profFrom.current : tabRef.current; setSel(null); setProfId(id); setTab('prof'); }, []);
  const applyFlt = (f) => {
    setFlt(f); setFOpen(false);
    if (f.fv !== 'all') loadTaken(true).then((ok) => { if (!ok) toast('Prvonávštěvu nelze ověřit offline – tento filtr se zatím nepoužije', 'wifi-off'); });
  };
  const nF = fCount(flt);

  /* odkazy do aplikace (sdílený strom / profil) – počká na načtení stromů */
  applyRef.current = () => {
    const l = linkRef.current; if (!l) return;
    if (l.type === 'uzivatel') { linkRef.current = null; openProfile(l.id); return; }
    if (byKod[l.id]) {
      linkRef.current = null;
      openTree(l.id);
    }
    else if (ready) { linkRef.current = null; toast('Tento strom se nepodařilo najít', 'tree-outline'); }
  };
  useEffect(() => { applyRef.current(); }, [byKod, ready]);

  const nearIn = near[0] && near[0].d <= RADIUS;
  return (
    <View style={{ flex: 1, backgroundColor: C.cream }}>
      <StatusBar barStyle="dark-content" />
      {/* nativní mapa se na ostatních záložkách úplně odpojí (žádné překryvy ani záblesky a šetří baterii); po návratu se obnoví na stejném místě */}
      {tab === 'map' && <MapBase mapRef={mapRef} cam={cam} src={src} geo={geo} range={range} meF={meF} heatF={heatOn ? heatF : fc([])} onPress={onMapPress} tabh={TABH} rot={settings.rot} ctop={ins.top + 130} initCam={lastCam.current} onIdle={onMapIdle} />}

      {/* horní lišta */}
      {tab === 'map' && (
        <View style={[s.top, { top: ins.top + 8 }]} pointerEvents="box-none">
          <View style={s.search}>
            <Ic n="magnify" s={20} c={C.mute} />
            <TextInput style={{ flex: 1, paddingVertical: 10, color: C.ink, fontWeight: '600' }} placeholder="Hledat strom…" placeholderTextColor={C.mute} value={q} onChangeText={setQ} />
            {!!q && <T onPress={() => setQ('')} hitSlop={8}><Ic n="close" s={18} c={C.mute} /></T>}
          </View>
          {results.length > 0 && <View style={s.drop}>{results.map((p) => (
            <T key={p[0]} style={{ padding: 11 }} onPress={() => openTree(p[0])}><Text style={s.b} numberOfLines={1}>{p[1]}</Text></T>))}</View>}
          <T style={[s.fchip, { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'stretch', backgroundColor: nearIn ? C.moss : C.paper }]} onPress={() => near[0] && openTree(near[0].p[0])}>
            <Ic n={nearIn ? 'check-circle' : 'tree'} s={16} c={nearIn ? '#fff' : C.mute} />
            <Text numberOfLines={1} style={{ flex: 1, fontWeight: '800', fontSize: 12, color: nearIn ? '#fff' : C.mute }}>
              {near[0] ? `${fmtD(near[0].d)} · ${near[0].p[1]}` : 'Hledám polohu…'}</Text>
          </T>
        </View>
      )}
      {tab === 'map' && !sel && (<>
        <Fab bottom={TABH + 14} icon="crosshairs-gps" onPress={() => pos && flyTo({ centerCoordinate: [pos.lon, pos.lat], zoomLevel: 16.5, animationDuration: 600 })} />
        <Fab bottom={TABH + 74} icon={heatOn ? 'fire' : 'fire-circle'} onPress={toggleHeat} />
        <Fab bottom={TABH + 134} icon="download" badge={queue.length} onPress={() => setOff(true)} />
        <Fab bottom={TABH + 194} icon="filter-variant" badge={nF} badgeColor={C.moss} onPress={() => setFOpen(true)} />
        <Fab bottom={TABH + 254} icon="tree-outline" onPress={() => openSuggest({ kind: 'new' })} />
      </>)}

      {/* panely */}
      {tab === 'radar' && <Radar near={near} heading={heading} points={points} top={ins.top} bottom={TABH} visited={visited} onOpen={openTree} onShow={openTree} onRoute={planRoute} />}
      {tab === 'board' && <Board me={me} onProfile={openProfile} top={ins.top} bottom={TABH} />}
      {tab === 'prof' && <Profile id={profId} me={me} top={ins.top} bottom={TABH} toast={toast} onAuth={() => setAuth('login')} onTree={openTree} onProfile={openProfile} onLogout={logout} onEdit={() => setAuth('edit')} onDelete={deleteAccount} onSettings={() => setSett(true)} allSpecies={species.map(([name]) => name).filter((name) => name !== 'Jiný')} points={points} />}
      {tab === 'map' && sel && byKod[sel] && (
        <TreeSheet kod={sel} tree={byKod[sel]} pos={pos} me={me} bottom={TABH} onClose={() => setSel(null)} onAuth={() => setAuth('login')}
          onVisited={onVisited} toast={toast} onProfile={openProfile} queued={queue} onQueue={addQueue} favorites={favorites} onFavorite={toggleFavorite} onSuggest={openSuggest} />
      )}

      {/* spodní lišta */}
      <View style={[s.nav, { height: TABH, paddingBottom: ins.bottom }]}>
        {[['map', 'map-outline', 'map', 'Mapa'], ['radar', 'radar', 'radar', 'Radar'], ['board', 'trophy-outline', 'trophy', 'Žebříček'], ['prof', 'account-circle-outline', 'account-circle', 'Profil']].map(([k, ico, icoOn, l]) => (
          <T key={k} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onPress={() => goTab(k)}>
            <Ic n={tab === k ? icoOn : ico} s={25} c={tab === k ? C.sun : '#b9cdb0'} />
            <Text style={{ fontSize: 11, fontWeight: '800', color: tab === k ? C.sun : '#b9cdb0' }}>{l}</Text>
          </T>))}
      </View>

      {/* oslava */}
      <Animated.View pointerEvents="none" style={[s.burst, { opacity: burst.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] }), transform: [{ scale: burst.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.3, 1.15, 1] }) }] }]}>
        {confetti.map((c, i) => (
          <Animated.View key={i} style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -10, marginTop: -10, transform: [{ translateX: c.x }, { translateY: c.y }] }}><Ic n={c.ic} s={20} c={c.c} /></Animated.View>
        ))}
        <Ic n={bch.length ? 'trophy' : 'tree'} s={bch.length ? 72 : 80} c={bch.length ? C.sun : C.moss} />
        <Text style={{ fontFamily: SERIF, fontSize: 32, fontWeight: '800', color: C.forest }}>{bp > 0 ? `+${bp} bodů` : bp === 0 ? 'Zapsáno' : bch.length ? 'Odesláno' : 'Zapsáno'}</Text>
        {bch.map((c) => (
          <View key={c.id} style={s.burstCh}>
            <Ic n={c.icon} s={20} c={C.forest} />
            <Text style={{ color: C.forest, fontWeight: '800', fontSize: 14, flexShrink: 1 }}>Výzva splněna: {c.name}</Text>
            <Text style={{ color: C.moss, fontWeight: '800', fontSize: 14 }}>+{c.pts} b</Text>
          </View>
        ))}
      </Animated.View>
      {msg && <View style={[s.toast, { top: ins.top + 110 }]} pointerEvents="none">{!!msg.ic && <Ic n={msg.ic} s={18} c="#fff" />}<Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center', flexShrink: 1 }}>{msg.t}</Text></View>}
      {fOpen && <FilterModal init={flt} points={points} visited={visited} taken={taken} species={species} dendro={dendro} loadTaken={loadTaken} onApply={applyFlt} onClose={() => setFOpen(false)} favorites={favorites} />}
      {off && <OfflineModal onClose={() => { setOff(false); }} mapRef={mapRef} pos={pos} meta={meta} queue={queue} settings={settings} onTrees={() => downloadTrees(true, false)} onSync={syncQueue} onSettings={() => { setOff(false); setSett(true); }} toast={toast} msg={msg && msg.t} />}
      {sett && <SettingsModal me={me} settings={settings} onSet={setSetting} onClose={() => setSett(false)} onMe={patchMe} />}
      <Modal visible={mock} animationType="fade" onRequestClose={() => {}} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: C.forest, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Ic n="map-marker-alert-outline" s={84} c={C.sun} />
          <Text style={{ fontFamily: SERIF, fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 12, textAlign: 'center' }}>Falešná poloha</Text>
          <Text style={{ color: '#dfeccf', fontSize: 15, textAlign: 'center', marginTop: 10 }}>Telefon používá simulovanou (mock) polohu. Dokud ji nevypneš, appka zůstane zablokovaná. Při opakovaném použití falešné polohy se ti odečte 1 bod.</Text>
          <Text style={{ color: '#b9cdb0', fontSize: 13, textAlign: 'center', marginTop: 14 }}>Nastavení → Možnosti pro vývojáře → Vybrat aplikaci pro simulaci polohy → Žádná</Text>
          <Btn icon="cog-outline" title="Otevřít možnosti pro vývojáře" style={{ alignSelf: 'stretch', marginTop: 24 }} onPress={() => Linking.sendIntent('android.settings.APPLICATION_DEVELOPMENT_SETTINGS').catch(() => Linking.openSettings())} />
          <Btn ghost icon="crosshairs-gps" title="Zkontrolovat znovu" style={{ alignSelf: 'stretch' }} onPress={recheckLoc} />
        </View>
      </Modal>
      {auth && <Auth mode={auth} me={me} onClose={() => setAuth(null)} onDone={authDone} onMe={patchMe} />}
      {!!suggesting && <SuggestModal draft={suggesting} pos={pos} toast={toast} onClose={() => setSuggesting(null)} />}
    </View>
  );
}
export default function App() { return <SafeAreaProvider><Main /></SafeAreaProvider>; }

/* ============================== styly ============================== */
const s = StyleSheet.create({
  firstB: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fbf0cf', borderRadius: 14, padding: 10, marginTop: 10 },
  firstBt: { color: '#6b4a2f', fontWeight: '800', flex: 1 },
  h2: { fontFamily: SERIF, fontWeight: '800', fontSize: 24, color: C.forest, marginBottom: 6 },
  h3: { fontFamily: SERIF, fontWeight: '800', fontSize: 18, color: C.forest },
  b: { fontWeight: '800', color: C.ink, fontSize: 15 }, sm: { color: C.mute, fontSize: 13, fontWeight: '600' },
  rowi: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  panel: { ...StyleSheet.absoluteFillObject, backgroundColor: C.cream },
  top: { position: 'absolute', left: 10, right: 10, zIndex: 5 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.paper, borderRadius: 99, paddingHorizontal: 16, elevation: 6, shadowColor: C.forest, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  drop: { backgroundColor: C.paper, borderRadius: 16, marginTop: 6, elevation: 6, overflow: 'hidden' },
  fchip: { backgroundColor: C.paper, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8, elevation: 4, justifyContent: 'center' },
  fab: { position: 'absolute', right: 12, width: 50, height: 50, borderRadius: 25, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  fbadge: { position: 'absolute', top: -2, right: -2, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  nav: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', backgroundColor: C.forest, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 6 },
  sheet: { position: 'absolute', left: 0, right: 0, maxHeight: '72%', backgroundColor: C.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, elevation: 12, shadowColor: C.forest, shadowOpacity: 0.3, shadowRadius: 20 },
  x: { position: 'absolute', right: 14, top: 12, zIndex: 3, width: 34, height: 34, borderRadius: 17, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 8, alignItems: 'center' },
  badge: { backgroundColor: C.leaf, color: '#fff', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 2, fontSize: 12, fontWeight: '800', overflow: 'hidden' },
  badgeV: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.leaf, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  badgeVt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#eef6e4', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  factT: { color: C.forest, fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: C.cream, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 14, marginVertical: 12 },
  chip: { backgroundColor: C.paper, borderWidth: 2, borderColor: C.line, borderRadius: 99, paddingHorizontal: 13, paddingVertical: 8 },
  chipOn: { backgroundColor: C.forest, borderColor: C.forest }, chipT: { fontWeight: '800', color: C.ink },
  seg: { flexDirection: 'row', backgroundColor: C.cream, borderRadius: 14, borderWidth: 2, borderColor: C.line, overflow: 'hidden' },
  segi: { flex: 1, paddingVertical: 10, alignItems: 'center' }, segOn: { backgroundColor: C.forest }, segt: { fontWeight: '800', color: C.forest, fontSize: 13 },
  input: { borderWidth: 2, borderColor: C.line, backgroundColor: C.paper, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10, color: C.ink, fontSize: 15, textAlignVertical: 'top' },
  btn: { backgroundColor: C.moss, borderRadius: 16, padding: 14, alignItems: 'center', marginTop: 10 },
  btnGhost: { backgroundColor: C.cream, borderWidth: 2, borderColor: C.line }, btnT: { color: '#fff', fontWeight: '800', fontSize: 16 },
  warn: { backgroundColor: '#f6e3d8', color: '#8a3a22', borderRadius: 14, padding: 10, fontSize: 13, marginTop: 8, overflow: 'hidden' },
  hid: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.cream, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 10, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  ph: { width: '32.4%', aspectRatio: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: C.line },
  lk: { position: 'absolute', right: 4, bottom: 4, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#000a', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  lkT: { color: '#fff', fontWeight: '800', fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 11, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 18, marginTop: 8 },
  rk: { textAlign: 'center', fontFamily: SERIF, fontWeight: '800', fontSize: 18, color: C.bark },
  stat: { flex: 1, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 16, alignItems: 'center', paddingVertical: 10 },
  statN: { fontFamily: SERIF, fontSize: 22, fontWeight: '800', color: C.forest },
  bar: { height: 10, backgroundColor: C.line, borderRadius: 9, overflow: 'hidden', marginTop: 12, marginBottom: 4 },
  bdg: { width: '18.5%', alignItems: 'center', backgroundColor: C.paper, borderRadius: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.line },
  chI: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ece7d2', alignItems: 'center', justifyContent: 'center' },
  chP: { color: C.mute, fontSize: 12, fontWeight: '800' },
  dial: { borderWidth: 6, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginVertical: 14, backgroundColor: C.paper },
  burst: { position: 'absolute', alignSelf: 'center', top: '28%', alignItems: 'center', zIndex: 30, backgroundColor: '#fffdf6f2', borderRadius: 30, paddingVertical: 22, paddingHorizontal: 26, maxWidth: '92%' },
  burstCh: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fbf0cf', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginTop: 8 },
  toast: { position: 'absolute', alignSelf: 'center', maxWidth: '90%', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.forest, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, zIndex: 40 },
  /* kredity */
  cred: { marginTop: 28, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line },
  credH: { fontFamily: SERIF, fontWeight: '800', fontSize: 16, color: C.forest },
  credH2: { color: C.ink, fontWeight: '800', fontSize: 12 },
  credT: { color: C.mute, fontSize: 12, fontWeight: '600' },
  copy: { marginTop: 18, textAlign: 'center', color: C.forest, fontWeight: '800', fontSize: 13 },
  /* kalendář */
  arr: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  wk: { flexDirection: 'row', flexWrap: 'wrap' },
  wd: { width: '14.285%', textAlign: 'center', color: C.mute, fontSize: 11, fontWeight: '800', marginBottom: 2 },
  cd: { width: '14.285%', aspectRatio: 1, padding: 2 },
  cdi: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper },
  cdt: { fontSize: 13, fontWeight: '700', color: C.ink }, cdn: { fontSize: 9, fontWeight: '800', color: '#fff', marginTop: -2 },
  /* statistiky */
  brow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 3 },
  bl: { width: 96, fontSize: 12, fontWeight: '700', color: C.ink },
  bt: { flex: 1, height: 12, backgroundColor: C.line, borderRadius: 6, overflow: 'hidden' },
  bn: { width: 28, textAlign: 'right', fontSize: 12, fontWeight: '800', color: C.forest },
  /* mini mapa */
  mini: { marginTop: 8, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: C.line },
  expand: { position: 'absolute', top: 8, right: 8, width: 34, height: 34, borderRadius: 17, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', elevation: 4 },
});
