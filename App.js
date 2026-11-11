import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text as NativeText, StyleSheet, TouchableOpacity, ScrollView, FlatList, TextInput, Image, Animated, Linking, Share, Appearance,
  Alert, RefreshControl, ActivityIndicator, Platform, StatusBar, Modal, KeyboardAvoidingView, AppState, BackHandler,
  useWindowDimensions, Switch,
} from 'react-native';
import { MaterialCommunityIcons as MCI } from '@expo/vector-icons';
import * as ML from '@maplibre/maplibre-react-native';
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
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIAP } from 'expo-iap';
import mobileAds, { AdsConsent, RewardedAd, RewardedAdEventType, AdEventType } from 'react-native-google-mobile-ads';
import { BlurView } from 'expo-blur';
import * as StromobraniIntegrity from 'stromobrani-integrity';
import Constants from 'expo-constants';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import { requireOptionalNativeModule } from 'expo';

const childLabel = (node) => {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(childLabel).filter(Boolean).join(' ');
  if (React.isValidElement(node)) return childLabel(node.props.children);
  return '';
};
const T = React.forwardRef(function AccessibleTouchable({ children, accessibilityRole, accessibilityLabel, ...props }, ref) {
  const label = accessibilityLabel || childLabel(children).replace(/\s+/g, ' ').trim() || 'Tlačítko';
  return <TouchableOpacity ref={ref} {...props} accessible accessibilityRole={accessibilityRole || 'button'} accessibilityLabel={label}>{children}</TouchableOpacity>;
});

/* ============================== konfigurace ============================== */
const VERSION = '1.8.0';
const API = process.env.EXPO_PUBLIC_API_URL || 'https://stromobrani-9389.rostiapp.cz';
/* mapové podklady: MapRiot Outdoor přes MapLibre Native.
   Klíč se na dlaždice, fonty a ikony (api.mapriot.com) přidává nativně přes TransformRequestManager, styl ho má přímo v URL. */
const MR_KEY = process.env.EXPO_PUBLIC_MAPRIOT_KEY || '';
const STYLE = `https://api.mapriot.com/styles/outdoor.json?apiKey=${MR_KEY}`;
const RADIUS = 25;
try {
  ML.TransformRequestManager.addUrlSearchParam({ id: 'mapriot-key', match: /^https:\/\/api\.mapriot\.com\/(?!styles\/outdoor\.json)/, name: 'apiKey', value: MR_KEY });
} catch (e) {}

/* ============================== mapové vrstvy ============================== */
const OFM = 'https://tiles.openfreemap.org/styles/';
const CUZK = 'https://ags.cuzk.gov.cz/arcgis1/rest/services/';
const CZ_BOUNDS = [11.87, 48.2, 19.14, 51.42];
const REPERFECT_STYLE = 'https://maps.reperfect.it/assets/day-BYH6wugP.json';
const REPERFECT_PMTILES = 'https://maps-data.reperfect.it/maps/tiles-v14-cz.pmtiles';
const REPERFECT_GLYPHS = 'https://maps.reperfect.it/glyphs/{fontstack}/{range}.pbf';
/* výchozí je MapRiot; ostatní vrstvy jsou otevřené a bez klíče (OpenFreeMap, ČÚZK). Atribuce se vždy ukazuje v rohu mapy (AttrChip). */
const MAP_LAYERS = [
  { id: 'mapriot', name: 'Outdoor (MapRiot)', sub: 'Turistická mapa s vrstevnicemi a stezkami', ic: 'terrain', kind: 'vector', url: STYLE,
    attr: '© MapRiot.com © OpenStreetMap contributors', links: [['MapRiot.com', 'https://mapriot.com/copyright'], ['OpenStreetMap', 'https://www.openstreetmap.org/copyright']] },
  { id: 'reperfect', name: 'Reperfect.it Maps', sub: 'Turistická mapa převážně pro ČR · PMTiles', ic: 'map-marker-path', kind: 'pmtiles', url: REPERFECT_STYLE,
    pmtiles: REPERFECT_PMTILES, glyphs: REPERFECT_GLYPHS, attr: 'Reperfect.it Maps · © OpenStreetMap contributors',
    links: [['Reperfect Maps · licence 0BSD, OFL, CC0, MIT', 'https://maps.reperfect.it/licenses/'], ['OpenStreetMap · ODbL 1.0', 'https://www.openstreetmap.org/copyright']] },
  { id: 'liberty', name: 'OpenFreeMap Liberty', sub: 'Přehledná obecná mapa', ic: 'map-outline', kind: 'vector', url: OFM + 'liberty',
    attr: 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap', links: [['OpenFreeMap', 'https://openfreemap.org'], ['OpenStreetMap', 'https://www.openstreetmap.org/copyright']] },
  { id: 'positron', name: 'OpenFreeMap Positron', sub: 'Světlá a klidná, stromy na ní vynikou', ic: 'image-filter-black-white', kind: 'vector', url: OFM + 'positron',
    attr: 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap', links: [['OpenFreeMap', 'https://openfreemap.org'], ['OpenStreetMap', 'https://www.openstreetmap.org/copyright']] },
  { id: 'ortofoto', name: 'Ortofoto ČR', sub: 'Letecké snímky, jen Česko', ic: 'satellite-variant', kind: 'raster', maxzoom: 19, bounds: CZ_BOUNDS,
    tiles: [CUZK + 'ORTOFOTO_WM/MapServer/WMTS/tile/1.0.0/ORTOFOTO_WM/default/GoogleMapsCompatible/{z}/{y}/{x}'],
    attr: '© ČÚZK', links: [['ČÚZK', 'https://geoportal.cuzk.gov.cz']] },
  { id: 'ztm', name: 'Základní mapa ČR', sub: 'Topografická mapa ČÚZK, jen Česko', ic: 'map-search-outline', kind: 'raster', maxzoom: 18, bounds: CZ_BOUNDS,
    tiles: [CUZK + 'ZTM_WM/MapServer/WMTS/tile/1.0.0/ZTM_WM/default/GoogleMapsCompatible/{z}/{y}/{x}'],
    attr: '© ČÚZK', links: [['ČÚZK', 'https://geoportal.cuzk.gov.cz']] },
];
const LAYER_BY_ID = Object.fromEntries(MAP_LAYERS.map((l) => [l.id, l]));

/* vybraná vrstva + stav MapRiot (společné pro hlavní mapu i vložené mapky) */
let MAP_SEL = 'mapriot', MR_DOWN = false, MAP_STATE_READY = false;
const mapSubs = new Set();
const mapSnap = () => ({ sel: MAP_SEL, down: MR_DOWN || !MR_KEY, ready: MAP_STATE_READY });
const notifyMap = () => { const sn = mapSnap(); mapSubs.forEach((fn) => fn(sn)); };
function useMapState() {
  const [st, setSt] = useState(mapSnap);
  useEffect(() => { mapSubs.add(setSt); setSt(mapSnap()); return () => { mapSubs.delete(setSt); }; }, []);
  return st;
}
const LAYER_ERRORS = {};
const resolveLayer = (id, down) => (id === 'mapriot' && down || LAYER_ERRORS[id] ? 'liberty' : (LAYER_BY_ID[id] ? id : 'mapriot'));
function setMapSel(id) { MAP_SEL = id; AsyncStorage.setItem('sb_maplayer', id).catch(() => {}); notifyMap(); }
function setMrDown(v) { if (MR_DOWN !== v) { MR_DOWN = v; notifyMap(); } }
async function initMapState() {
  try { const v = await AsyncStorage.getItem('sb_maplayer'); if (v && LAYER_BY_ID[v]) MAP_SEL = v; } catch (e) {}
  if (MAP_SEL === 'reperfect') {
    const info = await ensureLayerInfo('reperfect');
    if (info.error) { MAP_SEL = 'liberty'; await AsyncStorage.setItem('sb_maplayer', MAP_SEL).catch(() => {}); }
  }
  MAP_STATE_READY = true; notifyMap();
}

/* kontrola MapRiot: jedna dlaždice (1 jednotka). Za problém se bere jen 401/403/429/5xx nebo opakovaná chyba spojení při funkčním internetu. */
async function probeMapRiot() {
  if (!MR_KEY) return 'down';
  const url = `https://api.mapriot.com/planet/6/34/21?apiKey=${MR_KEY}`;
  const once = async () => {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000);
    try { return (await fetch(url, { signal: ctl.signal })).status; } catch (e) { return 0; } finally { clearTimeout(t); }
  };
  let st = await once();
  if (st === 0) {
    let online = true;
    try { const n = await Network.getNetworkStateAsync(); online = !!(n.isConnected && n.isInternetReachable !== false); } catch (e) {}
    if (!online) return 'offline';
    await new Promise((r) => setTimeout(r, 1500));
    st = await once();
  }
  return st === 0 || st === 401 || st === 403 || st === 429 || st >= 500 ? 'down' : 'ok';
}
let mrChecking = null;
function checkMapRiot() {
  if (!mrChecking) mrChecking = probeMapRiot().then((r) => { if (r === 'down') setMrDown(true); else if (r === 'ok') setMrDown(false); return r; }).finally(() => { mrChecking = null; });
  return mrChecking;
}

/* font a glyphy pro vlastní textové vrstvy (čísla v clusterech, popisky): čtou se ze stylu dané vrstvy a pamatují se i pro start bez signálu.
   Po prvním určení se v jednom spuštění nemění: textové vrstvy se do mapy nesmí přidávat až za běhu (padalo to). */
const FONT_EXPR = new Set(['get', 'literal', 'case', 'match', 'step', 'coalesce', 'interpolate', 'let', 'var', 'concat', 'to-string']);
function pickMapFont(style) {
  const cnt = {};
  for (const l of (style && style.layers) || []) {
    let tf = l.layout && l.layout['text-font'];
    if (Array.isArray(tf) && tf[0] === 'literal') tf = tf[1];
    if (!Array.isArray(tf) || !tf.length || FONT_EXPR.has(tf[0]) || !tf.every((x) => typeof x === 'string')) continue;
    const k = JSON.stringify(tf); cnt[k] = (cnt[k] || 0) + 1;
  }
  const keys = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
  const plain = keys.filter((k) => !/italic|oblique/i.test(k));
  const k = plain.find((x) => /bold/i.test(x)) || plain[0] || keys[0];
  return k ? JSON.parse(k) : null;
}
const NOINFO = { font: null, glyphs: null, ready: false };
const LAYER_INFO = {}, INFO_P = {};
const infoSubs = new Set();
const notifyInfo = () => infoSubs.forEach((fn) => fn());
function ensureLayerInfo(id) { return (INFO_P[id] = INFO_P[id] || loadLayerInfo(id)); }
async function loadLayerInfo(id) {
  const L = LAYER_BY_ID[id];
  let font = null, glyphs = null, style = null, error = null;
  const done = () => { LAYER_INFO[id] = { font, glyphs, style, error, ready: true }; if (error) LAYER_ERRORS[id] = error; notifyInfo(); return LAYER_INFO[id]; };
  if (L.kind === 'raster') { const b = await ensureLayerInfo('liberty'); font = b.font; glyphs = b.glyphs; return done(); }   // rastr si půjčí glyphy z Liberty
  try {
    const c = await AsyncStorage.getItem('sb_li_' + id);
    if (c) { const o = JSON.parse(c); font = o.font || null; glyphs = o.glyphs || null; style = o.style || null; if (L.kind !== 'pmtiles' || style) done(); }
  } catch (e) {}
  let fresh = null;
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), L.kind === 'pmtiles' ? 10000 : 4000);
    const r = await fetch(L.url, { signal: ctl.signal }); clearTimeout(t);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (L.kind === 'pmtiles') {
      if (!j || !Array.isArray(j.layers) || !j.sources?.tiles) throw new Error('Neplatný styl mapy.');
      const sources = { tiles: { ...j.sources.tiles, type: 'vector', tiles: [`pmtiles://${L.pmtiles}`], attribution: L.attr } };
      j.layers = j.layers.filter((layer) => !layer.source || layer.source === 'tiles');
      j.sources = sources; j.glyphs = L.glyphs; delete j.sprite;
      fresh = { font: pickMapFont(j), glyphs: j.glyphs, style: j };
    } else fresh = { font: pickMapFont(j), glyphs: typeof j.glyphs === 'string' ? j.glyphs : null };
  } catch (e) { if (L.kind === 'pmtiles' && !LAYER_INFO[id]?.style) error = e.message || 'Styl mapy se nepodařilo načíst.'; }
  if (fresh && (fresh.font || fresh.glyphs || fresh.style)) AsyncStorage.setItem('sb_li_' + id, JSON.stringify(fresh)).catch(() => {});
  if (!LAYER_INFO[id]) { if (fresh) { font = fresh.font; glyphs = fresh.glyphs; style = fresh.style; } done(); }
  return LAYER_INFO[id];
}
function useLayerInfo(id) {
  const [, force] = useState(0);
  useEffect(() => { const fn = () => force((n) => n + 1); infoSubs.add(fn); ensureLayerInfo(id); return () => { infoSubs.delete(fn); }; }, [id]);
  return LAYER_INFO[id] || NOINFO;
}
const RASTER_STYLES = {};
function styleFor(L, info) {
  if (L.kind === 'pmtiles') return info.style || LAYER_BY_ID.liberty.url;
  if (L.kind !== 'raster') return L.url;
  const k = L.id + '|' + (info.glyphs || '');
  return (RASTER_STYLES[k] = RASTER_STYLES[k] || {
    version: 8, ...(info.glyphs ? { glyphs: info.glyphs } : {}),
    sources: { base: { type: 'raster', tiles: L.tiles, tileSize: 256, maxzoom: L.maxzoom, bounds: L.bounds } },
    layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e7e3d3' } }, { id: 'base', type: 'raster', source: 'base' }],
  });
}
setTimeout(() => { initMapState(); ensureLayerInfo('mapriot'); }, 0);

/* atribuce je pořád vidět v rohu mapy; klepnutí otevře odkazy na autory podkladů */
const AttrChip = React.memo(function AttrChip({ layer, style, small }) {
  const L = LAYER_BY_ID[layer] || LAYER_BY_ID.mapriot;
  const open = () => Alert.alert('Mapové podklady', L.attr, [
    ...L.links.map(([t, u]) => ({ text: t, onPress: () => Linking.openURL(u).catch(() => {}) })),
    { text: 'Zavřít', style: 'cancel' },
  ]);
  return (
    <T activeOpacity={0.8} onPress={open} style={[{ position: 'absolute', backgroundColor: '#fffdf6e6', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, maxWidth: '88%' }, style]}>
      <NativeText numberOfLines={1} style={{ fontSize: small ? 9 : 10, color: '#3a4a36' }}>{L.attr}</NativeText>
    </T>
  );
});

/* vložená mapka: používá základní vrstvu (MapRiot, při výpadku OpenFreeMap), případně vrstvu zadanou přes layerId */
function MiniMap({ layerId, children, ...rest }) {
  const st = useMapState();
  const id = layerId || resolveLayer('mapriot', st.down);
  const info = useLayerInfo(id);
  const shownId = info.error ? 'liberty' : id;
  const style = useMemo(() => styleFor(LAYER_BY_ID[id], info), [id, info]);
  if (!info.ready) return <View style={{ flex: 1, backgroundColor: C.cream }} />;
  return (
    <View style={{ flex: 1 }}>
      <ML.Map key={shownId} style={{ flex: 1 }} mapStyle={style} {...EMBED} {...rest}>{typeof children === 'function' ? children(info) : children}</ML.Map>
      <AttrChip layer={shownId} small style={{ left: 6, bottom: 6 }} />
    </View>
  );
}

/* výběr mapové vrstvy */
function MapLayersModal({ sel, down, onPick, onClose }) {
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#1f3d2bcc', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 30 }}>
          <View style={s.rowi}><Ic n="layers-outline" s={28} c={C.forest} /><Text style={s.h2}>Mapové vrstvy</Text></View>
          {down && <Text style={[s.warn, { marginBottom: 8 }]}>MapRiot teď není dostupný, mapa používá OpenFreeMap.</Text>}
          {MAP_LAYERS.map((L) => {
            const on = L.id === sel, bad = L.id === 'mapriot' && down;
            return (
              <T key={L.id} style={[s.row, on && { borderColor: C.moss, borderWidth: 2 }]} onPress={() => onPick(L.id)}>
                <Ic n={L.ic} s={24} c={on ? C.moss : C.mute} />
                <View style={{ flex: 1 }}><Text style={s.b}>{L.name}{L.id === 'mapriot' ? ' · výchozí' : ''}</Text><Text style={s.sm}>{bad ? 'Nedostupná, po klepnutí to zkusím znovu' : L.sub}</Text></View>
                {on && <Ic n="check-circle" s={22} c={C.moss} />}
              </T>
            );
          })}
          <Text style={[s.sm, { marginTop: 8 }]}>Autory podkladů najdeš vždy v rohu mapy, po klepnutí se zobrazí odkazy.</Text>
          <Btn title="Hotovo" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const C = { forest: '#1f3d2b', moss: '#4f7a3a', leaf: '#7fb069', sun: '#e9b44c', bark: '#6b4a2f', cream: '#f7f2e4', paper: '#fffdf6', ink: '#23301f', mute: '#7a8570', line: '#e3dcc3', red: '#c8553d' };
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif' });
let APP_LANG = 'cs';
const I18N = {
  en: { Komunita: 'Community', Mapa: 'Map', Radar: 'Radar', Žebříček: 'Leaderboard', Profil: 'Profile', 'Filtr stromů': 'Tree filters', 'Stav návštěvy': 'Visit status', Vše: 'All', Nenavštívené: 'Not visited', Navštívené: 'Visited', 'Přihlášení': 'Sign in', 'Odhlásit': 'Sign out', 'Nastavení': 'Settings', 'Hotovo': 'Done', 'Upozornění': 'Notifications', 'Večerní připomenutí': 'Daily reminder', 'Přidat mezi oblíbené': 'Add to favorites', 'Odebrat z oblíbených': 'Remove from favorites', 'Jen oblíbené': 'Favorites only', 'Naplánovat pěší trasu přes okolní stromy': 'Plan a walking route', 'Navigovat': 'Navigate', 'Navigovat pěšky': 'Walk to tree', 'Počítám pěší trasu…': 'Calculating walking route…', 'Navigovat v Mapách': 'Navigate in Maps', 'Vypočítat trasu': 'Calculate route', 'Profil trasy': 'Route profile', 'Pěšky': 'Walk', 'Cyklo': 'Bike', 'Auto': 'Car', 'Nejkratší vzdálenost': 'Shortest distance', 'Bezbariérová': 'Wheelchair accessible', 'Typ kola': 'Bicycle type', 'Trekové': 'Hybrid', 'Silniční': 'Road', 'Horské': 'Mountain', 'Profil jízdy': 'Riding preference', 'Cyklostezky a mírné kopce': 'Bike paths and gentle hills', 'Silnice': 'Roads', 'Kopce nevadí': 'Hills are fine', 'Upřednostnit dálnice': 'Prefer highways', 'Cyklistická trasa': 'Cycling route', 'Trasa autem': 'Driving route', 'Naplánovat trasu přes okolní stromy': 'Plan a route through nearby trees', 'Zobrazit na mapě': 'Show on map', 'Skrýt mapu': 'Hide map', 'Exportovat GPX': 'Export GPX', 'vzdálenost': 'distance', 'Pokyny': 'Directions', 'Klepnutím otevřeš fotku; v náhledu můžeš přejíždět mezi soutěžními snímky.': 'Tap a photo to open it, then swipe between contest entries.', 'Sdílet odkaz': 'Share link', 'Sdílet kartu': 'Share tree card', 'Fotosoutěž': 'Photo contest', 'Sbírka druhů': 'Species collection', 'Exportovat historii do CSV': 'Export history to CSV', 'Navrhnout opravu údajů': 'Suggest a correction', 'Navrhnout strom': 'Suggest a tree', 'Odeslat ke kontrole': 'Submit for review', 'Přidat přítele': 'Add friend', 'Odebrat přítele': 'Remove friend', 'Přijmout žádost': 'Accept request', 'Okresní a týmové výzvy': 'District and team challenges', 'Přidat se': 'Join', Stromy: 'Trees', Fotky: 'Photos', Výzvy: 'Challenges', Odznaky: 'Badges', 'Kalendář návštěv': 'Visit calendar', 'Historie odkliků': 'Visit history', 'Pěší trasa': 'Walking route', 'Tepelná mapa': 'Visit heatmap', 'Zobrazit detail': 'View details', 'Odkliknout strom': 'Check in', 'První odklik stromu': 'First tree visit', 'Otevřít Mapy': 'Open Maps', 'Načítám…': 'Loading…', 'Hledám polohu…': 'Finding location…', 'Přidat fotku': 'Add photo', 'Vytvořit výzvu': 'Create challenge' },
  sk: { Komunita: 'Komunita', Mapa: 'Mapa', Radar: 'Radar', Žebříček: 'Rebríček', Profil: 'Profil', 'Filtr stromů': 'Filter stromov', 'Stav návštěvy': 'Stav návštevy', Vše: 'Všetko', Nenavštívené: 'Nenavštívené', Navštívené: 'Navštívené', 'Přihlášení': 'Prihlásenie', 'Odhlásit': 'Odhlásiť', 'Nastavení': 'Nastavenia', 'Hotovo': 'Hotovo', 'Upozornění': 'Upozornenia', 'Večerní připomenutí': 'Večerná pripomienka', 'Přidat mezi oblíbené': 'Pridať medzi obľúbené', 'Odebrat z oblíbených': 'Odobrať z obľúbených', 'Jen oblíbené': 'Iba obľúbené', 'Naplánovat pěší trasu přes okolní stromy': 'Naplánovať pešiu trasu', 'Navigovat': 'Navigovať', 'Navigovat pěšky': 'Navigovať pešo', 'Počítám pěší trasu…': 'Počítam pešiu trasu…', 'Navigovat v Mapách': 'Navigovať v Mapách', 'Vypočítat trasu': 'Vypočítať trasu', 'Profil trasy': 'Profil trasy', 'Pěšky': 'Pešo', 'Cyklo': 'Bicykel', 'Auto': 'Auto', 'Nejkratší vzdálenost': 'Najkratšia vzdialenosť', 'Bezbariérová': 'Bezbariérová', 'Typ kola': 'Typ bicykla', 'Trekové': 'Trekový', 'Silniční': 'Cestný', 'Horské': 'Horský', 'Profil jízdy': 'Profil jazdy', 'Cyklostezky a mírné kopce': 'Cyklotrasy a mierne kopce', 'Silnice': 'Cesty', 'Kopce nevadí': 'Kopce neprekážajú', 'Upřednostnit dálnice': 'Uprednostniť diaľnice', 'Cyklistická trasa': 'Cyklotrasa', 'Trasa autem': 'Trasa autom', 'Naplánovat trasu přes okolní stromy': 'Naplánovať trasu cez okolité stromy', 'Zobrazit na mapě': 'Zobraziť na mape', 'Skrýt mapu': 'Skryť mapu', 'Exportovat GPX': 'Exportovať GPX', 'vzdálenost': 'vzdialenosť', 'Pokyny': 'Pokyny', 'Klepnutím otevřeš fotku; v náhledu můžeš přejíždět mezi soutěžními snímky.': 'Ťuknutím otvoríš fotku, potom môžeš prechádzať súťažné snímky.', 'Sdílet odkaz': 'Zdieľať odkaz', 'Sdílet kartu': 'Zdieľať kartu stromu', 'Fotosoutěž': 'Fotosúťaž', 'Sbírka druhů': 'Zbierka druhov', 'Exportovat historii do CSV': 'Exportovať históriu do CSV', 'Navrhnout opravu údajů': 'Navrhnúť opravu údajov', 'Navrhnout strom': 'Navrhnúť strom', 'Odeslat ke kontrole': 'Odoslať na kontrolu', 'Přidat přítele': 'Pridať priateľa', 'Odebrat přítele': 'Odobrať priateľa', 'Přijmout žádost': 'Prijať žiadosť', 'Okresní a týmové výzvy': 'Okresné a tímové výzvy', 'Přidat se': 'Pridať sa', Stromy: 'Stromy', Fotky: 'Fotky', Výzvy: 'Výzvy', Odznaky: 'Odznaky', 'Kalendář návštěv': 'Kalendár návštev', 'Historie odkliků': 'História návštev', 'Pěší trasa': 'Pešia trasa', 'Tepelná mapa': 'Tepelná mapa návštev', 'Zobrazit detail': 'Zobraziť detail', 'Odkliknout strom': 'Zaznamenať návštevu', 'Otevřít Mapy': 'Otvoriť Mapy', 'Načítám…': 'Načítavam…', 'Hledám polohu…': 'Hľadám polohu…', 'Přidat fotku': 'Pridať fotku' }
};
function Text({ children, ...props }) {
  if (APP_LANG === 'cs') return <NativeText allowFontScaling {...props}>{children}</NativeText>;   // rychlá cesta: bez překladu se děti vůbec neprocházejí
  const dict = I18N[APP_LANG] || {};
  const translated = React.Children.map(children, (child) => typeof child === 'string' ? (dict[child] || child) : child);
  return <NativeText allowFontScaling {...props}>{translated}</NativeText>;
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
/* země a zdroj dat stromu se určují z čísla KOD (bez zásahu do serveru):
   CZ = do 9 000 000, SK = 9 000 000–199 999 999, od 200 000 000 bloky po 10 milionech (viz KOD_BLOCKS).
   Další zahraniční sady stačí doplnit do KOD_BLOCKS: [počátek bloku, země, zdroj dat] */
const KOD_BLOCKS = [
  [200000000, 'IT', 'Regione Siciliana · Elenco degli alberi monumentali d’Italia (MASAF)'],
  [210000000, 'IT', 'Comune di Milano · Alberi monumentali'],
  [220000000, 'GB', 'Devon Biodiversity Records Centre, National Trust, Plymouth City Council'],
  [230000000, 'IT', 'Regione Emilia-Romagna · Elenco degli alberi monumentali d’Italia (MASAF)'],
  [240000000, 'AT', 'Rakousko · datová sada památných stromů'],
  [250000000, 'DE', 'Německo · datová sada památných stromů'],
  [260000000, 'PL', 'Polsko · datová sada památných stromů'],
];
const COUNTRIES = [['CZ', 'Česko'], ['SK', 'Slovensko'], ['IT', 'Itálie'], ['GB', 'Británie'], ['AT', 'Rakousko'], ['DE', 'Německo'], ['PL', 'Polsko']];
const kodBlock = (kod) => { const k = Number(kod); if (!(k >= 200000000)) return null; const st = Math.floor(k / 10000000) * 10000000; return KOD_BLOCKS.find((b) => b[0] === st) || null; };
const treeCountry = (kod, zeme) => { if (COUNTRIES.some(([k]) => k === String(zeme || '').toUpperCase())) return String(zeme).toUpperCase(); const k = Number(kod); if (!(k >= 9000000)) return 'CZ'; if (k < 200000000) return 'SK'; const b = kodBlock(k); return b ? b[1] : 'XX'; };
const treeSource = (kod, zeme) => { const c = treeCountry(kod, zeme); if (c === 'CZ') return null; if (c === 'SK') return 'Štátna ochrana prírody SR'; const b = kodBlock(kod); return b ? b[2] : ({ AT: 'Rakousko', DE: 'Německo', PL: 'Polsko' }[c] || null); };

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
const DEF_SET = { upd: 'wifi', sound: true, rot: true, dailyReminder: false, reminderHour: 10, reminderMin: 0, todNotif: false, todHour: 8, todMin: 0, streakNotif: false, streakHour: 19, streakMin: 0, nearbyNotif: false, bgNearby: false, nearbyRadius: 150, quietMode: false, quietStart: 22, quietEnd: 7, darkMode: false, familyMode: false, language: 'cs' };
const isQuietNow = (st, date = new Date()) => {
  if (!st?.quietMode) return false;
  const h = date.getHours(), a = Number(st.quietStart ?? 22), b = Number(st.quietEnd ?? 7);
  return a === b || (a < b ? h >= a && h < b : h >= a || h < b);
};

/* filtr mapy */
const F0 = { st: 'all', fv: 'all', pt: 'all', co: 'all', sp: [], ob: 0, vy: 0, sa: 0, fav: false };
const OB_P = [[0, 'Libovolný'], [300, 'od 3 m'], [500, 'od 5 m'], [700, 'od 7 m'], [1000, 'od 10 m']];
const VY_P = [[0, 'Libovolná'], [20, 'od 20 m'], [30, 'od 30 m'], [40, 'od 40 m']];
const SA_P = [[0, 'Libovolné'], [100, 'od 100 let'], [200, 'od 200 let'], [300, 'od 300 let'], [500, 'od 500 let'], [1000, 'od 1000 let']];
const fCount = (f) => (f.st !== 'all') + (f.fv !== 'all') + (f.pt !== 'all') + ((f.co || 'all') !== 'all') + (f.sp.length > 0) + (f.ob > 0) + (f.vy > 0) + (f.sa > 0) + !!f.fav;
/* p = [kod, název, lon, lat, druh, počet, obvod cm, výška m, stáří let, patronský 0/1, kód země] (0 = neznámé) */
function applyFilter(points, f, visited, taken, favorites = [], isPlus = true) {
    if (!fCount(f) && f.fv === 'all') return points;
  const sp = f.sp.length ? new Set(f.sp) : null;
  const useTaken = f.fv !== 'all' && taken;
  return points.filter((p) => {
    const v = visited.has(p[0]);
    if (f.fav && !favorites.includes(p[0])) return false;
    if (f.pt === 'patron' && !p[9]) return false;
    if (f.pt === 'plain' && p[9]) return false;
    if (f.co && f.co !== 'all' && treeCountry(p[0], p[10]) !== f.co) return false;
    if (f.st === 'new' && v) return false;
    if (f.st === 'done' && !v) return false;
    if (isPlus && sp && !sp.has(p[4] || 'Jiný')) return false;
    if (isPlus && f.ob && !((p[6] || 0) >= f.ob)) return false;
    if (isPlus && f.vy && !((p[7] || 0) >= f.vy)) return false;
    if (isPlus && f.sa && !((p[8] || 0) >= f.sa)) return false;
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
const DEF_CAM = { center: [15.4, 49.8], zoom: 6.3 };
const HIT = { top: 14, right: 14, bottom: 14, left: 14 };
const F_CL = ['has', 'point_count'];
const F_PT = ['!', ['has', 'point_count']];
const F_OK = ['all', ['!', ['has', 'point_count']], ['==', ['get', 'v'], 1]];
const P_RANGE_F = { 'fill-color': '#7fb069', 'fill-opacity': 0.25 };
const P_RANGE_L = { 'line-color': '#4f7a3a', 'line-width': 2, 'line-dasharray': [2, 2] };
const P_CL = { 'circle-color': ['interpolate', ['linear'], ['get', 'point_count'], 10, '#7fb069', 100, '#4f7a3a', 500, '#1f3d2b'], 'circle-radius': ['step', ['get', 'point_count'], 16, 20, 21, 100, 27], 'circle-stroke-width': 3, 'circle-stroke-color': '#fffdf6' };
const L_CLN = (font) => ({ 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13, 'text-allow-overlap': true, ...(font ? { 'text-font': font } : {}) });
const P_CLN = { 'text-color': '#ffffff' };
const P_HEAT = { 'heatmap-weight': ['interpolate', ['linear'], ['get', 'intensity'], 0, 0, 1, 1], 'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 5, 0.7, 14, 2.2], 'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 5, 14, 14, 34], 'heatmap-opacity': 0.78, 'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(127,176,105,0)', 0.2, '#7fb069', 0.45, '#e9b44c', 0.7, '#c8553d'] };
const P_PTH = { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 7, 16, 16], 'circle-color': '#fffdf6' };
const P_PT = { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 5, 16, 12], 'circle-color': ['case', ['==', ['get', 'v'], 1], '#e9b44c', '#4f7a3a'], 'circle-stroke-width': 2, 'circle-stroke-color': ['case', ['==', ['get', 'v'], 1], '#a8741a', '#1f3d2b'] };
/* ✓ u navštívených stromů je obrázek (assets/map-check.png), ne znak: glyph ✓ ve fontech MapRiot nemusí být */
const L_OK = { 'icon-image': 'check', 'icon-size': 0.5, 'icon-allow-overlap': true, 'icon-ignore-placement': true };
const MAP_IMAGES = { check: require('./assets/map-check.png') };
const P_MEH = { 'circle-radius': 13, 'circle-color': '#2f80ed', 'circle-opacity': 0.25 };
const P_MED = { 'circle-radius': 7, 'circle-color': '#2f80ed', 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' };
const P_M_TREE = { 'circle-radius': 10, 'circle-color': '#1f3d2b', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' };
const P_M_ALL = { 'circle-radius': 4, 'circle-color': '#7fb069', 'circle-opacity': 0.75, 'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff' };
const P_M_MINE = { 'circle-radius': 7, 'circle-color': '#e9b44c', 'circle-stroke-width': 2.5, 'circle-stroke-color': '#a8741a' };
/* vložené mapky (trasa, výlet, odkliky, výběr polohy) */
const L_ROUND = { 'line-cap': 'round', 'line-join': 'round' };
const P_ROUTE = { 'line-color': C.moss, 'line-width': 5 };
const P_ENDS = { 'circle-radius': 7, 'circle-color': ['case', ['==', ['get', 'e'], 1], '#1f3d2b', '#2f80ed'], 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' };
const P_STOP = { 'circle-radius': 12, 'circle-color': C.sun, 'circle-stroke-width': 2, 'circle-stroke-color': C.forest };
const L_STOP_T = (font) => ({ 'text-field': ['get', 'n'], 'text-size': 13, 'text-allow-overlap': true, 'text-ignore-placement': true, ...(font ? { 'text-font': font } : {}) });
const P_STOP_T = { 'text-color': '#2a1d00' };
const P_PATRON_H = { 'circle-radius': 16, 'circle-color': C.sun, 'circle-opacity': 0.3 };
const P_PATRON = { 'circle-radius': 9, 'circle-color': C.sun, 'circle-stroke-width': 3, 'circle-stroke-color': '#fff' };
const EMPTY_FC = { type: 'FeatureCollection', features: [] };
const PAD = (n) => ({ top: n, right: n, bottom: n, left: n });
/* společné nastavení vložených map: textura na Androidu = správné ořezání zaoblených rohů a plynulé skrolování v ScrollView */
const EMBED = { androidView: 'texture', touchRotate: false, touchPitch: false, compass: false, scaleBar: false, logo: false, attribution: false };
const SUBSCRIPTION_PRODUCTS = ['stromobrani_plus_monthly', 'stromobrani_plus_yearly', 'stromobrani_extra_monthly', 'stromobrani_extra_yearly'];
const PLUS_PRODUCTS = SUBSCRIPTION_PRODUCTS;
const REWARDED_AD_UNIT = 'ca-app-pub-2764641499857589/3336435652';
const INAPP_PRODUCTS = ['stromobrani_patron_tree_50','stromobrani_patron_tree_29','stromobrani_profile_change_19','stromobrani_profile_change_14','stromobrani_avatar_gif_29','stromobrani_avatar_gif_19','stromobrani_gift_plus_yearly','stromobrani_gift_extra_yearly'];
const INTEGRITY_PROJECT_NUMBER = Number(Constants.expoConfig?.extra?.playIntegrityCloudProjectNumber || 0);
const trialOffer = (product) => product?.subscriptionOffers?.find((offer) => {
  const phases = offer.pricingPhasesAndroid?.pricingPhaseList || [];
  return offer.offerTokenAndroid && phases.some((phase) => Number(phase.priceAmountMicros) === 0 && phase.billingPeriod === 'P1W');
});
const subscriptionPrice = (product) => {
  const phases = trialOffer(product)?.pricingPhasesAndroid?.pricingPhaseList || [];
  const regular = [...phases].reverse().find((phase) => Number(phase.priceAmountMicros) > 0);
  const extra = product?.id?.includes('_extra_');
  return regular?.formattedPrice || product?.displayPrice || (extra ? (product?.id?.endsWith('yearly') ? '365 Kč' : '89 Kč') : (product?.id?.endsWith('yearly') ? '199 Kč' : '49 Kč'));
};
const subscriptionPriceWithPeriod = (product) => `${subscriptionPrice(product)} / ${product?.id?.endsWith('yearly') ? 'rok' : 'měsíc'}`;
async function getIntegrityPayload(productId) {
  if (!INTEGRITY_PROJECT_NUMBER) throw new Error('Play Integrity nemá nastavené Google Cloud Project number.');
  const challenge = await api('/me/integrity/challenge', { json: { productId } });
  await StromobraniIntegrity.prepare(INTEGRITY_PROJECT_NUMBER);
  const integrityToken = await StromobraniIntegrity.requestToken(challenge.requestHash);
  return { integrityChallengeId: challenge.challengeId, integrityToken };
}

function PlusLock({ title, detail, onPress, compact = false }) {
  return <View style={[s.plusLock, compact && { padding: 12 }]}>
    <BlurView intensity={22} tint="light" style={s.plusBlur}><Text style={s.b}>🌳  ✦  🌿  ✦  🌳</Text><Text style={s.sm}>Prémiové funkce Stromobraní</Text></BlurView>
    <View style={s.plusOverlay}>
      <View style={s.plusPill}><Ic n="crown" s={16} c="#fff" /><Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>STROMOBRANÍ PLUS</Text></View>
      <Text style={[s.b, { textAlign: 'center', marginTop: 8 }]}>{title}</Text>
      {!!detail && <Text style={[s.sm, { textAlign: 'center', marginTop: 3 }]}>{detail}</Text>}
      <T onPress={onPress} style={s.plusCta}><Text style={{ color: '#fff', fontWeight: '900', textAlign: 'center' }}>Prohlédnout tarify · od 49 Kč/měsíc</Text></T>
    </View>
  </View>;
}

function PlusModal({ visible, onClose, products, loading, error, onBuy, onRestore, plus, tier = 'free' }) {
  const plans = [
    { tier: 'plus', title: 'Stromobraní Plus', icon: 'crown-circle', copy: 'Každá výprava přinese víc. Odemkni hlubší přehled, přátelský žebříček a dvojnásobné body za výzvy.', products: ['stromobrani_plus_monthly', 'stromobrani_plus_yearly'], perks: ['Sbírka druhů a procenta v profilech hráčů', 'Přátelský žebříček a osobní tepelná mapa', 'Offline mapy, pokročilé filtry a plánování tras', 'Dvojnásobné body za splněné výzvy'] },
    { tier: 'extra', title: 'Stromobraní EXTRA', icon: 'star-circle', copy: 'Pro ty, kdo chtějí být u všeho. Více prostoru pro vlastní výzvy, patronství stromů a profil bez limitů.', products: ['stromobrani_extra_monthly', 'stromobrani_extra_yearly'], perks: ['Všechny výhody Plus', 'Až 3 vlastní okresní výzvy současně', 'Dvě vlastní patronství stromů zdarma každý rok', 'Změny profilu bez limitu a animovaná GIF profilovka', 'Roční tarif vychází přibližně na 1 Kč denně'] },
  ];
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
    <View style={{ flex: 1, backgroundColor: '#102519bb', justifyContent: 'flex-end' }}>
      <ScrollView style={{ maxHeight: '92%', backgroundColor: C.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28 }} contentContainerStyle={{ padding: 22, paddingBottom: 34 }}>
        {plans.map((plan) => {
          const active = plan.tier === tier || (plan.tier === 'plus' && tier === 'extra');
          const available = plan.products.map((id) => products.find((p) => p.id === id)).filter(Boolean);
          return <View key={plan.tier} style={[s.card, { marginTop: 12, backgroundColor: plan.tier === 'extra' ? '#f5eddb' : '#eaf2df', borderColor: plan.tier === 'extra' ? C.sun : C.leaf }]}>
            <View style={{ alignItems: 'center' }}><Ic n={plan.icon} s={42} c={plan.tier === 'extra' ? C.sun : C.moss} /><Text style={[s.h2, { fontSize: 24, marginTop: 4, textAlign: 'center' }]}>{plan.title}</Text><Text style={[s.sm, { textAlign: 'center', marginTop: 3 }]}>{plan.copy}</Text></View>
            {plan.perks.map((x) => <View key={x} style={[s.rowi, { marginTop: 7 }]}><Ic n="check-circle" s={18} c={C.moss}/><Text style={[s.sm,{flex:1,color:C.ink}]}>{x}</Text></View>)}
            {active && <Text style={[s.b,{textAlign:'center',marginTop:10,color:C.moss}]}>{tier === 'extra' ? 'EXTRA je aktivní. Děkujeme, že pomáháš růst Stromobraní! 🌱' : 'Plus je aktivní. Děkujeme za podporu! 🌱'}</Text>}
            {available.map((p) => {
              const offer = trialOffer(p); const hasTrial = Boolean(offer); const yearly = p.id.endsWith('yearly');
              return <View key={p.id} style={{ marginTop: 8 }}><Btn icon={yearly?'calendar-star':'calendar-month'} title={`${plan.tier === 'extra' ? 'EXTRA' : 'Plus'} · ${yearly?'ročně':'měsíčně'} · ${subscriptionPriceWithPeriod(p)}${hasTrial ? ' · 7 dní zdarma' : ''}`} disabled={loading || active} onPress={() => onBuy(p, offer)} /></View>;
            })}
            {!available.length && <Text style={[s.sm,{textAlign:'center',marginTop:8}]}>{loading?'Načítám nabídku Google Play…':'Tarif bude dostupný po zveřejnění nabídky v Google Play.'}</Text>}
          </View>;
        })}
        {!!error && <Text style={[s.warn,{textAlign:'center'}]}>{error}</Text>}
        <Text style={[s.sm,{textAlign:'center',marginTop:10}]}>Předplatné se automaticky obnovuje, dokud ho nezrušíš v Google Play. Spravuješ ho v Obchod Play → Platby a předplatná.</Text>
        <Btn ghost icon="restore" title="Obnovit nákupy" onPress={onRestore} />
        <Btn ghost title="Zavřít" onPress={onClose} />
      </ScrollView>
    </View>
  </Modal>;
}

function GiftModal({visible,onClose,onBuy}) {
  const [q,setQ]=useState(''),[hits,setHits]=useState([]),[recipient,setRecipient]=useState(null),[tier,setTier]=useState('plus'),[style,setStyle]=useState('winter'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{const query=q.trim();if(query.length<2){setHits([]);return;}let dead=false;const t=setTimeout(()=>api('/users?q='+encodeURIComponent(query)).then((r)=>!dead&&setHits(r||[])).catch(()=>!dead&&setHits([])),250);return()=>{dead=true;clearTimeout(t);};},[q]);
  const begin=async()=>{if(!recipient)return Alert.alert('Vyber příjemce','Začni psát uživatelské jméno a vyber účet.');setBusy(true);try{const d=await api('/me/gift-drafts',{json:{tier,recipientId:recipient.id,style,message}});await onBuy(d.productId,{giftDraftId:d.id});onClose();}catch(e){Alert.alert('Dárek se nepodařilo koupit',e.message);}finally{setBusy(false);}};
  const styles=[['winter','🎄 Zimní přání'],['forest','🌲 Lesní'],['gold','✨ Zlaté']];
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1,backgroundColor:'#102519bb',justifyContent:'flex-end'}}><ScrollView style={{maxHeight:'94%',backgroundColor:C.paper,borderTopLeftRadius:24,borderTopRightRadius:24}} contentContainerStyle={{padding:20,paddingBottom:32}} keyboardShouldPersistTaps="handled"><Text style={s.h2}>Věnuj někomu rok plný výprav</Text><Text style={[s.sm,{marginTop:4}]}>Překvap kamaráda předplatným Stromobraní a přidej osobní přání. Dárek se aktivuje po otevření aplikace.</Text>
    <TextInput style={[s.input,{marginTop:12}]} placeholder="Najít uživatele…" value={q} onChangeText={(v)=>{setQ(v);setRecipient(null);}}/><View style={{gap:6,marginTop:5}}>{hits.slice(0,5).map((h)=><T key={h.id} onPress={()=>{setRecipient(h);setQ(h.username);setHits([]);}} style={[s.row,recipient?.id===h.id&&{borderColor:C.moss}]}><Av a={h.avatar} photo={h.photo} size={34}/><Text style={s.b}>{h.username}</Text></T>)}</View>
    <Text style={[CC_LABEL,{marginTop:12}]}>Roční dárek</Text><Seg v={tier} onChange={setTier} opts={[["plus","Plus · 250 Kč"],["extra","EXTRA · 400 Kč"]]}/><Text style={[CC_LABEL,{marginTop:12}]}>Styl přání</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{styles.map(([key,label])=><T key={key} onPress={()=>setStyle(key)} style={[s.chip,style===key&&s.chipOn]}><Text style={[s.chipT,style===key&&{color:'#fff'}]}>{label}</Text></T>)}</View>
    <View style={[s.card,{marginTop:8,backgroundColor:style==='gold'?'#fbf0cf':style==='forest'?'#eaf2df':'#eff4e8'}]}><Text style={s.h3}>{style==='winter'?'Veselé Vánoce! 🌟':style==='forest'?'Pozdrav z lesa 🌿':'Malý dárek, velká výprava ✨'}</Text><Text style={[s.sm,{marginTop:4}]}>Ahoj {recipient?.username||'kamaráde'}, čeká tě rok objevování se Stromobraním. Ať ti každá cesta přinese radost!{message?`\n\n${message}`:''}</Text></View><TextInput style={[s.input,{height:88,marginTop:8}]} multiline maxLength={300} value={message} onChangeText={setMessage} placeholder="Tvůj osobní vzkaz (nepovinné)"/>
    <Btn title={busy?'Otevírám Google Play…':`Koupit dárek · ${tier==='plus'?'250':'400'} Kč`} disabled={busy} onPress={begin}/><Btn ghost title="Zavřít" onPress={onClose}/></ScrollView></KeyboardAvoidingView></Modal>;
}

/* ============================== pomocné funkce ============================== */
let TOKEN = null;
async function api(path, { method, json, form, _retried } = {}) {
  const h = {};
  if (TOKEN) h.Authorization = 'Bearer ' + TOKEN;
  let body;
  if (json) { h['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  const r = await fetch(API + '/api' + path, { method: method || (body ? 'POST' : 'GET'), headers: h, body });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (d.reason === 'integrity_required' && !_retried && Platform.OS === 'android') { await verifyAppIntegrity(); return api(path, { method, json, form, _retried: true }); }
    throw Object.assign(new Error(d.error || 'Něco se pokazilo'), { code: r.status, reason: d.reason });
  }
  return d;
}
/* kontrola instalace a zařízení (Play Integrity): po spuštění a když ji server vyžádá; negativní verdikt zablokuje appku */
let integrityBlockHandler = null, integrityPromise = null;
function verifyAppIntegrity(force = true) {
  if (Platform.OS !== 'android' || !TOKEN) return Promise.resolve();
  if (!integrityPromise) integrityPromise = (async () => {
    try {
      /* po úspěchu se na 12 h nevolá znovu (šetří kvótu Google API); vynucení ho obejde */
      if (!force) { const t = Number(await AsyncStorage.getItem('sb_integrity_ok').catch(() => 0)) || 0; if (Date.now() - t < 12 * 3600e3) return; }
      const p = await getIntegrityPayload('app_start');
      await api('/me/integrity/verify', { json: p, _retried: true });
      AsyncStorage.setItem('sb_integrity_ok', String(Date.now())).catch(() => {});
      integrityBlockHandler && integrityBlockHandler(null);
    } catch (e) {
      if (e?.reason === 'integrity_failed') { integrityBlockHandler && integrityBlockHandler(e.message); throw e; }
      /* výpadek sítě/Googlu uživatele neblokuje – server si ověření případně vyžádá u citlivé akce */
    }
  })().finally(() => { integrityPromise = null; });
  return integrityPromise;
}
let adsInitPromise = null;
async function prepareRewardedAds() {
  if (!adsInitPromise) adsInitPromise = (async () => {
    let consent;
    try { consent = await AdsConsent.gatherConsent(); }
    catch (_) { try { consent = await AdsConsent.getConsentInfo(); } catch (_) {} }
    if (!consent?.canRequestAds) throw Object.assign(new Error('Reklamy nejsou dostupné bez potřebného souhlasu.'), { adUnavailable: true });
    await mobileAds().initialize();
  })().catch((e) => { adsInitPromise = null; throw e; });
  return adsInitPromise;
}
async function showVerifiedRewardedAd(intentId, userId) {
  try { await prepareRewardedAds(); } catch (e) { throw Object.assign(e instanceof Error ? e : new Error(String(e)), { adUnavailable: true }); }
  const ad = RewardedAd.createForAdRequest(REWARDED_AD_UNIT, {
    serverSideVerificationOptions: { userId: String(userId), customData: intentId },
  });
  return new Promise((resolve, reject) => {
    let finished = false, earned = false, showing = false;
    const subs = [];
    const cleanup = () => { subs.forEach((s) => s?.()); clearTimeout(timer); try { ad.destroy(); } catch (_) {} };
    const done = (fn, value) => { if (finished) return; finished = true; cleanup(); fn(value); };
    const timer = setTimeout(() => done(reject, Object.assign(new Error('Reklamu se nepodařilo načíst včas. Zkus to prosím znovu.'), { adUnavailable: true })), 30000);
    subs.push(ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      if (showing || finished) return; showing = true;
      ad.show().catch((e) => done(reject, Object.assign(e instanceof Error ? e : new Error(String(e)), { adUnavailable: true })));
    }));
    subs.push(ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => { earned = true; done(resolve, reward); }));
    subs.push(ad.addAdEventListener(AdEventType.CLOSED, () => {
      if (!earned) done(reject, new Error('Reklama nebyla dokončena, odměnu jsme nepřipsali.'));
    }));
    subs.push(ad.addAdEventListener(AdEventType.ERROR, (e) => done(reject, Object.assign(new Error(e?.message || 'Reklamu se nepodařilo spustit.'), { adUnavailable: true }))));
    try { ad.load(); } catch (e) { done(reject, Object.assign(e instanceof Error ? e : new Error(String(e)), { adUnavailable: true })); }
  });
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function completeRewardedAction(action, payload, userId) {
  const intent = await api('/me/ad-reward-intents', { json: { action, payload } });
  try {
    await showVerifiedRewardedAd(intent.id, userId);
  } catch (e) {
    /* záloha pro nefunkční AdMob: když Google reklamu nenabídne/neukáže, server (s denním limitem) odměnu potvrdí sám */
    if (!e?.adUnavailable) throw e;
    try { await api('/me/ad-reward-intents/' + intent.id + '/fallback', { method: 'POST', json: {} }); return intent.id; }
    catch (fe) { throw new Error(fe?.message || e.message); }
  }
  for (let i = 0; i < 24; i++) {
    const state = await api('/me/ad-reward-intents/' + intent.id);
    if (state.state === 'earned') return intent.id;
    if (state.state === 'expired' || state.state === 'rejected') break;
    await pause(1500);
  }
  throw new Error('Google ještě potvrzuje zhlédnutí reklamy. Akci jsme neprovedli; zkus to za chvíli znovu.');
}
async function rewardMode(action, payload, userId, tier) {
  return tier === 'extra' ? null : completeRewardedAction(action, payload, userId);
}
/* nahrání souboru: globální fetch v Expu neumí RN FormData část {uri,name,type} ("Unsupported FormDataPart implementation"),
   XMLHttpRequest ji podporuje nativně a nepotřebuje žádný další balíček */
function upload(path, field, uri, name = 'p.jpg', retried = false) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', API + '/api' + path);
    if (TOKEN) xhr.setRequestHeader('Authorization', 'Bearer ' + TOKEN);
    xhr.timeout = 90000;
    xhr.onload = () => {
      let d = {}; try { d = JSON.parse(xhr.responseText); } catch (e) {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(d);
      else if (xhr.status === 403 && d.reason === 'integrity_required' && !retried) verifyAppIntegrity().then(() => upload(path, field, uri, name, true).then(resolve, reject), reject);
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
  const m = /(?:\/s\/|stromobrani:\/\/\/?)(strom|uzivatel|pozvanka)\/(\d+)/.exec(String(url || ''));
  if (m) return { type: m[1], id: +m[2] };
  const t = /(?:\/s\/|stromobrani:\/\/\/?)vyprava\/([A-Za-z0-9]{4,8})/.exec(String(url || ''));
  return t ? { type: 'vyprava', code: t[1].toUpperCase() } : null;
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
      <T key={k} onPress={() => onChange(k)} style={[s.segi, v === k && s.segOn]}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[s.segt, v === k && { color: '#fff' }]}>{l}</Text></T>
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
/* zdroj dat u zahraničních stromů */
const SourceNote = ({ kod }) => {
  const src = treeSource(kod);
  if (!src) return null;
  return <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10 }}><Ic n="information-outline" s={15} c={C.mute} style={{ marginTop: 1 }} /><Text style={[s.sm, { flex: 1, fontSize: 12 }]}>Zdroj dat: © {src}</Text></View>;
};
/* patronský strom: štítek + klikatelný patron (server může poslat d.patron = { id, username } nebo patron_id / patron_name) */
const PatronBanner = ({ tree, d, onProfile }) => {
  const raw = (d && (d.patron || d.patron_user || d.owner)) || null;
  const pid = (raw && (raw.id ?? raw.user_id)) ?? (d && (d.patron_id ?? d.patron_user_id ?? d.owner_id)) ?? null;
  const pname = (raw && (raw.username || raw.name)) || (d && (d.patron_name || d.patron_username || d.owner_name)) || null;
  if (!(tree && tree.patron) && pid == null && !pname) return null;
  return (
    <View style={s2.patron}>
      <View style={s2.patronIc}><Ic n="shield-star" s={20} c="#4a3200" /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.b}>Patronský strom</Text>
        {pid != null || pname
          ? <T disabled={pid == null || !onProfile} onPress={() => onProfile(pid)} accessibilityRole="link" accessibilityLabel={`Profil patrona ${pname || ''}`} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}><Text style={[s.sm, { color: pid != null ? C.moss : C.mute, fontWeight: '800' }]}>Patron: {pname || 'uživatel'}{pid != null ? ' ↗' : ''}</Text></T>
          : <Text style={s.sm}>Tento strom do mapy přidal jeho patron z řad komunity.</Text>}
      </View>
    </View>
  );
};
/* patronské stromy na profilu jiného uživatele (server posílá u.patron_trees = [{ kod, name, druh, okres }]) */
const PatronList = ({ list, onTree }) => {
  if (!Array.isArray(list) || !list.length) return null;
  return (
    <View style={{ marginTop: 18 }}>
      <H3 t={`Patronské stromy (${list.length})`} />
      {list.map((t) => (
        <T key={t.kod} style={s.row} activeOpacity={0.85} onPress={() => onTree && onTree(t.kod)} accessibilityRole="button" accessibilityLabel={`Otevřít patronský strom ${t.name || ''}`}>
          <View style={s2.patronIc}><Ic n="shield-star" s={20} c="#4a3200" /></View>
          <View style={{ flex: 1 }}><Text style={s.b} numberOfLines={2}>{t.name || t.nazev}</Text>{!!(t.druh || t.okres) && <Text style={s.sm} numberOfLines={1}>{[t.druh, t.okres].filter(Boolean).join(' · ')}</Text>}</View>
          <Ic n="chevron-right" s={20} c={C.mute} />
        </T>
      ))}
    </View>
  );
};
/* tlačítka na profilu */
const Tile = ({ icon, title, onPress, danger, disabled, wide }) => (
  <T activeOpacity={0.8} disabled={disabled} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}
    style={[s2.tile, wide && s2.tileWide, danger && { borderColor: '#e8b9ad' }, disabled && { opacity: 0.5 }]}>
    <Ic n={icon} s={wide ? 21 : 24} c={danger ? C.red : C.forest} />
    <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} style={[s2.tileT, danger && { color: C.red }]}>{title}</Text>
  </T>
);
const ActionRow = ({ icon, title, sub, onPress, tint }) => (
  <T activeOpacity={0.8} onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={s2.actRow}>
    <View style={[s2.actIc, tint && { backgroundColor: tint }]}><Ic n={icon} s={22} c={C.forest} /></View>
    <View style={{ flex: 1 }}><Text style={s2.actT} numberOfLines={2}>{title}</Text>{!!sub && <Text style={s.sm} numberOfLines={2}>{sub}</Text>}</View>
    <Ic n="chevron-right" s={22} c={C.mute} />
  </T>
);
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
      <L h="Památné stromy v Itálii" t="© Elenco degli alberi monumentali d’Italia (MASAF) · Regione Siciliana · Regione Emilia-Romagna · Comune di Milano" />
      <L h="Staleté stromy ve Spojeném království (Devon)" t="© Devon Biodiversity Records Centre, National Trust, Plymouth City Council" />
      <L h="Obvod, výška a stáří stromů" t="© přispěvatelé OpenStreetMap (ODbL)" url="https://www.openstreetmap.org/copyright" />
      <L h="Mapové podklady" t="© MapRiot.com, © přispěvatelé OpenStreetMap" url="https://mapriot.com/copyright" />
      <L h="Další mapové vrstvy" t="OpenFreeMap © OpenMapTiles, data © OpenStreetMap · Ortofoto a Základní mapa ČR © ČÚZK" url="https://openfreemap.org" />
      <L h="Ikony" t="Material Design Icons (Pictogrammers)" url="https://pictogrammers.com/library/mdi/" />
      <L h="Výpočet tras" t="© 2018 Valhalla contributors · © 2015–2017 Mapillary AB, Mapzen · MIT" url="https://github.com/valhalla/valhalla/blob/master/COPYING" />
      <L h="Technologie" t="Expo, React Native, MapLibre, Flask" />
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

function WalkingRouteModal({ route, treeName, routeProfile = 'pedestrian', onClose, onOpenMaps, isPlus, onPlus }) {
  const [showMap, setShowMap] = useState(false);
  const coordinates = useMemo(() => (route?.trip?.legs || []).flatMap((leg) => leg.shape ? decodePolyline6(leg.shape) : []), [route]);
  const routeFeature = useMemo(() => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } }), [coordinates]);
  const routeEnds = useMemo(() => (coordinates.length > 1 ? fc([pointF(coordinates[0][0], coordinates[0][1], { e: 0 }), pointF(coordinates[coordinates.length - 1][0], coordinates[coordinates.length - 1][1], { e: 1 })]) : EMPTY_FC), [coordinates]);
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
            {isPlus ? <Btn style={{ flex: 1 }} ghost icon="export-variant" title="Exportovat GPX" onPress={exportGpx} /> : <Btn style={{ flex: 1 }} ghost icon="crown" title="GPX · Plus" onPress={onPlus} />}
          </View>
          {showMap && <View style={[s.mini, { height: 220, marginTop: 10, overflow: 'hidden' }]}>
            {coordinates.length > 1 ? <MiniMap>
              <ML.Camera initialViewState={{ bounds: [bounds.west, bounds.south, bounds.east, bounds.north], padding: PAD(28) }} />
              <ML.GeoJSONSource id="walking-route-preview" data={routeFeature}>
                <ML.Layer type="line" id="walking-route-preview-line" source="walking-route-preview" layout={L_ROUND} paint={P_ROUTE} />
              </ML.GeoJSONSource>
              <ML.GeoJSONSource id="walking-route-ends" data={routeEnds}>
                <ML.Layer type="circle" id="walking-route-ends-c" source="walking-route-ends" paint={P_ENDS} />
              </ML.GeoJSONSource>
            </MiniMap> : <Text style={[s.sm, { padding: 16 }]}>Mapu trasy se nepodařilo načíst.</Text>}
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
    if (e - w < 0.0006 && n - so < 0.0004) return { center: [(w + e) / 2, (so + n) / 2], zoom: 18 };
    return { bounds: [w, so, e, n], padding: PAD(30) };
  }, [pts, tree]);
  const mineN = pts ? pts.filter((p) => p[2]).length : 0;
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={s.h3}>Kde se odklikává</Text>
      {pts === null ? <ActivityIndicator color={C.moss} style={{ margin: 16 }} />
        : bad ? <Text style={[s.sm, { marginTop: 6 }]}>Mapa odkliků je dostupná jen online.</Text>
        : !pts.length ? <Text style={[s.sm, { marginTop: 6 }]}>Zatím žádné odkliky.</Text> : (<>
          <View style={[s.mini, { height: big ? 340 : 170 }]}>
            <MiniMap key={kod} dragPan={big} touchZoom={big} doubleTapZoom={big} doubleTapHoldZoom={big}>
              <ML.Camera initialViewState={cs} />
              <ML.GeoJSONSource id="mm-tree" data={sh.tree}><ML.Layer type="circle" id="mm-tree-l" source="mm-tree" paint={P_M_TREE} /></ML.GeoJSONSource>
              <ML.GeoJSONSource id="mm-all" data={sh.all}><ML.Layer type="circle" id="mm-all-l" source="mm-all" paint={P_M_ALL} /></ML.GeoJSONSource>
              <ML.GeoJSONSource id="mm-mine" data={sh.mine}><ML.Layer type="circle" id="mm-mine-l" source="mm-mine" paint={P_M_MINE} /></ML.GeoJSONSource>
            </MiniMap>
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
function TreeSheet({ kod, tree, pos, me, onClose, onAuth, onVisited, toast, onProfile, bottom, queued, onQueue, favorites, onFavorite, onSuggest, onPlus, ro, setRo }) {
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
  const [tl, setTl] = useState(false), [cond, setCond] = useState(false);
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
  const weatherSummary = d?.weather_summary;
  const wxYears = Object.keys(weatherSummary?.years || {}).sort((a, b) => Number(b) - Number(a));
  const currentYear = String(new Date().getFullYear());
  const summaryYear = wxYears.includes(currentYear) ? currentYear : wxYears[0];
  const seasonKey = ['zima','jaro','léto','podzim'][Math.floor(((new Date().getMonth() + 1) % 12) / 3)];
  const weatherHighlights = [
    ['Nejčastěji celkem', weatherSummary?.all?.[0]],
    [summaryYear ? `Nejčastěji v ${summaryYear}` : null, summaryYear && weatherSummary?.years?.[summaryYear]?.[0]],
    [seasonKey ? `Nejčastěji · ${seasonKey}` : null, weatherSummary?.seasons?.[seasonKey]?.[0]],
  ].filter(([label, item]) => label && item && WX[item[0]]);
  const doneToday = !!d && (queued.some((x) => x.kod === kod) || !!(rw && rw.today));

  const submit = async () => {
    if (!me) return onAuth();
    setBusy(true);
    try {
      const r = await api(`/tree/${kod}/visit`, { json: { rating, transport: tr, weather: wx || undefined, comment, lat: pos.lat, lon: pos.lon } });
      const got = (r.total != null ? r.total : (r.pts || 0) + (r.bonus || 0)) + (r.tod_bonus || 0);
      onVisited(kod, got, r.challenges || []);
      toast(r.lifetime_extra_unlocked ? 'Sesbíral(a) jsi všechny stromy! Získáváš doživotní EXTRA! 🌳' : r.tod_bonus ? `Strom dne! +${got} b` : r.bonus ? `Prvonávštěvník! +${got} b` : got ? `Strom odklikán! +${got} b` : 'Odklik zapsán (bez bodů – stejné roční období)', r.lifetime_extra_unlocked ? 'star-circle' : r.tod_bonus ? 'star-four-points' : r.bonus ? 'star' : 'tree');
      setRating(0); setTr(null); setWx(null); setComment(''); await load();
    } catch (e) {
      if (!e.code) {   // bez signálu → fronta, odešle se automaticky po připojení
        onQueue({ kod, rating, transport: tr, weather: wx || undefined, comment, lat: pos.lat, lon: pos.lon });
        onVisited(kod, -1, []); setD((x) => ({ ...x, mine: { rating, transport: tr, comment, weather: wx } }));
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
      const saved = await upload(`/tree/${kod}/photo`, 'photo', m.uri, 'p.jpg');
      toast(`Fotka přidána${saved.points ? ` · +${saved.points} bodů` : ''}`, 'camera'); load();
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
      const costingOptions = costingOf(routeProfile, ro);
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
          <PatronBanner tree={tree} d={d} onProfile={onProfile} />
          <SourceNote kod={kod} />
          {d.tod === 10 && <View style={s.firstB}><Ic n="star-four-points" s={20} c={C.bark} /><Text style={s.firstBt}>Strom dne! Za dnešní odklik dostaneš +10 b navíc.</Text></View>}
          {!!d.conditions && d.conditions.kind !== 'ok' && <View style={[s.warn, { flexDirection: 'row', gap: 8, alignItems: 'center' }]}><Ic n="alert-outline" s={18} c="#8a3a22" /><Text style={{ color: '#8a3a22', fontSize: 13, flex: 1 }}>Hlášeno: {d.conditions.label} · {ago(d.conditions.created)} ({d.conditions.reports}× za 4 měsíce)</Text></View>}
          {!!weatherHighlights.length && <View style={[s.card,{marginTop:10,padding:12}]}>
            <View style={[s.rowi,{marginBottom:4}]}><Ic n="weather-partly-cloudy" s={19} c={C.moss}/><Text style={s.b}>Počasí zaznamenané u stromu</Text></View>
            {weatherHighlights.map(([label,item]) => <View key={label} style={[s.rowi,{justifyContent:'space-between',marginTop:4}]}><Text style={s.sm}>{label}</Text><View style={s.rowi}><Ic n={WX[item[0]][0]} s={16} c={C.moss}/><Text style={[s.sm,{marginLeft:4}]}>{WX[item[0]][1]} · {item[1]}×</Text></View></View>)}
          </View>}
          <Btn ghost icon={favorites.includes(kod) ? 'heart' : 'heart-outline'} title={favorites.includes(kod) ? 'Odebrat z oblíbených' : 'Přidat mezi oblíbené'} onPress={() => onFavorite(kod)} />
          {d.offline && <View style={[s.warn, { flexDirection: 'row', gap: 8, alignItems: 'center' }]}><Ic n="cloud-off-outline" s={18} c="#8a3a22" /><Text style={{ color: '#8a3a22', fontSize: 13, flex: 1 }}>Offline – recenze a fotky se načtou po připojení.</Text></View>}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Btn ghost icon={routeProfile === 'bicycle' ? 'bike' : routeProfile === 'auto' ? 'car' : 'walk'} style={{ flex: 1, marginTop: 0 }} title={routeLoading ? 'Počítám trasu…' : 'Vypočítat trasu'} disabled={routeLoading} onPress={goThere} />
            <Btn ghost icon="link-variant" style={{ flex: 1, marginTop: 0 }} title="Sdílet odkaz" onPress={shareLink} />
          </View>
          <Text style={[s.sm, { marginTop: 10, fontWeight: '800' }]}>Profil trasy</Text>
          <Presets v={routeProfile} opts={[["pedestrian", "Pěšky"], ["bicycle", "Cyklo"], ["auto", "Auto"]]} onChange={setRouteProfile} />
          <RouteOptions profile={routeProfile} o={ro} set={(p) => setRo((o) => ({ ...o, ...p }))} />
          <Btn ghost icon="share-variant-outline" title="Sdílet kartu" onPress={share} />
          <Btn ghost icon="file-edit-outline" title="Navrhnout opravu údajů" onPress={() => onSuggest({ kind: 'fix', kod, name: d.name })} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn style={{ flex: 1 }} ghost icon="image-multiple-outline" title="Časová osa fotek" onPress={() => setTl(true)} />
            <Btn style={{ flex: 1 }} ghost icon="alert-outline" title="Nahlásit stav" onPress={() => (me ? setCond(true) : onAuth())} />
          </View>

            {!!d.first_bonus && <View style={s.firstB}><Ic n="star-circle" s={20} c={C.bark} /><Text style={s.firstBt}>Prvonávštěvník: za první odklik tohoto stromu v letošním roce +{me?.plus ? 75 : 50} b navíc{me?.plus ? ' (Plus)' : ''}!</Text></View>}
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
              {!!rw && <Text style={s.sm}>{rw.base ? `+${rw.base} b${mine ? ' – jiné roční období než minule' : ' za první odklik'}` : 'Bez bodů – stejné roční období jako minule'}{rw.bonus ? `  ·  +${rw.bonus} b prvonávštěvník` : ''}</Text>}
              <VisitFields rating={rating} setRating={setRating} tr={tr} setTr={setTr} wx={wx} setWx={setWx} comment={comment} setComment={setComment} />
              {msg && <Text style={s.warn}>{msg}</Text>}
              <Btn icon={!me ? 'login' : 'check-circle-outline'} title={!me ? 'Přihlásit se' : busy ? 'Ukládám…' : 'Odkliknout strom'} disabled={me && (busy || !near || !rating || !tr)} onPress={submit} />
            </View>
          )}

          <NotesBlock kod={kod} me={me} pos={pos} toast={toast} />
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
          {!!d.url && <Text style={[s.sm, { marginTop: 12, color: C.moss }]} onPress={() => Linking.openURL(d.url)}>{treeCountry(kod, d.zeme) === 'CZ' ? 'Více v databázi AOPK ČR ↗' : 'Více o stromu u zdroje dat ↗'}</Text>}
        </>)}
      </ScrollView>
      {!!d && <ViewShot ref={shareCardRef} options={{ format: 'png', quality: 1 }} style={{ position: 'absolute', left: -1000, top: 0, width: 360 }}><View style={{ backgroundColor: C.forest, padding: 22, width: 360 }}><Text style={{ color: C.sun, fontWeight: '900', letterSpacing: 2 }}>STROMOBRANÍ · PAMÁTNÉ STROMY</Text>{d.photos && d.photos[0] && <Image source={{ uri: API + '/uploads/' + d.photos[0].file }} style={{ width: 316, height: 190, borderRadius: 16, marginTop: 16 }} />}<Text style={{ color: '#fff', fontFamily: SERIF, fontWeight: '800', fontSize: 28, marginTop: 14 }}>{d.name}</Text><Text style={{ color: '#dbe7d4', marginTop: 8 }}>{d.druh || tree.druh || 'Památný strom'} · {fmtD(dist || 0)}</Text><Text style={{ color: C.sun, fontWeight: '800', marginTop: 12 }}>{mine ? 'Navštíveno ve Stromobraní 🌳' : 'Pojď ho objevit 🌳'}</Text><Text style={{ color: '#dbe7d4', marginTop: 12 }}>{treeLink(kod)}</Text></View></ViewShot>}
      <Full photos={d?.photos || []} photoId={fid} onPhotoChange={setFid} onClose={() => setFid(null)} onLike={like} onProfile={onProfile} />
      <WalkingRouteModal route={route} routeProfile={route?._profile} treeName={d?.name || tree.name} onClose={() => setRoute(null)} onOpenMaps={openNativeWalkingNavigation} isPlus={!!(me && me.plus)} onPlus={() => { setRoute(null); onPlus?.(); }} />
      {tl && <TimelineModal kod={kod} name={d?.name || tree.name} onClose={() => setTl(false)} toast={toast} />}
      {cond && <ConditionModal kod={kod} name={d?.name || tree.name} onClose={() => setCond(false)} toast={toast} onDone={(c) => setD((x) => ({ ...x, conditions: c }))} />}
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
function Board({ me, onProfile, top, bottom, onPlus, embedded }) {
  const [rows, setRows] = useState(null);
  const [ref, setRef] = useState(false);
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [sb, setSb] = useState(false);
  const [friendsOnly, setFriendsOnly] = useState(false);
  const load = async () => {
    setRef(true);
    if (friendsOnly && me && !me.plus) { setRows([]); setRef(false); return; }
    try { const r = await api('/leaderboard' + (friendsOnly ? '?friends=1' : '')); setRows(r.map((x, i) => ({ ...x, rank: x.rank || i + 1 }))); } catch (e) {}
    setRef(false);
  };
  useEffect(() => {
    if (friendsOnly && me && !me.plus) { setRows([]); setRes(null); setQ(''); setRef(false); return; }
    load();
  }, [friendsOnly, me && me.id, me && me.plus]);
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
      <Text style={[s.sm, { marginBottom: 10 }]}>První odklik stromu 10 b., další roční období 5 b., prvonávštěvník +50 b. (Plus +75 b.), fotka 3 b. (Plus 4 b.), lajk 1 b. a body za splněné výzvy.</Text>
      {!!me && <View style={{ marginBottom: 8 }}><Seg v={friendsOnly ? 'friends' : 'all'} onChange={(v) => { setRes(null); setQ(''); if (v === 'friends' && !me.plus) { setFriendsOnly(true); onPlus(); } else setFriendsOnly(v === 'friends'); }} opts={[["all", "Všichni"], ["friends", me.plus ? "Přátelé" : "Přátelé 🔒"]]} /></View>}
      {!!me && friendsOnly && !me.plus && <PlusLock title="Přátelský žebříček" detail="Porovnejte body jen mezi lidmi, které znáš." onPress={onPlus} compact />}
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
    <FlatList style={embedded ? { flex: 1 } : s.panel} data={friendsOnly && me && !me.plus ? [] : data} keyExtractor={(r) => String(r.id)} renderItem={renderItem}
      contentContainerStyle={{ paddingTop: embedded ? 4 : top + 14, paddingBottom: bottom + 20, paddingHorizontal: 16 }}
      ListHeaderComponent={header} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      initialNumToRender={12} maxToRenderPerBatch={10} windowSize={7} removeClippedSubviews
      ListEmptyComponent={friendsOnly && me && !me.plus ? null : res ? (sb ? null : <Text style={s.sm}>Nikdo takový nenalezen.</Text>) : !rows ? <ActivityIndicator color={C.moss} style={{ marginTop: 20 }} /> : <Text style={s.sm}>Zatím tu nikdo není. Buď první!</Text>}
      refreshControl={<RefreshControl refreshing={ref} onRefresh={load} tintColor={C.moss} />} />
  );
}

/* ============================== profil ============================== */
const Badge = React.memo(({ i, n, ok, w }) => (
  <View style={[s.bdg, s2.bdgBox, w ? { width: w } : null, !ok && { opacity: 0.3 }]}><Ic n={i} s={28} c={ok ? C.moss : C.mute} /><Text numberOfLines={2} style={[s.sm, { textAlign: 'center', fontSize: 11, lineHeight: 14, paddingHorizontal: 4 }]}>{n}</Text></View>
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

function PatronTrees({ me, toast, onAuth, onPurchase, onTree }) {
  const [data,setData]=useState(null),[open,setOpen]=useState(false),[mapTouch,setMapTouch]=useState(false),[busy,setBusy]=useState(false),[adBusy,setAdBusy]=useState(false);
  const [name,setName]=useState(''),[species,setSpecies]=useState('Dub'),[lon,setLon]=useState(null),[lat,setLat]=useState(null),[details,setDetails]=useState(''),[circ,setCirc]=useState(''),[height,setHeight]=useState(''),[age,setAge]=useState(''),[url,setUrl]=useState('');
  const load=()=>api('/me/patron-trees').then(setData).catch((e)=>toast(e.message,'alert-circle-outline'));
  useEffect(()=>{if(me)load();},[me?.id,me?.tier]);
  useEffect(()=>{if(!open)setMapTouch(false);},[open]);
  const pickCam=useRef(null);const msel=useMapState();
  const fillMyPos=async()=>{
    try{
      const perm=await Location.requestForegroundPermissionsAsync();
      if(perm.status!=='granted')return toast('Chybí oprávnění k poloze','map-marker-off-outline');
      const r=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
      const {longitude:lo,latitude:la}=r.coords;
      setLon(lo);setLat(la);
      pickCam.current?.flyTo({center:[lo,la],zoom:17,duration:700});
    }catch(e){toast('Polohu se nepodařilo zjistit','alert-circle-outline');}
  };
  const submit=async()=>{
    if(!me)return onAuth();
    if(lon==null||lat==null)return toast('Klepnutím do mapy vyber polohu stromu.','map-marker-alert-outline');
    setBusy(true);try{
      const tree={name,species,lon,lat,details,circumference:circ||null,height:height||null,age:age||null,url};
      const rules=data?.rules;if(!rules)throw new Error('Načítám podmínky patronství.');
      let adRewardId=null;
      const adPayload={tree:{...tree,circumference:tree.circumference==null?null:Number(tree.circumference),height:tree.height==null?null:Number(tree.height),age:tree.age==null?null:Number(tree.age)}};
      if(rules.mode==='ad'){setAdBusy(true);adRewardId=await completeRewardedAction('patron_tree',adPayload,me.id);}
      if(rules.mode==='paid') {await onPurchase(rules.productId,{action:'patron_tree',tree});}
      else await api('/me/patron-trees',{json:{tree,mode:rules.mode,adRewardId}});
      setOpen(false);await load();toast('Strom jsme poslali do kontroly. Po schválení se objeví na mapě.','tree');
    }catch(e){toast(e.message||'Strom se nepodařilo odeslat.','alert-circle-outline');}finally{setBusy(false);setAdBusy(false);}
  };
  if(!me)return <Btn ghost icon="tree-outline" title="Přidat vlastní strom · Patronské stromy" onPress={onAuth}/>;
  const rules=data?.rules;const modeLabel=rules?.mode==='free'?'zdarma':rules?.mode==='ad'?'za odměnovou reklamu':rules?.mode==='paid'?(me.tier==='free'?'50 Kč':'29 Kč'):'limit pro tento rok vyčerpán';
  return <View style={{marginTop:18}}><Text style={s.h3}>🌳 Patronské stromy</Text><Text style={[s.sm,{marginTop:4}]}>Přidej svůj oblíbený strom do mapy. Po kontrole ho uvidí celá komunita; pokud bude potřeba úprava, pošleme ti zprávu přímo sem.</Text>
    {rules&&<Text style={[s.sm,{marginTop:5}]}>Letos {rules.used}/{rules.limit} · další přidání {modeLabel}</Text>}
    <Btn icon="tree-outline" title="Přidat patronský strom" disabled={!rules||rules.mode==='unavailable'} onPress={()=>setOpen(true)}/>
    {data?.trees?.map((item)=>{const k=item.kod||item.tree_kod||item.payload?.kod;const tap=!!(k&&onTree&&item.status==='approved');const Wrap=tap?T:View;return <Wrap key={item.id} style={s.card} {...(tap?{onPress:()=>onTree(k),activeOpacity:0.85}:{})}><View style={s.rowi}>{item.status==='approved'&&<Ic n="shield-star" s={18} c={C.sun}/>}<Text style={[s.b,{flex:1}]}>{item.payload.name} · {item.status==='pending'?'čeká na kontrolu':item.status==='approved'?'schváleno · patronský strom':'vyžaduje úpravu'}</Text>{tap&&<Ic n="chevron-right" s={20} c={C.mute}/>}</View>{item.admin_message?<Text style={[s.sm,{marginTop:4}]}>{item.admin_message}</Text>:null}</Wrap>;})}
    <Modal visible={open} transparent animationType="slide" onRequestClose={()=>setOpen(false)}><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1,backgroundColor:'#1f3d2bcc',justifyContent:'flex-end'}}><ScrollView style={{maxHeight:'94%',backgroundColor:C.paper,borderTopLeftRadius:24,borderTopRightRadius:24}} contentContainerStyle={{padding:18,paddingBottom:32}} keyboardShouldPersistTaps="handled" scrollEnabled={!mapTouch} nestedScrollEnabled><Text style={s.h2}>Nový patronský strom</Text>
      <Text style={CC_LABEL}>Název stromu</Text><TextInput style={s.input} value={name} onChangeText={setName} placeholder="Např. starý dub u školy"/>
      <Text style={[CC_LABEL,{marginTop:10}]}>Druh</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}>{SPECIES_APP.map((x)=><T key={x} onPress={()=>setSpecies(x)} style={[s.chip,species===x&&s.chipOn,{marginRight:5}]}><Text style={[s.chipT,species===x&&{color:'#fff'}]}>{x}</Text></T>)}</ScrollView>
      <Text style={[CC_LABEL,{marginTop:10}]}>Poloha · přibliž a klepni na strom</Text><View onTouchStart={()=>setMapTouch(true)} onTouchEnd={()=>setMapTouch(false)} onTouchCancel={()=>setMapTouch(false)} style={{height:300,borderRadius:14,overflow:'hidden',marginTop:5}}><MiniMap layerId={resolveLayer(msel.sel,msel.down)} onPress={(e)=>{const c=e?.nativeEvent?.lngLat;if(c?.length>=2){setLon(c[0]);setLat(c[1]);}}}><ML.Camera ref={pickCam} initialViewState={lon!=null?{center:[lon,lat],zoom:16}:{center:[15.4,49.8],zoom:6.3}}/><ML.GeoJSONSource id="patron-point" data={lon!=null?fc([pointF(lon,lat)]):EMPTY_FC}><ML.Layer type="circle" id="patron-halo" source="patron-point" paint={P_PATRON_H}/><ML.Layer type="circle" id="patron-dot" source="patron-point" paint={P_PATRON}/></ML.GeoJSONSource></MiniMap></View><Btn ghost icon="crosshairs-gps" title="Použít mou polohu" onPress={fillMyPos}/><Text style={s.sm}>{lon!=null?`${lat.toFixed(5)}, ${lon.toFixed(5)}`:'Poloha nevybrána'}</Text>
      {[['Obvod v cm',circ,setCirc],['Výška v m',height,setHeight],['Stáří v letech',age,setAge]].map(([label,value,set])=><View key={label} style={{marginTop:9}}><Text style={CC_LABEL}>{label} · nepovinné</Text><TextInput style={s.input} keyboardType="decimal-pad" value={value} onChangeText={set}/></View>)}
      <Text style={[CC_LABEL,{marginTop:9}]}>Odkaz · nepovinné</Text><TextInput style={s.input} value={url} onChangeText={setUrl} autoCapitalize="none" placeholder="https://…"/><TextInput style={[s.input,{height:76,marginTop:9}]} multiline value={details} onChangeText={setDetails} placeholder="Příběh nebo zajímavost o stromu"/>
      <Btn title={busy?(adBusy?'Připravuji reklamu…':'Odesílám…'):'Pokračovat · '+modeLabel} disabled={busy||rules?.mode==='unavailable'} onPress={submit}/><Btn ghost title="Zrušit" onPress={()=>setOpen(false)}/>
    </ScrollView></KeyboardAvoidingView></Modal>
  </View>;
}
const SPECIES_APP=['Lípa','Dub','Buk','Jedle','Smrk','Borovice','Modřín','Jasan','Javor','Jilm','Topol','Vrba','Olše','Bříza','Habr','Kaštan','Ořešák','Třešeň','Hrušeň','Jabloň','Tis','Cypřiš','Platan','Akát','Douglaska','Jeřáb','Líska','Cedr','Sekvoj','Jerlín','Hloh','Moruše','Jinan','Liliovník','Katalpa','Dřín','Oskeruše','Magnolie','Jidášovec','Paulovnie','Maklura','Tisovec','Túje','Zmarličník','Břestovec','Bez','Řešetlák','Pajasan','Dřezovec','Břečťan','Jiný'];
const CC_LABEL = { fontWeight: '800', color: C.forest, fontSize: 13, marginBottom: 5 };
function CommunityChallenges({ me, onAuth, toast, onPlus }) {
  const [items, setItems] = useState(null);
  const [creating, setCreating] = useState(false);
  const [adBusy, setAdBusy] = useState(false); const [adError, setAdError] = useState('');
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
    setAdError(''); setAdBusy(true);
    try {
      const data = { name, district: exactDistrict || district, goal: Number(goal), days: 30 };
      if (!me.plus) data.adRewardId = await completeRewardedAction('challenge_create', data, me.id);
      await api('/community-challenges', { json: data }); setCreating(false); setName(''); setDistrict(''); await load(); toast('Okresní výzva byla založena. Ať se výprava vydaří! 🌳', 'flag-checkered');
    } catch (e) { setAdError(e.message || 'Akci se nepodařilo dokončit. Zkus to znovu.'); }
    setAdBusy(false);
  };
  const join = async (id) => { try { await api(`/community-challenges/${id}/join`, { method: 'POST' }); await load(); } catch (e) { toast(e.message, 'alert-circle-outline'); } };
  return <View style={{ marginTop: 20 }}>
    <View style={[s.rowi, { justifyContent: 'space-between' }]}><Text style={s.h3}>Okresní a týmové výzvy</Text><T onPress={() => setCreating(!creating)} accessibilityRole="button" accessibilityLabel="Založit okresní výzvu"><Ic n={me?.tier === 'free' ? 'movie-open-check' : 'plus-circle-outline'} s={23} c={C.moss} /></T></View>
    {me?.tier === 'free' && <Text style={[s.sm,{marginTop:4}]}>Novou výzvu založíš po zhlédnutí krátké odměnové reklamy. Pokud reklama není dostupná, zkus to později.</Text>}
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
      {!!adError && <Text style={[s.warn,{marginTop:8}]}>{adError}</Text>}
      <Btn title={adBusy ? (me?.tier === 'free' ? 'Ověřuji reklamu…' : 'Zakládám výzvu…') : (me?.tier === 'free' ? 'Zhlédnout reklamu a založit' : 'Založit výzvu na 30 dní')} disabled={adBusy} onPress={create} />
    </View>}
      {!items ? <ActivityIndicator color={C.moss} /> : !items.length ? <Text style={s.sm}>Zatím tu není aktivní výzva. Založ první pro svůj okres.</Text> : items.map((c) => <View key={c.id} style={s.card}><View style={s.rowi}><Ic n="map-marker-radius" s={20} c={C.moss} /><Text style={[s.b, { flex: 1 }]}>{c.name} · {c.district}</Text><Text style={s.sm}>{c.progress}/{c.goal}</Text></View><View style={s.bar}><View style={{ width: Math.min(100, c.progress / c.goal * 100) + '%' , height: '100%', backgroundColor: C.leaf }} /></View><Text style={s.sm}>{c.members} účastníků · ty: {c.my_progress} stromů</Text>{!c.joined && <Btn ghost title="Přidat se" onPress={() => join(c.id)} />}</View>)}
  </View>;
}
function Profile({ id, me, top, bottom, onAuth, onTree, onProfile, onLogout, onEdit, onDelete, onSettings, onPlus, onPurchase, onGift, toast, allSpecies = [], points = [], streak, onFreeze, onCollections, onWrapped, onDiary }) {
  const [u, setU] = useState(null);
  const [err, setErr] = useState(null);
  const [nt, setNt] = useState(15);
  const [np, setNp] = useState(18);
  const [fp, setFp] = useState(null);
  const [sp, setSp] = useState(null);          // právě otevřený druh ve sbírce
  const [selfPh, setSelfPh] = useState(false);  // vlastní profilovka na celou obrazovku
  const [friendState, setFriendState] = useState(null);
  const [expOpen, setExpOpen] = useState(false);
  const [listsOpen, setListsOpen] = useState(false);
  const { width: winW } = useWindowDimensions();
  const pk = me && me.priv ? PRIV.map((x) => (me.priv[x[0]] === false ? 0 : 1)).join('') : '';
  const viewerPlus = !!(me && me.plus);
  useEffect(() => {
    if (!id) return;
    setU(null); setErr(null); setNt(15); setNp(18);
    api('/user/' + id).then(setU).catch((e) => setErr(e.message));
  }, [id, me && me.avatar, me && me.bio, me && me.photo, me && me.plus, pk]);
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
  /* mřížka odznaků: počet sloupců podle šířky displeje, buňky vyplní celou šířku mezi odsazeními */
  const bGap = 10, bAvail = Math.max(240, winW - 32 - 4), bCols = Math.max(3, Math.min(6, Math.floor((bAvail + bGap) / (88 + bGap)))), bW = Math.floor((bAvail - bGap * (bCols - 1)) / bCols) - 1;
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
      {isMe && <View style={{ gap: 10, marginTop: 14 }}>
        <ActionRow icon={u.plus ? 'crown' : 'leaf-circle'} tint="#fbefd0" title={u.plus ? 'Stromobraní Plus · členství aktivní' : 'Objev Stromobraní Plus'} sub={u.plus ? 'Spravovat členství' : 'Pokročilé filtry, sbírka druhů a další výhody'} onPress={onPlus} />
        <ActionRow icon="gift-outline" title="Darovat roční předplatné" sub="Potěš kamaráda Plusem nebo EXTRA" onPress={onGift} />
        <ActionRow icon="medal-outline" title="Sbírky a okresy" sub="Odznaky za druhy, dokončené okresy a mlha na mapě" onPress={onCollections} />
        <ActionRow icon="party-popper" title={`Tvůj rok ${new Date().getFullYear()}`} sub="Roční shrnutí ke sdílení" onPress={onWrapped} />
        <ActionRow icon="notebook-outline" title="Deník poznámek" sub="Soukromé poznámky ke stromům" onPress={onDiary} />
        <ActionRow icon="folder-multiple-outline" title="Moje seznamy stromů" sub="Složky výletů a stromů k návštěvě" onPress={() => setListsOpen(true)} />
      </View>}
      {isMe && <StreakCard streak={streak} onFreeze={onFreeze} />}
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
        <View style={{ marginTop: 6 }}>
          <ActionRow icon="file-download-outline" title="Exportovat sbírku" sub="GPX, KML, PDF a CSV" onPress={() => setExpOpen(true)} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
          <Tile icon="pencil-outline" title="Upravit" onPress={onEdit} />
          <Tile icon="cog-outline" title="Nastavení" onPress={onSettings} />
          <Tile icon="share-variant-outline" title="Sdílet" onPress={() => Share.share({
            message: `Mám ${u.visits} stromů a titul „${lv ? lv[1] : ''}“ ve Stromobraní 🌳${u.rank ? ` (#${u.rank} v žebříčku)` : ''} ${profLink(u.id)}` })} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
          <Tile wide icon="logout" title="Odhlásit" onPress={onLogout} />
          <Tile wide danger icon="trash-can-outline" title="Smazat účet" onPress={onDelete} />
        </View>
      </>) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
          {!!me && <Tile wide icon={friendState === 'accepted' ? 'account-check' : 'account-plus-outline'} title={friendState === 'accepted' ? 'Odebrat přítele' : friendState === 'incoming' ? 'Přijmout žádost' : friendState === 'pending' ? 'Žádost odeslána' : 'Přidat přítele'} disabled={friendState === 'pending'} onPress={friendAction} />}
          <Tile wide icon="share-variant-outline" title="Sdílet" onPress={() => Share.share({ message: `Podívej se na profil ${u.username} ve Stromobraní 🌳 ${profLink(u.id)}` })} />
        </View>
      )}
      {!isMe && <T onPress={reportUser} style={[s.rowi, { marginTop: 12 }]}><Ic n="flag-outline" s={16} c={C.red} /><Text style={[s.sm, { color: C.red }]}>Nahlásit profil</Text></T>}
      <Text style={[s.sm, { marginTop: 10, color: C.moss }]} onPress={() => Linking.openURL(API + '/privacy')}>Zásady ochrany soukromí ↗</Text>

      <H3 style={{ marginTop: 18 }} t="Odznaky" off={off('badges')} />
      {hide.badges || !u.badges ? <Hidden /> : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: bGap, marginTop: 10, paddingHorizontal: 2 }}>
          {u.badges.map(([i, n, ok]) => <Badge key={n} i={i} n={n} ok={ok} w={bW} />)}
        </View>
      )}

      <H3 style={{ marginTop: 18 }} t={`Výzvy${u.challenges ? ` (${chDone}/${u.challenges.length})` : ''}`} off={off('challenges')} />
      {hide.challenges || !u.challenges ? <Hidden /> : u.challenges.map((c) => <Challenge key={c.id} c={c} />)}
      {!isMe && <PatronList list={u.patron_trees || u.patronTrees} onTree={onTree} />}
      {isMe && <PatronTrees me={me} toast={toast} onAuth={onAuth} onPurchase={onPurchase} onTree={onTree} />}

      <H3 style={{ marginTop: 18 }} t={`Sbírka druhů (${collected.size}/${allSpecies.length})`} />
      {hide.history ? <Hidden /> : !viewerPlus ? <PlusLock title="Sbírka druhů a procenta" detail="Zjisti, které druhy už máš objevené a kolik jich zbývá." onPress={onPlus} /> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 }}>
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
      {viewerPlus && !hide.history && collected.size > 0 && <Text style={[s.sm, { marginTop: 6 }]}>Klepnutím na odemčený druh zobrazíš odklikané stromy.</Text>}

      {isMe && <View style={[s.card,{marginTop:14}]}>
        <Text style={s.h3}>Historie bodů</Text>
        <Text style={[s.sm,{marginTop:2}]}>Přehled bodů získaných za návštěvy, fotky, lajky a výzvy.</Text>
        {(u.point_history || []).length ? u.point_history.slice(0,50).map((entry) => <View key={entry.id} style={[s.row,{alignItems:'center',marginTop:6}]}>
          <View style={{flex:1,minWidth:0}}><Text style={s.b} numberOfLines={1}>{entry.title}</Text><Text style={s.sm}>{fmtDay(entry.created)}</Text></View>
          <Text style={[s.b,{color:entry.points >= 0 ? C.moss : C.red,fontVariant:['tabular-nums']}]}>{entry.points > 0 ? '+' : ''}{entry.points} b</Text>
        </View>) : <Text style={[s.sm,{marginTop:8}]}>Zatím tu nejsou žádné připsané body.</Text>}
      </View>}

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
      {expOpen && <ExportModal onClose={() => setExpOpen(false)} trees={u.trees || []} points={points} isPlus={viewerPlus} onPlus={onPlus} onCsv={exportCsv} toast={toast} />}
      {listsOpen && <UserListsModal points={points} onClose={() => setListsOpen(false)} onTree={(kod) => { setListsOpen(false); onTree(kod); }} toast={toast} />}
    </ScrollView>
  );
}

/* ============================== radar (kompas ke stromu) ============================== */
function Radar({ near, heading, top, bottom, onOpen, onShow, visited, isPlus, onPlus, day, streak, onFreeze, onPlan, points }) {
  const { width } = useWindowDimensions();
  const dial = Math.min(190, Math.round(width * 0.52));
  const t = near[0];
  const ang = t && heading != null ? (bearing(...[t.pos.lat, t.pos.lon, t.p[3], t.p[2]]) - heading + 360) % 360 : null;
  const inR = t && t.d <= RADIUS;
  return (
    <ScrollView style={s.panel} contentContainerStyle={{ paddingTop: top + 14, paddingBottom: bottom + 20, paddingHorizontal: 16 }}>
      <Text style={s.h2}>Radar</Text>
      <StreakCard streak={streak} onFreeze={onFreeze} />
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
      {!!t && <Btn ghost icon={isPlus ? 'map-marker-path' : 'crown'} title={isPlus ? 'Naplánovat výlet přes více stromů' : 'Výlety přes více stromů · Plus'} onPress={onPlan} />}
      {day && (
        <View style={[s.card, { backgroundColor: '#fbf0cf' }]}>
          <View style={s.rowi}><Ic n="weather-sunny" s={16} c={C.bark} /><Text style={s.sm}>STROM DNE</Text></View>
          <Text style={[s.h3, { marginVertical: 4 }]}>{day[1]}</Text>
          <Text style={s.sm}>{visited.has(day[0]) ? 'Už ho máš' : 'Dnes ho zkus navštívit: za odklik +10 b navíc!'}</Text>
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
  const [username,setUsername]=useState(me?me.username:'');
  const [ph, setPh] = useState(me ? me.photo : null);
  const [upl, setUpl] = useState(false);
  const [err, setErr] = useState(null);
  const [gifInfo,setGifInfo]=useState(null);
  const edit = mode === 'edit';
  const go = async () => {
    try {
      if (edit) { const payload={ avatar: av, bio, username }; let adRewardId=null; if(me?.tier==='free')adRewardId=await completeRewardedAction('profile_change',payload,me.id); else if(me?.tier==='plus'){const usage=me.profile_change_usage||{};if((usage.changes||0)>=3&&(usage.ad_changes||0)<2)adRewardId=await completeRewardedAction('profile_change',payload,me.id);else if((usage.changes||0)>=5)throw new Error('Další změna profilu je placená; nákup zatím otevři z tarifu.');} const result=await api('/me', { json: { ...payload, adRewardId } }); onDone({ ...me, ...result.user, photo: ph }); return; }
      const r = await api(mode === 'reg' ? '/register' : '/login', { json: { username: u, password: pw, avatar: av } });
      onDone(r.user, r.token);
    } catch (e) { setErr(e.message); }
  };
  const pickPhoto = async () => {
    try {
      try { await ImagePicker.requestMediaLibraryPermissionsAsync(); } catch (e) {}
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: me?.tier==='extra'?['images']:['images'], quality: 0.8 });
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
  const pickGif = async () => {
    try { await api('/me/profile-gif-credit');const r=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:false});if(r.canceled)return;const a=r.assets[0];if(!String(a.mimeType||'').includes('gif')&&!String(a.uri||'').toLowerCase().endsWith('.gif'))throw new Error('Vyber GIF soubor.');const saved=await upload('/me/avatar','avatar',a.uri,'avatar.gif');setPh(saved.user.photo);onMe({...me,...saved.user});avReplace(saved.user.photo); } catch(e){setErr(e.message);}
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
                <Btn ghost icon="image-multiple-outline" style={{ flex: 1 }} title="GIF profilovka" onPress={pickGif} />
                {!!ph && <Btn ghost style={{ flex: 1 }} title="Odebrat fotku" onPress={removePhoto} />}
              </View>
              <Text style={[s.sm,{marginTop:5,textAlign:'center'}]}>GIF profilovka · Free 29 Kč (1× ročně), Plus 19 Kč (2× ročně), EXTRA bez limitu.</Text>
            </View>
          )}
          {edit&&<TextInput style={[s.input,{marginBottom:8}]} placeholder="Uživatelské jméno" autoCapitalize="none" maxLength={24} value={username} onChangeText={setUsername}/>}
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
  const [geoStatus, setGeoStatus] = useState(null);
  useEffect(() => {
    let alive = true;
    const refresh = async () => { const saved = jparse(await AsyncStorage.getItem('sb_geofence_status'), {}); let active = false; try { active = await Location.hasStartedGeofencingAsync(GEO_TASK); } catch (e) {} if (alive) setGeoStatus({ ...saved, active }); };
    refresh(); const timer = settings.bgNearby ? setInterval(refresh, 4000) : null;
    return () => { alive = false; if (timer) clearInterval(timer); };
  }, [settings.bgNearby, settings.nearbyRadius]);
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
  const toggleNotif = async (k, v) => {
    if (!v) return onSet({ [k]: false });
    await ensureChannels();
    const p = await Notifications.getPermissionsAsync(); const r = p.granted ? p : await Notifications.requestPermissionsAsync();
    if (r.granted) onSet({ [k]: true }); else setNote({ ok: false, t: 'Povol oznámení v nastavení telefonu.' });
  };
  const toggleBg = (v) => {
    if (!v) return onSet({ bgNearby: false });
    Alert.alert('Upozornění i při zavřené appce', 'Stromobraní bude moct zjišťovat tvou polohu i na pozadí (když appku zrovna nepoužíváš), aby ti poslalo upozornění, že jsi poblíž nenavštíveného stromu. Poloha zůstává jen v telefonu a nikam se neodesílá. Vypnout to můžeš kdykoli tady.', [
      { text: 'Zrušit', style: 'cancel' },
      { text: 'Souhlasím', onPress: async () => { const err = await askBackgroundNearby(); if (err) setNote({ ok: false, t: err }); else onSet({ bgNearby: true }); } },
    ]);
  };
  const Sw = ({ v, on, label = 'Nastavení' }) => <Switch value={v} onValueChange={on} accessible accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: !!v }} trackColor={{ false: '#d8d2b8', true: C.leaf }} thumbColor={v ? C.moss : '#f4f1e6'} />;
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
            <Sw label="Vítězný zvuk při odkliku" v={settings.sound} on={(v) => { onSet({ sound: v }); if (v) playSound('win'); }} />
          </View>

          <H3 t="Mapa" style={{ marginTop: 18 }} />
          <View style={s.row}>
            <Ic n="compass-outline" s={22} c={C.moss} />
            <View style={{ flex: 1 }}><Text style={s.b}>Otáčení mapy</Text><Text style={s.sm}>Po vypnutí zůstane mapa vždy otočená na sever a kompas se skryje.</Text></View>
            <Sw label="Otáčení mapy" v={settings.rot} on={(v) => onSet({ rot: v })} />
          </View>
          <H3 t="Upozornění" style={{ marginTop: 18 }} />
          {[['dailyReminder', 'bell-outline', 'Denní připomenutí', 'Připomene výpravu za stromem.', 'reminderHour', 'reminderMin'],
            ['todNotif', 'star-four-points-outline', 'Strom dne', 'Každý den ti pošle strom dne. Za jeho odklik +10 b.', 'todHour', 'todMin'],
            ['streakNotif', 'fire', 'Záchrana série', 'Večer upozorní, když máš sérii a dnes jsi ještě nic neodklikl(a).', 'streakHour', 'streakMin']].map(([k, ic, t, sub, hk, mk]) => (
            <View key={k} style={[s.row, { flexDirection: 'column', alignItems: 'stretch', gap: 2 }]}>
              <View style={[s.rowi, { flexWrap: 'nowrap', gap: 12 }]}><Ic n={ic} s={22} c={C.moss} /><View style={{ flex: 1 }}><Text style={s.b}>{t}</Text><Text style={s.sm}>{sub}</Text></View><Sw label={t} v={!!settings[k]} on={(v) => toggleNotif(k, v)} /></View>
              {!!settings[k] && <><Text style={[s.sm, { textAlign: 'center', marginTop: 6 }]}>Čas oznámení</Text><TimeRow h={settings[hk]} m={settings[mk]} onChange={(h, m) => onSet({ [hk]: h, [mk]: m })} /></>}
            </View>))}
          <View style={s.row}>
            <Ic n="map-marker-check-outline" s={22} c={C.moss} />
            <View style={{ flex: 1 }}><Text style={s.b}>Strom v okolí (při otevřené appce)</Text><Text style={s.sm}>Upozorní, když se přiblížíš k nenavštívenému stromu.</Text></View>
            <Sw label="Upozornění na strom v okolí při otevřené aplikaci" v={settings.nearbyNotif} on={(v) => toggleNotif('nearbyNotif', v)} />
          </View>
          <View style={[s.row, { flexDirection: 'column', alignItems: 'stretch', gap: 2 }]}>
            <View style={[s.rowi, { flexWrap: 'nowrap', gap: 12 }]}><Ic n="radar" s={22} c={C.moss} /><View style={{ flex: 1 }}><Text style={s.b}>Strom v okolí i při zavřené appce</Text><Text style={s.sm}>Vyžaduje polohu „vždy“. Poloha zůstává v telefonu.</Text></View><Sw label="Upozornění na strom v okolí při zavřené aplikaci" v={!!settings.bgNearby} on={toggleBg} /></View>
            {!!settings.bgNearby && <><Text style={[s.sm, { marginTop: 6 }]}>Upozornit, když jsem blíž než</Text><Presets v={settings.nearbyRadius || 150} onChange={(nearbyRadius) => onSet({ nearbyRadius })} opts={[[100, '100 m'], [150, '150 m'], [250, '250 m'], [400, '400 m']]} /></>}
          </View>

          <H3 t="Tichý režim a baterie" style={{ marginTop: 18 }} />
          <View style={s.row}><Ic n="weather-night" s={22} c={C.moss}/><View style={{ flex: 1 }}><Text style={s.b}>Ztišit upozornění na stromy v noci</Text><Text style={s.sm}>Geofence zůstane aktivní, ale blízká oznámení se přeskočí.</Text></View><Sw label="Tichý režim upozornění na stromy" v={!!settings.quietMode} on={(quietMode) => onSet({ quietMode })}/></View>
          {!!settings.quietMode && <><Text style={[s.sm, { marginTop: 8 }]}>Ticho od</Text><TimeRow h={settings.quietStart ?? 22} m={0} onChange={(quietStart) => onSet({ quietStart })}/><Text style={[s.sm, { marginTop: 8 }]}>Ticho do</Text><TimeRow h={settings.quietEnd ?? 7} m={0} onChange={(quietEnd) => onSet({ quietEnd })}/></>}
          <View style={s.card}><Text style={s.b}>Geofence a baterie</Text><Text style={s.sm}>{settings.bgNearby ? `${geoStatus?.active ? 'Aktivní' : 'Čeká na polohu'} · ${Number.isFinite(geoStatus?.count) ? geoStatus.count : 'počet oblastí zatím nezměřen'} sledovaných oblastí · poloměr ${settings.nearbyRadius || 150} m. Android kontroluje vstup do oblastí systémově; aplikace neběží průběžně na GPS.` : 'Geofence je vypnutý. Bez sledování polohy na pozadí.'}</Text><Text style={[s.sm, { marginTop: 4 }]}>Odhad dopadu: {settings.bgNearby ? 'nízký; spotřeba závisí na zařízení, přesunu a počtu aktivních oblastí' : 'žádný'}</Text><Text style={[s.sm, { marginTop: 4 }]}>Při poklesu baterie pod 5 % se poloha na pozadí automaticky vypne.</Text></View>
          {Platform.OS === 'android' && <View style={s.row}><Ic n="theme-light-dark" s={22} c={C.moss}/><View style={{ flex: 1 }}><Text style={s.b}>Tmavý režim (Android)</Text><Text style={s.sm}>Pouze tato aplikace, nezávisle na vzhledu systému.</Text></View><Sw label="Tmavý režim Android aplikace" v={!!settings.darkMode} on={(darkMode) => onSet({ darkMode })}/></View>}
          <View style={s.row}><Ic n="human-child" s={22} c={C.moss}/><View style={{ flex: 1 }}><Text style={s.b}>Jednoduchý rodinný režim</Text><Text style={s.sm}>Společné cíle a hádanky bez soutěžního žebříčku.</Text></View><Sw label="Jednoduchý rodinný režim" v={!!settings.familyMode} on={(familyMode) => onSet({ familyMode })}/></View>

          {!!me && (<>
            <H3 t="Soukromí profilu" style={{ marginTop: 18 }} />
            <Text style={[s.sm, { marginTop: 4 }]}>Vyber, co o tobě uvidí ostatní. Hodnocení, poznámka a fotky přidané přímo u stromu zůstávají u stromu viditelné pod tvým jménem.</Text>
            {PRIV.map(([k, ic, t, sub]) => (
              <View key={k} style={s.row}>
                <Ic n={ic} s={22} c={priv[k] ? C.moss : C.mute} />
                <View style={{ flex: 1 }}><Text style={s.b}>{t}</Text>{!!sub && <Text style={s.sm}>{sub}</Text>}</View>
                <Sw label={t} v={priv[k]} on={(v) => togglePriv(k, v)} />
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
function FilterModal({ init, points, visited, taken, species, dendro, loadTaken, onApply, onClose, favorites, isPlus, onPlus }) {
  const [f, setF] = useState(init);
  useEffect(() => { loadTaken(false); }, []);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const cnt = useMemo(() => new Set(applyFilter(points, f, visited, taken, favorites, isPlus).map((p) => p[0])).size, [f, points, visited, taken, favorites, isPlus]);
  const togSp = (n) => set({ sp: f.sp.includes(n) ? f.sp.filter((x) => x !== n) : [...f.sp, n] });
  const countryOpts = useMemo(() => { const c = {}; points.forEach((p) => { const k = treeCountry(p[0], p[10]); c[k] = (c[k] || 0) + 1; }); return COUNTRIES.filter(([k]) => c[k]).map(([k, n]) => [k, `${n} (${c[k]})`]); }, [points]);
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
            {countryOpts.length > 1 && <Sec ic="earth" t="Země"><Presets v={f.co || 'all'} onChange={(v) => set({ co: v })} opts={[['all', 'Všechny'], ...countryOpts]} /></Sec>}
            <Sec ic="shield-star-outline" t="Druh stromů na mapě"><View style={{ marginTop: 8 }}><Seg v={f.pt || 'all'} onChange={(v) => set({ pt: v })} opts={[['all', 'Všechny'], ['patron', 'Patronské'], ['plain', 'Nepatronské']]} /></View></Sec>
            <Sec ic="star-circle-outline" t={`Prvonávštěva (+${isPlus ? 75 : 50} b v letošním roce)`}>
              <View style={{ marginTop: 8 }}><Seg v={f.fv} onChange={(v) => set({ fv: v })} opts={[['all', 'Vše'], ['free', 'K dispozici'], ['taken', 'Obsazená']]} /></View>
              {f.fv !== 'all' && !taken && <Text style={[s.sm, { marginTop: 6, color: '#8a3a22' }]}>Údaje o prvonávštěvách se nepodařilo načíst (jsi online?) – filtr se zatím nepoužije.</Text>}
              {f.fv !== 'all' && !!taken && <Text style={[s.sm, { marginTop: 6 }]}>{f.fv === 'free' ? 'Stromy, které letos ještě nikdo neodkliknul.' : 'Stromy, které už letos někdo odkliknul.'}</Text>}
            </Sec>
            {!isPlus ? <PlusLock title="Pokročilé filtry stromů" detail="Filtruj druhy podle výšky, stáří a obvodu kmene." onPress={onPlus} /> : <>
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
            </>}
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
function OfflineModal({ onClose, meta, queue, onTrees, onSync, onSettings, settings, toast, msg }) {
  const upd = UPD.find((x) => x[0] === settings.upd) || UPD[0];
  const clearCache = () => Alert.alert('Vyčistit mezipaměť mapy?', 'Mapa se pak zase postupně stáhne z internetu.', [
    { text: 'Zrušit', style: 'cancel' },
    { text: 'Vyčistit', style: 'destructive', onPress: async () => { try { await ML.OfflineManager.clearAmbientCache(); toast('Mezipaměť mapy vyčištěna', 'map-check-outline'); } catch (e) { toast('Mezipaměť se nepodařilo vyčistit', 'alert-circle-outline'); } } },
  ]);
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
          <View style={s.card}>
            <View style={s.rowi}><Ic n="map-check-outline" s={20} c={C.moss} /><Text style={[s.b, { flex: 1 }]}>Prohlédnuté oblasti zůstávají v telefonu</Text></View>
            <Text style={s.sm}>Mapa si sama pamatuje místa, která jsi už viděl(a), takže je uvidíš i bez signálu. Stromy a tvoje návštěvy fungují offline vždy.</Text>
            <Btn ghost icon="broom" title="Vyčistit mezipaměť mapy" onPress={clearCache} />
          </View>
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
const MapBase = React.memo(function MapBase({ mapRef, cam, src, geo, range, meF, heatF, onPress, tabh, rot, ctop, initCam, onRegion, fogOn, fogF, onFog, layerId, layerReady, onFail }) {
  const info = useLayerInfo(layerId);
  const shownId = info.error ? 'liberty' : layerId;
  const font = info.font;
  const mapStyle = useMemo(() => styleFor(LAYER_BY_ID[layerId], info), [layerId, info]);
  const cp = useMemo(() => ({ top: ctop, right: 12 }), [ctop]);
  const lCln = useMemo(() => L_CLN(font), [font]);
  const lFog = useMemo(() => L_FOG_TXT(font), [font]);
  if (!layerReady || !info.ready) return <View style={{ flex: 1, backgroundColor: C.cream }} />;
  return (
    <View style={{ flex: 1 }}>
    <ML.Map key={shownId} ref={mapRef} style={{ flex: 1 }} mapStyle={mapStyle} logo={false} attribution={false} scaleBar={false} touchRotate={rot} compass={rot} compassHiddenFacingNorth compassPosition={cp} onRegionDidChange={onRegion} onDidFailLoadingMap={onFail}>
      <ML.Camera ref={cam} initialViewState={initCam} />
      <ML.Images images={MAP_IMAGES} />
      {fogOn && !!fogF && <ML.GeoJSONSource id="fog" data={fogF} onPress={onFog}>
        <ML.Layer type="fill" id="fog-base" source="fog" paint={P_FOG_BASE} />
        <ML.Layer type="fill" id="fog-mist" source="fog" paint={P_FOG_MIST} />
        <ML.Layer type="line" id="fog-glow" source="fog" paint={P_FOG_GLOW} />
        <ML.Layer type="line" id="fog-line" source="fog" paint={P_FOG_LINE} />
        {!!font && <ML.Layer type="symbol" id="fog-txt" source="fog" maxzoom={10} layout={lFog} paint={P_FOG_TXT} />}
      </ML.GeoJSONSource>}
      <ML.GeoJSONSource id="range" data={range}>
        <ML.Layer type="fill" id="range-f" source="range" paint={P_RANGE_F} />
        <ML.Layer type="line" id="range-l" source="range" paint={P_RANGE_L} />
      </ML.GeoJSONSource>
      <ML.GeoJSONSource id="trees" ref={src} data={geo} cluster clusterRadius={46} clusterMaxZoom={12} maxzoom={14} buffer={64} onPress={onPress} hitbox={HIT}>
        <ML.Layer type="circle" id="cl" source="trees" filter={F_CL} paint={P_CL} />
        {!!font && <ML.Layer type="symbol" id="cln" source="trees" filter={F_CL} layout={lCln} paint={P_CLN} />}
        <ML.Layer type="circle" id="pt-h" source="trees" filter={F_PT} paint={P_PTH} />
        <ML.Layer type="circle" id="pt" source="trees" filter={F_PT} paint={P_PT} />
        <ML.Layer type="symbol" id="pt-ok" source="trees" minzoom={11} filter={F_OK} layout={L_OK} />
      </ML.GeoJSONSource>
      <ML.GeoJSONSource id="me" data={meF}>
        <ML.Layer type="circle" id="me-h" source="me" paint={P_MEH} />
        <ML.Layer type="circle" id="me-d" source="me" paint={P_MED} />
      </ML.GeoJSONSource>
      {!!heatF && <ML.GeoJSONSource id="visit-heat" data={heatF}><ML.Layer type="heatmap" id="visit-heat-layer" source="visit-heat" paint={P_HEAT} /></ML.GeoJSONSource>}
    </ML.Map>
    <AttrChip layer={shownId} style={{ left: 8, bottom: tabh + 4 }} />
    </View>
  );
});

const Fab = React.memo(({ bottom, icon, onPress, badge, badgeColor }) => (
  <T style={[s.fab, { bottom }]} onPress={onPress} activeOpacity={0.8}>
    <Ic n={icon} s={24} c={C.forest} />
    {badge > 0 && <View style={[s.fbadge, { backgroundColor: badgeColor || C.red }]}><Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{badge}</Text></View>}
  </T>
));

/* ============================== verze 1.6.0: infrastruktura ============================== */
/* seznam stromů v souboru (ne v AsyncStorage: žádný limit velikosti řádku a menší špička paměti při startu) */
const TREES_FILE = FileSystem.documentDirectory + 'sb_trees.json';
const writeTreesCache = (pts) => FileSystem.writeAsStringAsync(TREES_FILE, JSON.stringify(pts));
async function readTreesCache() {
  try {
    const info = await FileSystem.getInfoAsync(TREES_FILE);
    if (info.exists) { const pts = jparse(await FileSystem.readAsStringAsync(TREES_FILE), null); if (pts) return pts; }
  } catch (e) {}
  try {   // jednorázová migrace ze starého uložení
    const old = await AsyncStorage.getItem('sb_trees');
    if (old) { const pts = jparse(old, null); if (pts) { await writeTreesCache(pts); AsyncStorage.removeItem('sb_trees').catch(() => {}); } return pts; }
  } catch (e) {}
  return null;
}

/* mřížka bodů (buňka ≈ 2 km): hledání nejbližších stromů prochází jen okolní buňky místo všech bodů */
const GRID = 0.02, GK = 100000;
function buildGrid(points) {
  const g = new Map();
  for (let i = 0; i < points.length; i++) {
    const p = points[i], k = Math.floor(p[2] / GRID) * GK + Math.floor(p[3] / GRID);
    const a = g.get(k); if (a) a.push(i); else g.set(k, [i]);
  }
  return g;
}
/* vrací [[d2, bod], …] seřazené podle vzdálenosti (d2 = čtverec vzdálenosti v m²); bez nenavštívených v okolí padá na úplný průchod */
function nearestUnvisited(points, grid, visited, pos, K, maxRing = 9) {
  const kx = Math.cos(pos.lat * rad) * 111320, ky = 110540;
  const best = []; let worst = Infinity;
  const consider = (p) => {
    if (visited.has(p[0])) return;
    const dx = (p[2] - pos.lon) * kx, dy = (p[3] - pos.lat) * ky, d2 = dx * dx + dy * dy;
    if (best.length >= K && d2 >= worst) return;
    let i = best.length; best.push(null);
    while (i > 0 && best[i - 1][0] > d2) { best[i] = best[i - 1]; i--; }
    best[i] = [d2, p];
    if (best.length > K) best.pop();
    if (best.length === K) worst = best[K - 1][0];
  };
  const cx = Math.floor(pos.lon / GRID), cy = Math.floor(pos.lat / GRID), cell = Math.min(GRID * kx, GRID * ky);
  for (let r = 0; r <= maxRing; r++) {
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const a = grid.get((cx + dx) * GK + (cy + dy));
      if (a) for (let i = 0; i < a.length; i++) consider(points[a[i]]);
    }
    if (best.length >= K && worst <= (r * cell) * (r * cell)) break;
  }
  if (best.length < Math.min(K, 5)) { best.length = 0; worst = Infinity; for (let i = 0; i < points.length; i++) consider(points[i]); }
  return best;
}

/* widget: jedno místo, odkud se posílá snímek (z popředí i z úloh na pozadí) */
const WidgetNative = requireOptionalNativeModule('StromobraniWidget');
const TreeWidget = { updateSnapshot: (p) => { try { WidgetNative && WidgetNative.updateSnapshot(p); } catch (e) {} } };

/* oznámení: kanály, plánovač (denní připomenutí, strom dne, záchrana série) */
async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', { name: 'Stromobraní', importance: Notifications.AndroidImportance.DEFAULT }).catch(() => {});
  await Notifications.setNotificationChannelAsync('nearby', { name: 'Strom v okolí', importance: Notifications.AndroidImportance.HIGH }).catch(() => {});
}
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
async function syncNotifications(st, points, streak) {
  try {
    const sched = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(sched.filter((n) => String(n.identifier).startsWith('sb-')).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})));
    if (!(st.dailyReminder || st.todNotif || st.streakNotif)) return;
    const perm = await Notifications.getPermissionsAsync(); if (!perm.granted) return;
    await ensureChannels();
    const TT = Notifications.SchedulableTriggerInputTypes, now = new Date();
    if (st.dailyReminder) await Notifications.scheduleNotificationAsync({ identifier: 'sb-daily', content: { title: 'Čas na Stromobraní 🌳', body: 'Vydej se objevit další památný strom.' }, trigger: { type: TT.DAILY, hour: st.reminderHour, minute: st.reminderMin, channelId: 'default' } });
    if (st.todNotif && points.length) {
      for (let i = 0; i < 7; i++) {
        const t = new Date(now); t.setDate(t.getDate() + i); t.setHours(st.todHour, st.todMin, 0, 0);
        if (t <= now) continue;
        const day = Math.floor(t.getTime() / 864e5), p = points[(day * 7919) % points.length];
        await Notifications.scheduleNotificationAsync({ identifier: 'sb-tod-' + day, content: { title: 'Strom dne 🌟', body: `${p[1]} · za dnešní odklik +10 b navíc`, data: { kod: p[0] } }, trigger: { type: TT.DATE, date: t, channelId: 'default' } });
      }
    }
    if (st.streakNotif && streak && streak.current > 0) {
      for (let i = 0; i < 2; i++) {
        const t = new Date(now); t.setDate(t.getDate() + i); t.setHours(st.streakHour, st.streakMin, 0, 0);
        if (t <= now || (i === 0 && streak.today)) continue;
        await Notifications.scheduleNotificationAsync({ identifier: 'sb-streak-' + i, content: { title: `Série ${streak.current} dní 🔥`, body: 'Odklikni dnes aspoň jeden strom, ať o sérii nepřijdeš.' }, trigger: { type: TT.DATE, date: t, channelId: 'default' } });
      }
    }
  } catch (e) {}
}

/* oznámení o stromu v okolí i při zavřené appce: geofencing (bez stálé notifikace, šetří baterii).
   Hlídá se ~90 nejbližších nenavštívených stromů + velká „obnovovací“ zóna; po jejím opuštění se sada přepočítá. */
const GEO_TASK = 'sb-geofence', GEO_REFRESH = 'sb-refresh';
const BG_LOW_BATTERY_KEY = 'sb_bg_low_battery_disabled';
async function enforceBgBatteryLimit(settings) {
  if (!settings?.bgNearby) return false;
  try {
    const level = await Battery.getBatteryLevelAsync();
    if (!Number.isFinite(level) || level < 0 || level >= 0.05) return false;
    await stopGeofences();
    await AsyncStorage.setItem('sb_settings', JSON.stringify({ ...settings, bgNearby: false }));
    await AsyncStorage.setItem(BG_LOW_BATTERY_KEY, String(Date.now()));
    return true;
  } catch (e) { return false; }
}
async function bgData() {
  const pts = (await readTreesCache()) || [], me = jparse(await AsyncStorage.getItem('sb_me'), null);
  return { pts, visited: new Set((me && me.visited) || []) };
}
async function setupGeofences(center) {
  try {
    const st = jparse(await AsyncStorage.getItem('sb_settings'), {});
    if (!st.bgNearby || !center) return;
    if (await enforceBgBatteryLimit(st)) return;
    const { pts, visited } = await bgData(); if (!pts.length) return;
    const best = nearestUnvisited(pts, buildGrid(pts), visited, center, 90), seen = new Set(), regions = [];
    for (const [, p] of best) {
      if (seen.has(p[0])) continue; seen.add(p[0]);
      regions.push({ identifier: 't' + p[0], latitude: p[3], longitude: p[2], radius: st.nearbyRadius || 150, notifyOnEnter: true, notifyOnExit: false });
    }
    const far = best.length ? Math.sqrt(best[best.length - 1][0]) : 3000;
    regions.push({ identifier: GEO_REFRESH, latitude: center.lat, longitude: center.lon, radius: Math.max(800, Math.min(4000, far * 0.6)), notifyOnEnter: false, notifyOnExit: true });
    await Location.startGeofencingAsync(GEO_TASK, regions.slice(0, 99));
    await AsyncStorage.setItem('sb_geofence_status', JSON.stringify({ count: regions.length - 1, radius: st.nearbyRadius || 150, updated: Date.now() }));
    if (best[0]) TreeWidget.updateSnapshot({ ...(jparse(await AsyncStorage.getItem('sb_widget'), {})), treeName: best[0][1][1], distance: fmtD(Math.sqrt(best[0][0])), kod: best[0][1][0] });
  } catch (e) {}
}
async function stopGeofences() { try { if (await Location.hasStartedGeofencingAsync(GEO_TASK)) await Location.stopGeofencingAsync(GEO_TASK); } catch (e) {} }
TaskManager.defineTask(GEO_TASK, async ({ data, error }) => {
  if (error || !data) return;
  try {
    const prefs = jparse(await AsyncStorage.getItem('sb_settings'), {});
    if (await enforceBgBatteryLimit(prefs)) return;
    const { eventType, region } = data;
    if (eventType === Location.GeofencingEventType.Enter && String(region.identifier).startsWith('t')) {
      if (isQuietNow(prefs)) return;
      const kod = +region.identifier.slice(1), now = Date.now();
      const notified = jparse(await AsyncStorage.getItem('sb_bg_notified'), {});
      if (notified[kod] && now - notified[kod] < 12 * 36e5) return;
      const { pts, visited } = await bgData(); if (visited.has(kod)) return;
      const p = pts.find((x) => x[0] === kod);
      for (const k of Object.keys(notified)) if (now - notified[k] > 48 * 36e5) delete notified[k];
      notified[kod] = now; await AsyncStorage.setItem('sb_bg_notified', JSON.stringify(notified));
      await ensureChannels();
      await Notifications.scheduleNotificationAsync({ content: { title: 'Strom poblíž 🌳', body: p ? `${p[1]} je kousek od tebe. Zajdeš se k němu podívat?` : 'Poblíž je nenavštívený památný strom.', data: { kod } }, trigger: { channelId: 'nearby' } });
    } else if (eventType === Location.GeofencingEventType.Exit && region.identifier === GEO_REFRESH) {
      const l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await setupGeofences({ lat: l.coords.latitude, lon: l.coords.longitude });
    }
  } catch (e) {}
});
async function askBackgroundNearby() {
  const fg = await Location.requestForegroundPermissionsAsync(); if (!fg.granted) return 'Povol polohu v nastavení telefonu.';
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (!bg.granted) return 'Pro upozornění při zavřené appce vyber v nastavení polohy „Povolit vždy“.';
  const n = await Notifications.requestPermissionsAsync(); if (!n.granted) return 'Povol oznámení v nastavení telefonu.';
  await ensureChannels();
  return null;
}

/* ============================== trasy přes Valhalla (jednotná nastavení pro běžné i vícebodové trasy) ============================== */
const VALHALLA = 'https://valhalla1.openstreetmap.de';
async function valhalla(path, body) {
  const r = await fetch(VALHALLA + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Služba tras neodpověděla. Zkus to za chvíli.');
  return d;
}
const DEF_RO = { walkSpeed: 5.1, hills: 0.5, stairs: false, living: 0.6, tracks: 0, hike: 1, paved: false, ferry: false, wheelchair: false, shortest: false,
  bikeType: 'hybrid', bikeSpeed: 16, roads: 0.1, surface: 0.5, highways: 0.2, tolls: true, autoSpeed: 0, optimize: true, loop: false, minutes: 0, count: 5 };
function costingOf(profile, o) {
  if (profile === 'bicycle') return { bicycle: { bicycle_type: o.bikeType, cycling_speed: o.bikeSpeed, use_roads: o.roads, use_hills: o.hills, avoid_bad_surfaces: o.surface, use_living_streets: o.living, use_ferry: o.ferry ? 1 : 0.1, shortest: !!o.shortest } };
  if (profile === 'auto') return { auto: { use_highways: o.highways, use_tolls: o.tolls ? 0.5 : 0, use_ferry: o.ferry ? 1 : 0.1, use_living_streets: o.living > 0.5 ? 0.5 : 0.1, shortest: !!o.shortest, ...(o.autoSpeed ? { top_speed: o.autoSpeed } : {}) } };
  return { pedestrian: { walking_speed: o.walkSpeed, use_hills: o.hills, step_penalty: o.stairs ? 600 : 30, use_living_streets: o.living, use_ferry: o.ferry ? 1 : 0.1, use_tracks: o.tracks, max_hiking_difficulty: o.hike, exclude_unpaved: !!o.paved, shortest: !!o.shortest && !o.wheelchair, type: o.wheelchair ? 'wheelchair' : 'foot' } };
}
const PROFILE_LABEL = { pedestrian: 'Pěší trasa', bicycle: 'Cyklistická trasa', auto: 'Trasa autem' };
const inRing = (pt, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
const inPoly = (pt, g) => (g.type === 'Polygon' ? inRing(pt, g.coordinates[0]) : g.coordinates.some((poly) => inRing(pt, poly[0])));

function RouteOptions({ profile, o, set }) {
  const [open, setOpen] = useState(false);
  const P = (k, opts) => <Presets v={o[k]} opts={opts} onChange={(v) => set({ [k]: v })} />;
  const Tg = (k, label) => <T key={k} onPress={() => set({ [k]: !o[k] })} style={[s.chip, o[k] && s.chipOn]}><Text style={[s.chipT, o[k] && { color: '#fff' }]}>{label}</Text></T>;
  const L = ({ t }) => <Text style={[s.sm, { marginTop: 10, fontWeight: '800' }]}>{t}</Text>;
  const HILL = [[0.1, 'Co nejrovněji'], [0.5, 'Vyváženě'], [0.9, 'Kopce nevadí']];
  const LIV = [[0.2, 'Hlavní ulice'], [0.6, 'Vyváženě'], [1, 'Klidné ulice']];
  return (
    <View style={{ marginTop: 6 }}>
      <T onPress={() => setOpen((v) => !v)} style={[s.rowi, { justifyContent: 'space-between', paddingVertical: 8 }]}>
        <View style={s.rowi}><Ic n="tune-variant" s={18} c={C.forest} /><Text style={s.b}>Možnosti trasy</Text></View>
        <Ic n={open ? 'chevron-up' : 'chevron-down'} s={22} c={C.mute} />
      </T>
      {open && <View>
        {profile === 'pedestrian' && <>
          <L t="Tempo chůze" />{P('walkSpeed', [[3.5, 'Pomalu 3,5'], [5.1, 'Běžně 5,1'], [6.5, 'Rychle 6,5']])}
          <L t="Převýšení" />{P('hills', HILL)}
          <L t="Ulice" />{P('living', LIV)}
          <L t="Povrch a stezky" />{P('tracks', [[0, 'Raději silnice'], [0.5, 'Vyváženě'], [1, 'Lesní cesty a stezky']])}
          <L t="Nejnáročnější stezky" />{P('hike', [[1, 'Snadné'], [3, 'Horské stezky'], [6, 'Cokoli']])}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>{Tg('paved', 'Jen zpevněné')}{Tg('stairs', 'Vyhnout se schodům')}{Tg('wheelchair', 'Bezbariérová')}{Tg('ferry', 'Povolit přívozy')}{Tg('shortest', 'Nejkratší vzdálenost')}</View>
        </>}
        {profile === 'bicycle' && <>
          <L t="Typ kola" />{P('bikeType', [['hybrid', 'Trekové'], ['road', 'Silniční'], ['mountain', 'Horské'], ['city', 'Městské']])}
          <L t="Rychlost jízdy" />{P('bikeSpeed', [[12, '12 km/h'], [16, '16 km/h'], [20, '20 km/h'], [25, '25 km/h']])}
          <L t="Silnice × stezky" />{P('roads', [[0.1, 'Cyklostezky'], [0.5, 'Vyváženě'], [0.85, 'Silnice']])}
          <L t="Převýšení" />{P('hills', HILL)}
          <L t="Kvalita povrchu" />{P('surface', [[0, 'Je mi to jedno'], [0.5, 'Vyhnout se špatnému'], [1, 'Jen kvalitní']])}
          <L t="Ulice" />{P('living', LIV)}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>{Tg('ferry', 'Povolit přívozy')}{Tg('shortest', 'Nejkratší vzdálenost')}</View>
        </>}
        {profile === 'auto' && <>
          <L t="Dálnice" />{P('highways', [[0, 'Vyhnout se'], [0.2, 'Vyváženě'], [0.8, 'Preferovat']])}
          <L t="Nejvyšší rychlost" />{P('autoSpeed', [[0, 'Bez omezení'], [90, '90 km/h'], [110, '110 km/h'], [130, '130 km/h']])}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>{Tg('tolls', 'Povolit placené úseky')}{Tg('ferry', 'Povolit přívozy')}{Tg('shortest', 'Nejkratší vzdálenost')}</View>
        </>}
        <Text style={[s.sm, { marginTop: 8, fontSize: 11 }]}>Nastavení se pamatuje. Výpočet běží na veřejném serveru Valhalla.</Text>
      </View>}
    </View>
  );
}

const nnOrder = (start, stops) => {
  const rest = [...stops], out = []; let cur = [start.lon, start.lat];
  while (rest.length) {
    let bi = 0, bd = Infinity;
    rest.forEach((p, i) => { const d = hav(cur[1], cur[0], p[3], p[2]); if (d < bd) { bd = d; bi = i; } });
    const [p] = rest.splice(bi, 1); out.push(p); cur = [p[2], p[3]];
  }
  return out;
};
const kmTxt = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`);
const durTxt = (sec) => { const m = Math.max(1, Math.round(sec / 60)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
function sunsetAt(lat, lon, date = new Date()) {
  const N = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 0)) / 86400000), lngHour = lon / 15;
  const t = N + ((18 - lngHour) / 24), M = 0.9856 * t - 3.289;
  const L = (M + 1.916 * Math.sin(M * Math.PI / 180) + 0.020 * Math.sin(2 * M * Math.PI / 180) + 282.634 + 360) % 360;
  let RA = Math.atan(0.91764 * Math.tan(L * Math.PI / 180)) * 180 / Math.PI; RA = (RA + 360) % 360; RA += Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90; RA /= 15;
  const sinDec = 0.39782 * Math.sin(L * Math.PI / 180), cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(90.833 * Math.PI / 180) - sinDec * Math.sin(lat * Math.PI / 180)) / (cosDec * Math.cos(lat * Math.PI / 180));
  if (cosH < -1 || cosH > 1) return null;
  const H = Math.acos(cosH) * 180 / Math.PI / 15, UT = (H + RA - 0.06571 * t - 6.622 - lngHour + 24) % 24;
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) + UT * 3600000);
}
function distPointSegmentMeters(lat, lon, a, b) {
  const scale = Math.cos(lat * Math.PI / 180), px = lon * scale, py = lat, ax = a[0] * scale, ay = a[1], bx = b[0] * scale, by = b[1];
  const dx = bx - ax, dy = by - ay, den = dx * dx + dy * dy, t = den ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / den)) : 0;
  return hav(lat, lon, ay + t * dy, (ax + t * dx) / scale);
}
function distRouteMeters(lat, lon, route) {
  let best = Infinity;
  for (let i = 1; i < route.length; i++) { const d = distPointSegmentMeters(lat, lon, route[i - 1], route[i]); if (d < best) best = d; }
  return best;
}

/* plánovač výletu přes více stromů: výběr ručně / nejbližší / podle dosahu (Valhalla isochrone), řazení zastávek (optimized_route), okružní trasa */
function TripPlanner({ onClose, pos, points, grid, visited, ro, setRo, toast, onShare }) {
  const [profile, setProfile] = useState('pedestrian');
  const [gpxRoute, setGpxRoute] = useState(null), [routeRadius, setRouteRadius] = useState(500);
  const [borderTrip, setBorderTrip] = useState(false);
  const cand = useMemo(() => {
    if (!pos && !gpxRoute) return [];
    const seen = new Set(), out = [];
    const source = gpxRoute ? points.map((p) => [0, p]) : nearestUnvisited(points, grid, visited, pos, 300);
    for (const [, p] of source) { if (seen.has(p[0]) || visited.has(p[0])) continue; seen.add(p[0]); const routeD = gpxRoute ? distRouteMeters(p[3], p[2], gpxRoute) : null; out.push({ p, d: pos ? hav(pos.lat, pos.lon, p[3], p[2]) : routeD, routeD }); }
    if (gpxRoute) out.sort((a, b) => a.routeD - b.routeD);
    return out;
  }, [points, grid, visited, pos, gpxRoute]);
  const [sel, setSel] = useState(() => cand.slice(0, 4).map((c) => c.p[0]));
  useEffect(() => { if (gpxRoute) setSel(cand.filter((c) => c.routeD <= routeRadius).slice(0, 4).map((c) => c.p[0])); }, [gpxRoute]);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const setO = (patch) => setRo((o) => ({ ...o, ...patch }));
  const importGpx = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ['application/gpx+xml', 'application/xml', 'text/xml', '*/*'], copyToCacheDirectory: true });
      if (picked.canceled) return;
      const info = await FileSystem.getInfoAsync(picked.assets[0].uri);
      if (info.size > 10 * 1024 * 1024) throw new Error('GPX soubor je příliš velký (limit 10 MB).');
      const xml = await FileSystem.readAsStringAsync(picked.assets[0].uri), coords = [];
      for (const m of xml.matchAll(/<(?:[\w.-]+:)?(?:trkpt|rtept|wpt)\b([^>]*)>/gi)) {
        const lat = m[1].match(/\blat=["']([+-]?[\d.]+)["']/i)?.[1], lon = m[1].match(/\blon=["']([+-]?[\d.]+)["']/i)?.[1];
        if (lat != null && lon != null && Number.isFinite(+lat) && Number.isFinite(+lon)) coords.push([+lon, +lat]);
      }
      if (coords.length < 2) throw new Error('V GPX souboru není trasa s alespoň dvěma body.');
      const step = Math.max(1, Math.ceil(coords.length / 1200)), route = coords.filter((_, i) => i % step === 0);
      if (route[route.length - 1] !== coords[coords.length - 1]) route.push(coords[coords.length - 1]);
      setGpxRoute(route); toast(`Trasa načtena (${coords.length} bodů).`, 'map-marker-path');
    } catch (e) { toast(e.message || 'Soubor GPX se nepodařilo načíst.', 'alert-circle-outline'); }
  };
  const sunsetPos = pos || (gpxRoute ? { lat: gpxRoute[0][1], lon: gpxRoute[0][0] } : null), sunset = sunsetPos ? sunsetAt(sunsetPos.lat, sunsetPos.lon) : null;
  const shownCandidates = cand.filter((c) => (!gpxRoute || c.routeD <= routeRadius) && (!borderTrip || ['AT', 'DE', 'PL', 'SK'].includes(treeCountry(c.p[0], c.p[10])))).slice(0, 80);
  const toggle = (k) => setSel((a) => (a.includes(k) ? a.filter((x) => x !== k) : a.length >= 12 ? (toast('Nejvýš 12 zastávek.', 'alert-circle-outline'), a) : [...a, k]));
  const autoPick = async () => {
    if (!ro.minutes) { setSel(shownCandidates.slice(0, ro.count).map((c) => c.p[0])); return; }
    setBusy(true);
    try {
      const iso = await valhalla('/isochrone', { locations: [{ lat: pos.lat, lon: pos.lon }], costing: profile, costing_options: costingOf(profile, ro), contours: [{ time: ro.minutes }], polygons: true });
      const polys = (iso.features || []).filter((f) => f.geometry && /Polygon/.test(f.geometry.type));
      const inside = shownCandidates.filter((c) => polys.some((f) => inPoly([c.p[2], c.p[3]], f.geometry)));
      setSel(inside.slice(0, ro.count).map((c) => c.p[0]));
      toast(inside.length ? `V dosahu ${ro.minutes} min je ${inside.length} stromů` : 'V tomto dosahu nic není. Zkus delší čas.', 'map-clock-outline');
    } catch (e) { toast(e.message, 'alert-circle-outline'); }
    setBusy(false);
  };
  const compute = async () => {
    const chosen = sel.map((k) => cand.find((c) => c.p[0] === k)).filter((c) => c && (!gpxRoute || c.routeD <= routeRadius) && (!borderTrip || ['AT', 'DE', 'PL', 'SK'].includes(treeCountry(c.p[0], c.p[10])))).map((c) => c.p);
    if (!chosen.length) return toast('Vyber aspoň jednu zastávku.', 'alert-circle-outline');
    const start = pos ? { lat: pos.lat, lon: pos.lon } : { lat: gpxRoute[0][1], lon: gpxRoute[0][0] }, loc = (p) => ({ lat: p[3], lon: p[2] });
    const order = ro.optimize && chosen.length > 2 ? nnOrder(start, chosen) : chosen;
    const locations = [start, ...order.map(loc)]; if (ro.loop) locations.push(start);
    const maps = () => {
      const stops = order.slice(0, 9).map((p) => `${p[3]},${p[2]}`);
      const dest = ro.loop ? `${pos.lat},${pos.lon}` : stops.pop();
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&origin=${pos.lat},${pos.lon}&destination=${dest}&waypoints=${encodeURIComponent(stops.join('|'))}&travelmode=${profile === 'bicycle' ? 'bicycling' : profile === 'auto' ? 'driving' : 'walking'}`).catch(() => {});
    };
    setBusy(true);
    try {
      const path = ro.optimize && locations.length > 3 ? '/optimized_route' : '/route';
      const data = await valhalla(path, { locations, costing: profile, costing_options: costingOf(profile, ro), units: 'kilometers', language: 'cs-CZ' });
      if (!data.trip || !data.trip.summary) throw new Error('Služba nevrátila trasu.');
      let ord = order; const tl = data.trip.locations || [];
      if (path === '/optimized_route' && tl.length === locations.length) ord = tl.slice(1, ro.loop ? -1 : undefined).map((l) => order[l.original_index - 1]).filter(Boolean);
      setRes({ data, order: ord, profile, start, loop: ro.loop });
    } catch (e) {
      Alert.alert('Trasu se nepodařilo spočítat', (e.message || '') + '\nMůžu otevřít zastávky v mapové aplikaci.', [{ text: 'Zrušit', style: 'cancel' }, { text: 'Otevřít Mapy', onPress: maps }]);
    }
    setBusy(false);
  };
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#1f3d2bcc', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.paper, maxHeight: '94%', borderTopLeftRadius: 26, borderTopRightRadius: 26 }}>
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
            <View style={[s.rowi, { justifyContent: 'space-between' }]}><Text style={s.h2}>Výlet přes více stromů</Text><T onPress={onClose} hitSlop={10}><Ic n="close" s={24} c={C.forest} /></T></View>
            <Btn ghost icon="file-import-outline" title={gpxRoute ? `GPX načteno · ${gpxRoute.length} bodů` : 'Importovat GPX z Mapy.cz nebo Locusu'} onPress={importGpx} />
            {!pos && !gpxRoute ? <Text style={s.warn}>Zapni GPS, nebo importuj GPX trasu.</Text> : (<>
              <Seg v={profile} onChange={setProfile} opts={[['pedestrian', 'Pěšky'], ['bicycle', 'Kolo'], ['auto', 'Auto']]} />
              <View style={[s.card, { marginTop: 10, marginBottom: 2 }]}><Text style={s.b}>Světlo na výpravu</Text><Text style={s.sm}>{sunset ? `Západ slunce přibližně ${sunset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Zlatá hodina začíná asi ${new Date(sunset.getTime() - 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : 'Dnes zde slunce nezapadá nebo nevychází.'}</Text></View>
              {!!gpxRoute && <><Text style={[s.sm, { marginTop: 8 }]}>Nenavštívené stromy do {routeRadius} m od trasy</Text><Presets v={routeRadius} onChange={setRouteRadius} opts={[[100, '100 m'], [250, '250 m'], [500, '500 m'], [1000, '1 km']]} /><Btn ghost title="Zrušit importovanou trasu" onPress={() => setGpxRoute(null)} /></>}
              <Btn ghost icon="earth" title={borderTrip ? 'Příhraniční výlet: zapnuto' : 'Příhraniční výlet · sousední země'} onPress={() => setBorderTrip((v) => !v)} />
              <Text style={[s.sm, { marginTop: 12, fontWeight: '800' }]}>Kolik stromů vybrat automaticky</Text>
              <Presets v={ro.count} onChange={(count) => setO({ count })} opts={[[3, '3'], [5, '5'], [8, '8'], [12, '12']]} />
              <Text style={[s.sm, { marginTop: 10, fontWeight: '800' }]}>Dosah z tvé polohy</Text>
              <Presets v={ro.minutes} onChange={(minutes) => setO({ minutes })} opts={[[0, 'Nejbližší'], [15, '15 min'], [30, '30 min'], [45, '45 min'], [60, '60 min']]} />
              <Btn ghost icon="auto-fix" title={busy ? 'Vybírám…' : 'Vybrat stromy automaticky'} disabled={busy || !pos} onPress={autoPick} />
              <Text style={[s.b, { marginTop: 14 }]}>Zastávky ({sel.length}/12)</Text>
              {shownCandidates.map((c) => { const on = sel.includes(c.p[0]); return (
                <T key={c.p[0]} style={[s.row, on && { borderColor: C.moss, backgroundColor: '#eef6e4' }]} onPress={() => toggle(c.p[0])}>
                  <Ic n={on ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} s={24} c={on ? C.moss : C.mute} />
                  <View style={{ flex: 1 }}><Text style={s.b} numberOfLines={1}>{c.p[1]}</Text><Text style={s.sm}>{c.p[4] || 'Strom'}</Text></View>
                  <Text style={s.sm}>{gpxRoute ? `${fmtD(c.routeD)} od trasy` : fmtD(c.d)}</Text>
                </T>); })}
              {!cand.length && <Text style={s.sm}>V okolí nejsou žádné nenavštívené stromy.</Text>}
              {!!borderTrip && !shownCandidates.length && <Text style={s.sm}>Stažený katalog zatím neobsahuje nenavštívené stromy ze sousedních zemí. Po doplnění GeoJSON s kódy zemí se zde objeví.</Text>}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                <T onPress={() => setO({ optimize: !ro.optimize })} style={[s.chip, ro.optimize && s.chipOn]}><Text style={[s.chipT, ro.optimize && { color: '#fff' }]}>Seřadit zastávky nejlépe</Text></T>
                <T onPress={() => setO({ loop: !ro.loop })} style={[s.chip, ro.loop && s.chipOn]}><Text style={[s.chipT, ro.loop && { color: '#fff' }]}>Okruh zpět na start</Text></T>
              </View>
              <RouteOptions profile={profile} o={ro} set={setO} />
              <Btn icon="map-marker-path" title={busy ? 'Počítám…' : 'Vypočítat trasu'} disabled={busy || !sel.length} onPress={compute} />
            </>)}
          </ScrollView>
        </View>
      </View>
      {!!res && <TripRouteModal res={res} points={points} onClose={() => setRes(null)} onShare={(kods) => { setRes(null); onClose(); onShare(kods); }} toast={toast} />}
    </Modal>
  );
}

function TripRouteModal({ res, points, onClose, onShare, toast }) {
  const { data, order, profile, start, loop } = res;
  const legs = data.trip.legs || [], sum = data.trip.summary;
  const coords = useMemo(() => legs.flatMap((l) => (l.shape ? decodePolyline6(l.shape) : [])), [res]);
  const line = useMemo(() => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }), [coords]);
  const stopsF = useMemo(() => fc(order.map((p, i) => pointF(p[2], p[3], { n: String(i + 1) }))), [res]);
  const bounds = coords.length ? coords.reduce((b, [lo, la]) => ({ w: Math.min(b.w, lo), e: Math.max(b.e, lo), s: Math.min(b.s, la), n: Math.max(b.n, la) }), { w: 180, e: -180, s: 90, n: -90 }) : null;
  const exportGpx = async () => {
    try {
      await shareFile('stromobrani-vylet.gpx', 'application/gpx+xml', gpxOf('Výlet za stromy', order.map((p, i) => ({ lat: p[3], lon: p[2], name: `${i + 1}. ${p[1]}` })), coords));
    } catch (e) { toast(e.message || 'Export GPX se nezdařil.', 'alert-circle-outline'); }
  };
  const openMaps = () => {
    const stops = order.slice(0, 9).map((p) => `${p[3]},${p[2]}`), dest = loop ? `${start.lat},${start.lon}` : stops.pop();
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&origin=${start.lat},${start.lon}&destination=${dest}&waypoints=${encodeURIComponent(stops.join('|'))}&travelmode=${profile === 'bicycle' ? 'bicycling' : profile === 'auto' ? 'driving' : 'walking'}`).catch(() => {});
  };
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#1f3d2bcc', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.paper, maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 24 }}>
          <View style={[s.rowi, { justifyContent: 'space-between' }]}><View style={{ flex: 1 }}><Text style={s.h2}>{PROFILE_LABEL[profile]}</Text><Text style={s.sm}>{order.length} zastávek{loop ? ' · okruh' : ''} · Valhalla</Text></View><Close onPress={onClose} style={{ top: 0, right: 0 }} /></View>
          <View style={[s.card, { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 }]}>
            <View style={{ alignItems: 'center' }}><Text style={s.h3}>{kmTxt(sum.length)}</Text><Text style={s.sm}>celkem</Text></View>
            <View style={{ alignItems: 'center' }}><Text style={s.h3}>{durTxt(sum.time)}</Text><Text style={s.sm}>bez zastávek</Text></View>
          </View>
          <View style={[s.mini, { height: 230, marginTop: 4 }]}>
            {coords.length > 1 ? <MiniMap>{({ font: tripFont }) => (<>
              <ML.Camera initialViewState={{ bounds: [bounds.w, bounds.s, bounds.e, bounds.n], padding: PAD(28) }} />
              <ML.GeoJSONSource id="trip-line" data={line}><ML.Layer type="line" id="trip-line-l" source="trip-line" layout={L_ROUND} paint={P_ROUTE} /></ML.GeoJSONSource>
              <ML.GeoJSONSource id="trip-stops" data={stopsF}>
                <ML.Layer type="circle" id="trip-stops-c" source="trip-stops" paint={P_STOP} />
                {!!tripFont && <ML.Layer type="symbol" id="trip-stops-t" source="trip-stops" layout={L_STOP_T(tripFont)} paint={P_STOP_T} />}
              </ML.GeoJSONSource>
            </>)}</MiniMap> : <Text style={[s.sm, { padding: 16 }]}>Mapu trasy se nepodařilo načíst.</Text>}
          </View>
          <ScrollView style={{ flexShrink: 1, marginTop: 8 }} contentContainerStyle={{ gap: 7, paddingBottom: 6 }}>
            {legs.map((l, i) => { const p = order[i]; return (
              <View key={i} style={[s.rowi, { backgroundColor: '#f5f1e5', borderRadius: 12, padding: 10, flexWrap: 'nowrap' }]}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.sun, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#2a1d00', fontWeight: '800', fontSize: 12 }}>{p ? i + 1 : '↩'}</Text></View>
                <View style={{ flex: 1 }}><Text style={s.b} numberOfLines={1}>{p ? p[1] : 'Zpět na start'}</Text><Text style={s.sm}>{kmTxt(l.summary.length)} · {durTxt(l.summary.time)}</Text></View>
              </View>); })}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn style={{ flex: 1 }} ghost icon="export-variant" title="GPX" onPress={exportGpx} />
            <Btn style={{ flex: 1 }} ghost icon="account-group-outline" title="Týmová výprava" onPress={() => onShare(order.map((p) => p[0]))} />
          </View>
          <Btn icon="navigation-variant-outline" title="Navigovat v Mapách" onPress={openMaps} />
        </View>
      </View>
    </Modal>
  );
}

/* ============================== exporty (GPX / KML / PDF) ============================== */
const esc = (x) => String(x == null ? '' : x).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
function gpxOf(name, wpts, trk) {
  const w = wpts.map((x) => `<wpt lat="${x.lat}" lon="${x.lon}"><name>${esc(x.name)}</name>${x.desc ? `<desc>${esc(x.desc)}</desc>` : ''}${x.time ? `<time>${x.time}</time>` : ''}</wpt>`).join('');
  const t = trk && trk.length > 1 ? `<trk><name>${esc(name)}</name><trkseg>${trk.map(([lo, la]) => `<trkpt lat="${la}" lon="${lo}"/>`).join('')}</trkseg></trk>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Stromobraní" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${esc(name)}</name></metadata>${w}${t}</gpx>`;
}
function kmlOf(name, wpts) {
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(name)}</name>${wpts.map((x) => `<Placemark><name>${esc(x.name)}</name>${x.desc ? `<description>${esc(x.desc)}</description>` : ''}<Point><coordinates>${x.lon},${x.lat},0</coordinates></Point></Placemark>`).join('')}</Document></kml>`;
}
async function shareFile(fname, mime, text) {
  const uri = FileSystem.cacheDirectory + fname;
  await FileSystem.writeAsStringAsync(uri, text, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: 'Stromobraní' });
  return uri;
}

/* ============================== verze 1.6.0: komunita, série, sbírky, poznámky … ============================== */
const dny = (n) => (n === 1 ? 'den' : n >= 2 && n <= 4 ? 'dny' : 'dní');
const NeedLogin = ({ onAuth, t = 'Přihlas se, ať můžeš využít komunitní funkce.' }) => (
  <View style={[s.card, { alignItems: 'center' }]}><Ic n="account-lock-outline" s={40} c={C.mute} /><Text style={[s.sm, { textAlign: 'center', marginTop: 6 }]}>{t}</Text><Btn icon="login" title="Přihlásit se" onPress={onAuth} /></View>
);

/* čas oznámení: hodiny po 1, minuty po 5 */
const TimeRow = ({ h, m, onChange }) => {
  const step = (dh, dm) => { let mm = m + dm, hh = h + dh; if (mm >= 60) { mm -= 60; hh++; } if (mm < 0) { mm += 60; hh--; } onChange((hh + 24) % 24, mm); };
  const B = ({ ic, on }) => <T onPress={on} hitSlop={6} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.cream, borderWidth: 1.5, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}><Ic n={ic} s={20} c={C.forest} /></T>;
  const N = ({ v }) => <Text style={{ fontFamily: SERIF, fontWeight: '800', fontSize: 26, color: C.forest, minWidth: 38, textAlign: 'center' }}>{p2(v)}</Text>;
  return (
    <View style={[s.rowi, { flexWrap: 'nowrap', justifyContent: 'center', gap: 6, marginTop: 8 }]}>
      <B ic="minus" on={() => step(-1, 0)} /><N v={h} /><B ic="plus" on={() => step(1, 0)} />
      <Text style={{ fontSize: 26, fontWeight: '800', color: C.forest }}>:</Text>
      <B ic="minus" on={() => step(0, -5)} /><N v={m} /><B ic="plus" on={() => step(0, 5)} />
    </View>
  );
};

const StreakCard = ({ streak, onFreeze }) => {
  if (!streak) return null;
  const { current, best, today, can_freeze, needs_ad, freeze_included_left } = streak;
  return (
    <View style={[s.card, { backgroundColor: '#fff3e0', borderColor: '#f0cf9b', marginVertical: 8 }]}>
      <View style={[s.rowi, { flexWrap: 'nowrap' }]}>
        <Ic n="fire" s={32} c="#e07b1a" />
        <View style={{ flex: 1 }}>
          <Text style={s.h3}>{current} {dny(current)} v sérii</Text>
          <Text style={s.sm}>{today ? 'Dnešek máš splněný.' : current ? 'Odklikni dnes strom a série poroste.' : 'Odklikni strom a začni novou sérii.'} Rekord: {best}</Text>
        </View>
      </View>
      {!!can_freeze && <>
        <Text style={[s.sm, { marginTop: 8, color: C.ink }]}>Včera jsi nic neodklikl(a). Zmrazením včerejška sérii zachráníš ❄️</Text>
        <Btn ghost icon="snowflake" title={needs_ad ? 'Zmrazit včerejšek (reklama)' : `Zmrazit včerejšek (v ceně, zbývá ${freeze_included_left})`} onPress={onFreeze} />
      </>}
    </View>
  );
};

function FriendsFeedPanel({ me, bottom, onAuth, toast, onProfile }) {
  const [items, setItems] = useState(null), [busy, setBusy] = useState(false);
  const load = async () => { setBusy(true); try { setItems((await api('/friends/feed')).items || []); } catch (e) { setItems([]); } setBusy(false); };
  useEffect(() => { if (me) load(); }, [me && me.id]);
  const react = async (item, reaction) => { try { await api(`/friends/feed/${item.id}/reaction`, { method: 'POST', json: { reaction } }); await load(); } catch (e) { toast(e.message, 'alert-circle-outline'); } };
  if (!me) return <ScrollView contentContainerStyle={{ padding: 16 }}><NeedLogin onAuth={onAuth} t="Přihlas se a sleduj výpravy přátel." /></ScrollView>;
  return <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: bottom + 18 }} refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={C.moss} />}>
    {!items ? <ActivityIndicator color={C.moss} style={{ marginTop: 20 }} /> : !items.length ? <Text style={[s.sm, { marginTop: 16 }]}>Zatím žádné nové návštěvy. Přidej si přátele a jejich výpravy se objeví tady.</Text> : items.map((x) => <View key={x.id} style={s.card}>
      <T onPress={() => onProfile(x.user_id)} style={[s.rowi, { flexWrap: 'nowrap' }]}><Av a={x.avatar} size={38}/><View style={{ flex: 1 }}><Text style={s.b}>{x.username} odklikl(a) strom</Text><Text style={s.sm}>{fmtDay(dayKey(x.created))}</Text></View></T>
      <Text style={[s.h3, { marginTop: 10 }]}>{x.tree_name}{x.tree_district ? ` · ${x.tree_district}` : ''}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>{['🌳','❤️','👏','😮','📸'].map((emo) => { const r = x.reactions?.[emo]; return <T key={emo} onPress={() => react(x, emo)} accessibilityLabel={`${r?.mine ? 'Odebrat' : 'Přidat'} reakci ${emo}`} style={[s.chip, r?.mine && s.chipOn, { flexDirection: 'row', gap: 5 }]}><Text>{emo}</Text>{!!r?.count && <Text style={[s.sm, r?.mine && { color: '#fff' }]}>{r.count}</Text>}</T>; })}</View>
    </View>)}
  </ScrollView>;
}

function FamilyPanel({ me, bottom, onAuth, toast }) {
  const [items, setItems] = useState([]), [code, setCode] = useState(''), [name, setName] = useState('Rodinná výprava'), [challenge, setChallenge] = useState(null), [answer, setAnswer] = useState('');
  const [riddleIndex, setRiddleIndex] = useState(0);
  const riddles = [['Na jaře mám bílé květy, na podzim červené plody. Kdo jsem?', ['Jabloň', 'Jeřáb', 'Smrk'], 'Jeřáb', 'Jeřáb ptačí má červené malvice.'], ['Jsem jehličnan, na podzim mi ale jehličí zežloutne a opadá. Kdo jsem?', ['Modřín', 'Jedle', 'Borovice'], 'Modřín', 'Správně, modřín na zimu shazuje jehličí.'], ['Mám žaludy a moje listy mají zaoblené laloky. Kdo jsem?', ['Buk', 'Dub', 'Javor'], 'Dub', 'Ano, žaludy rostou na dubu.']];
  const load = async () => { try { setItems((await api('/family-challenges')).items || []); } catch (e) {} };
  useEffect(() => { if (me) load(); }, [me && me.id]);
  const create = async () => { try { setChallenge(await api('/family-challenges', { json: { name, goal: 10, days: 30 } })); await load(); } catch (e) { toast(e.message, 'alert-circle-outline'); } };
  const join = async () => { try { await api('/family-challenges/join', { json: { code } }); setCode(''); await load(); toast('Přidal(a) ses k rodinné výzvě.', 'account-group'); } catch (e) { toast(e.message, 'alert-circle-outline'); } };
  if (!me) return <ScrollView contentContainerStyle={{ padding: 16 }}><NeedLogin onAuth={onAuth} t="Rodinnou výzvu můžeš založit po přihlášení." /></ScrollView>;
  return <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: bottom + 18 }}>
    <Text style={s.h3}>Školní a rodinný mód</Text><Text style={s.sm}>Společný cíl bez žebříčku. Sdílej kód s rodinou nebo třídou.</Text>
    <TextInput value={name} onChangeText={setName} style={[s.input, { marginTop: 10 }]} placeholder="Název výpravy" accessibilityLabel="Název rodinné výzvy"/><Btn icon="plus" title="Založit výzvu na 30 dní" onPress={create}/>
    <View style={[s.rowi, { marginTop: 8 }]}><TextInput value={code} onChangeText={setCode} autoCapitalize="characters" style={[s.input, { flex: 1 }]} placeholder="Kód výzvy" accessibilityLabel="Kód školní nebo rodinné výzvy"/><Btn ghost title="Připojit" onPress={join}/></View>
    {!!challenge?.code && <View style={s.card}><Text style={s.b}>Kód pro pozvání: {challenge.code}</Text><Btn ghost title="Sdílet kód" onPress={() => Share.share({ message: `Přidej se k výzvě „${challenge.name}“ ve Stromobraní. Kód: ${challenge.code}` })}/></View>}
    {items.map((x) => <View key={x.id} style={s.card}><Text style={s.h3}>{x.name}</Text><Text style={s.sm}>{x.members} členů · společný cíl {x.goal} stromů · {Math.max(0, Math.ceil((x.ends * 1000 - Date.now()) / 86400000))} dní</Text><View style={s.bar}><View style={{ width: `${Math.min(100, 100 * x.progress / x.goal)}%`, height: '100%', backgroundColor: C.leaf }}/></View><Text style={s.sm}>{x.progress}/{x.goal} stromů společně</Text>{!!x.code && <Text style={[s.b, { marginTop: 5 }]}>Kód: {x.code}</Text>}</View>)}
    <View style={s.card}><View style={[s.rowi, { justifyContent: 'space-between' }]}><Text style={s.h3}>Hádanky pro malé průzkumníky</Text><Text style={s.sm}>{riddleIndex + 1}/{riddles.length}</Text></View><Text style={{ color: C.ink, marginTop: 8 }}>{riddles[riddleIndex][0]}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>{riddles[riddleIndex][1].map((x) => <T key={x} onPress={() => { const correct = x === riddles[riddleIndex][2]; setAnswer(x); toast(correct ? riddles[riddleIndex][3] : 'Zkus to ještě jednou.', correct ? 'check' : 'help-circle'); if (correct) setTimeout(() => { setRiddleIndex((i) => (i + 1) % riddles.length); setAnswer(''); }, 900); }} style={[s.chip, answer === x && s.chipOn]}><Text style={[s.chipT, answer === x && { color: '#fff' }]}>{x}</Text></T>)}</View></View>
  </ScrollView>;
}

/* ---------- komunita: jedna záložka pro všechny sociální funkce ---------- */
const COMM_SECS = [['board', 'trophy-outline', 'Žebříček'], ['events', 'calendar-star', 'Události'], ['trips', 'map-marker-path', 'Výpravy'], ['duels', 'sword-cross', 'Souboje'], ['friends', 'account-group-outline', 'Přátelé'], ['feed', 'newspaper-variant-outline', 'Feed'], ['family', 'human-child', 'Rodina']];
let commSec = 'board';
function Community({ me, top, bottom, onProfile, onPlus, onAuth, toast, onPlan, onTripOpen, tripsKey, settings = {} }) {
  const [sec, setSecS] = useState(commSec);
  const sections = settings.familyMode ? COMM_SECS.filter(([k]) => !['board', 'duels'].includes(k)) : COMM_SECS;
  useEffect(() => { if (settings.familyMode && ['board', 'duels'].includes(sec)) setSec('family'); }, [settings.familyMode]);
  const setSec = (k) => { commSec = k; setSecS(k); };
  const common = { me, bottom, onAuth, toast, onProfile, onPlus };
  /* Panel má explicitní absolutní rozměry (ne přes s.panel / absoluteFillObject) a výšku obsahu dostává
     z flexu s pevně danou výškou hlavičky, takže nemůže zkolabovat na nulu. */
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.cream }}>
      <View style={{ paddingTop: top + 10, paddingHorizontal: 14, flexGrow: 0, flexShrink: 0 }}>
        <Text style={[s.h2, { fontSize: 28, marginBottom: 0 }]}>Komunita</Text>
        <View style={{ height: 58 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, height: 58 }}
            contentContainerStyle={{ gap: 8, paddingVertical: 8, alignItems: 'center' }}>
            {sections.map(([k, ic, l]) => (
              <T key={k} onPress={() => setSec(k)} style={[s.chip, sec === k && s.chipOn, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                <Ic n={ic} s={17} c={sec === k ? '#fff' : C.forest} /><Text style={[s.chipT, sec === k && { color: '#fff' }]}>{l}</Text>
              </T>))}
          </ScrollView>
        </View>
      </View>
      <View style={{ flex: 1, minHeight: 0 }}>
        {sec === 'board' && <Board me={me} onProfile={onProfile} top={0} bottom={bottom} onPlus={onPlus} embedded />}
        {sec === 'events' && <EventsPanel {...common} />}
        {sec === 'trips' && <TripsPanel {...common} onPlan={onPlan} onOpen={onTripOpen} refreshKey={tripsKey} />}
        {sec === 'duels' && <DuelsPanel {...common} />}
        {sec === 'friends' && <FriendsPanel {...common} />}
        {sec === 'feed' && <FriendsFeedPanel {...common} />}
        {sec === 'family' && <FamilyPanel {...common} />}
      </View>
    </View>
  );
}

const EV_STATE = { active: ['Probíhá', '#e3f1d3', C.moss], ended: ['Skončilo', '#ece7d2', C.mute], soon: ['Brzy', '#fbf0cf', C.bark] };
function EventsPanel({ me, bottom, onAuth, toast, onPlus, onProfile }) {
  const [ev, setEv] = useState(null);
  const [ref, setRef] = useState(false);
  const load = async () => { setRef(true); try { setEv(await api('/events')); } catch (e) {} setRef(false); };
  useEffect(() => { load(); }, [me && me.id]);
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: bottom + 20 }} refreshControl={<RefreshControl refreshing={ref} onRefresh={load} tintColor={C.moss} />}>
      <Text style={[s.h3, { marginTop: 6 }]}>Sezónní události</Text>
      <Text style={[s.sm, { marginTop: 2 }]}>Odklikej během události dost stromů a získáš body i místo ve výsledkové listině.</Text>
      {!ev ? <ActivityIndicator color={C.moss} style={{ marginTop: 16 }} /> : !ev.length ? <Text style={[s.sm, { marginTop: 10 }]}>Teď žádná událost neprobíhá.</Text> : ev.map((e) => {
        const [lab, bg, fg] = EV_STATE[e.state] || EV_STATE.soon, pct = Math.min(100, (e.mine / e.goal) * 100);
        return (
          <View key={e.key} style={[s.card, { backgroundColor: bg + 'aa', borderColor: e.state === 'active' ? C.leaf : C.line }]}>
            <View style={[s.rowi, { flexWrap: 'nowrap' }]}>
              <View style={[s.chI, { backgroundColor: e.state === 'active' ? C.moss : '#ece7d2' }]}><Ic n={e.icon} s={22} c={e.state === 'active' ? '#fff' : C.mute} /></View>
              <View style={{ flex: 1 }}><Text style={s.h3}>{e.title}</Text><Text style={s.sm}>{fmtDay(e.from)} – {fmtDay(e.to)}</Text></View>
              <View style={{ backgroundColor: fg, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>{lab}</Text></View>
            </View>
            <Text style={[s.sm, { marginTop: 6, color: C.ink }]}>{e.desc}</Text>
            {e.state !== 'soon' && <>
              <View style={s.bar}><View style={{ width: pct + '%', height: '100%', backgroundColor: e.awarded ? C.sun : C.leaf }} /></View>
              <View style={[s.rowi, { justifyContent: 'space-between' }]}><Text style={s.sm}>{me ? `${e.mine}/${e.goal} stromů` : `cíl ${e.goal} stromů`}</Text><Text style={[s.chP, e.awarded && { color: C.moss }]}>{e.awarded ? 'Odměna získána' : `+${e.pts} b`}</Text></View>
              {!!e.top?.length && <View style={{ marginTop: 8 }}>
                <Text style={[s.sm, { fontWeight: '800' }]}>Nejlepší ({e.participants} účastníků)</Text>
                {e.top.map((t, i) => <T key={t.id} onPress={() => onProfile(t.id)} style={[s.rowi, { marginTop: 4, flexWrap: 'nowrap' }]}><Text style={[s.rk, { width: 24, fontSize: 15 }]}>{i + 1}.</Text><Text style={[s.b, { flex: 1 }]} numberOfLines={1}>{t.username}</Text><Text style={s.sm}>{t.n}×</Text></T>)}
              </View>}
            </>}
          </View>
        );
      })}
      <CommunityChallenges me={me} onAuth={onAuth} toast={toast} onPlus={onPlus} />
      <PhotoContest me={me} onAuth={onAuth} toast={toast} onProfile={onProfile} />
    </ScrollView>
  );
}

function TripsPanel({ me, bottom, onAuth, toast, onPlan, onOpen, refreshKey }) {
  const [list, setList] = useState(null), [code, setCode] = useState('');
  const load = async () => { try { setList(await api('/trips')); } catch (e) { setList([]); } };
  useEffect(() => { if (me) load(); }, [me && me.id, refreshKey]);
  const join = async () => {
    const c = code.trim().toUpperCase(); if (c.length < 4) return toast('Zadej kód výpravy.', 'alert-circle-outline');
    try { await api(`/trips/${c}/join`, { json: {} }); setCode(''); load(); onOpen(c); } catch (e) { toast(e.message, 'alert-circle-outline'); }
  };
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: bottom + 20 }} keyboardShouldPersistTaps="handled">
      <Text style={[s.h3, { marginTop: 6 }]}>Týmové výpravy</Text>
      <Text style={[s.sm, { marginTop: 2 }]}>Naplánuj trasu přes stromy, pošli odkaz a sledujte, kdo které zastávky už odklikal.</Text>
      <Btn icon="map-marker-path" title="Naplánovat novou výpravu" onPress={onPlan} />
      {!me ? <NeedLogin onAuth={onAuth} t="Pro výpravy se přihlas." /> : (<>
        <View style={[s.rowi, { marginTop: 12, flexWrap: 'nowrap' }]}>
          <TextInput style={[s.input, { flex: 1 }]} placeholder="Kód výpravy (např. 8F61DF)" placeholderTextColor={C.mute} autoCapitalize="characters" maxLength={8} value={code} onChangeText={setCode} />
          <Btn style={{ marginTop: 0, paddingHorizontal: 16 }} title="Připojit" onPress={join} />
        </View>
        {!list ? <ActivityIndicator color={C.moss} style={{ marginTop: 16 }} /> : !list.length ? <Text style={[s.sm, { marginTop: 14 }]}>Zatím nejsi v žádné výpravě.</Text> : list.map((t) => {
          const total = t.stops * t.members, pct = total ? Math.min(100, (t.done / total) * 100) : 0;
          return (
            <T key={t.code} style={[s.row, { flexDirection: 'column', alignItems: 'stretch', gap: 6 }]} onPress={() => onOpen(t.code)}>
              <View style={[s.rowi, { flexWrap: 'nowrap' }]}><Ic n={t.complete ? 'flag-checkered' : 'map-marker-path'} s={22} c={t.complete ? C.sun : C.moss} /><Text style={[s.b, { flex: 1 }]} numberOfLines={1}>{t.name}</Text><Text style={s.sm}>{t.code}</Text></View>
              <Text style={s.sm}>{t.stops} zastávek · {t.members} {t.members === 1 ? 'člen' : 'členů'}{t.complete ? ' · splněno 🎉' : ''}</Text>
              <View style={[s.bar, { marginTop: 2 }]}><View style={{ width: pct + '%', height: '100%', backgroundColor: t.complete ? C.sun : C.leaf }} /></View>
            </T>);
        })}
      </>)}
    </ScrollView>
  );
}

function TripCreate({ draft, points, onClose, toast, onCreated }) {
  const [name, setName] = useState('Výprava za stromy'), [busy, setBusy] = useState(false);
  const names = useMemo(() => { const m = {}; for (const p of points) if (draft.stops.includes(p[0]) && !m[p[0]]) m[p[0]] = p[1]; return m; }, []);
  const save = async () => {
    setBusy(true);
    try { const r = await api('/trips', { json: { name: name.trim(), stops: draft.stops } }); onCreated(r.code); }
    catch (e) { toast(e.message, 'alert-circle-outline'); }
    setBusy(false);
  };
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#1f3d2bcc', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '85%' }}>
          <View style={[s.rowi, { justifyContent: 'space-between' }]}><Text style={s.h2}>Týmová výprava</Text><T onPress={onClose} hitSlop={10}><Ic n="close" s={24} c={C.forest} /></T></View>
          <TextInput style={s.input} value={name} onChangeText={setName} maxLength={80} placeholder="Název výpravy" placeholderTextColor={C.mute} />
          <ScrollView style={{ marginTop: 10 }}>{draft.stops.map((k, i) => <Text key={k} style={[s.sm, { color: C.ink, marginTop: 4 }]}>{i + 1}. {names[k] || 'Strom ' + k}</Text>)}</ScrollView>
          <Btn icon="check" title={busy ? 'Zakládám…' : 'Založit výpravu'} disabled={busy || name.trim().length < 3} onPress={save} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TripDetail({ code, me, onClose, toast, onTree, onAuth, onChanged }) {
  const [t, setT] = useState(null);
  const load = useCallback(async () => { try { setT(await api('/trips/' + code)); } catch (e) { toast(e.message, 'alert-circle-outline'); onClose(); } }, [code]);
  useEffect(() => { load(); }, [code, me && me.id]);
  const link = `${API}/s/vyprava/${code}`;
  const act = async (a) => {
    if (!me) return onAuth();
    try { await api(`/trips/${code}/${a}`, { json: {} }); onChanged(); if (a === 'leave') onClose(); else load(); } catch (e) { toast(e.message, 'alert-circle-outline'); }
  };
  const mine = t && t.members.find((m) => me && m.id === me.id);
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#1f3d2bcc', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '90%' }}>
          {!t ? <ActivityIndicator color={C.moss} style={{ margin: 40 }} /> : (
            <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 28 }}>
              <View style={[s.rowi, { justifyContent: 'space-between', flexWrap: 'nowrap' }]}><View style={{ flex: 1 }}><Text style={s.h2}>{t.name}</Text><Text style={s.sm}>Kód {t.code} · {t.stops.length} zastávek</Text></View><T onPress={onClose} hitSlop={10}><Ic n="close" s={24} c={C.forest} /></T></View>
              {t.complete && <View style={s.firstB}><Ic n="flag-checkered" s={22} c={C.bark} /><Text style={s.firstBt}>Všichni splnili všechny zastávky! 🎉</Text></View>}
              <Text style={[s.b, { marginTop: 10 }]}>Zastávky</Text>
              {t.stops.map((st, i) => (
                <T key={st.kod} style={s.row} onPress={() => { onClose(); onTree(st.kod); }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: mine && mine.done.includes(st.kod) ? C.sun : C.line, alignItems: 'center', justifyContent: 'center' }}>{mine && mine.done.includes(st.kod) ? <Ic n="check" s={16} c="#4a3200" /> : <Text style={{ fontWeight: '800', color: C.mute }}>{i + 1}</Text>}</View>
                  <View style={{ flex: 1 }}><Text style={s.b} numberOfLines={1}>{st.name}</Text><Text style={s.sm}>{t.members.filter((m) => m.done.includes(st.kod)).length}/{t.members.length} už tam bylo</Text></View>
                </T>))}
              <Text style={[s.b, { marginTop: 14 }]}>Členové</Text>
              {t.members.map((m) => (
                <View key={m.id} style={[s.row, { flexWrap: 'nowrap' }]}><Av a={m.avatar} photo={m.photo} size={36} /><Text style={[s.b, { flex: 1 }]} numberOfLines={1}>{m.username}</Text><Text style={s.sm}>{m.done.length}/{t.stops.length}</Text></View>))}
              <Btn icon="share-variant-outline" title="Pozvat odkazem" onPress={() => Share.share({ message: `Pojď se mnou na výpravu „${t.name}“ ve Stromobraní 🌳 ${link} (kód ${t.code})` })} />
              {t.joined ? <Btn ghost icon="exit-run" title="Opustit výpravu" onPress={() => act('leave')} /> : <Btn icon="account-plus-outline" title="Připojit se k výpravě" onPress={() => act('join')} />}
            </ScrollView>)}
        </View>
      </View>
    </Modal>
  );
}

function DuelsPanel({ me, bottom, onAuth, toast, onProfile }) {
  const [d, setD] = useState(null), [fr, setFr] = useState(null), [pick, setPick] = useState(false), [days, setDays] = useState(7);
  const load = async () => { try { setD(await api('/duels')); } catch (e) { setD({ active: [], done: [] }); } };
  useEffect(() => { if (me) { load(); api('/friends/list').then((r) => setFr(r.friends)).catch(() => setFr([])); } }, [me && me.id]);
  const create = async (fid) => { try { await api('/duels', { json: { friend_id: fid, days } }); setPick(false); toast('Souboj vyhlášen, čeká na přijetí.', 'sword-cross'); load(); } catch (e) { toast(e.message, 'alert-circle-outline'); } };
  const answer = async (id, act) => { try { await api(`/duels/${id}/${act}`, { json: {} }); load(); } catch (e) { toast(e.message, 'alert-circle-outline'); } };
  const left = (ends) => { const h = Math.max(0, Math.round((ends * 1000 - Date.now()) / 36e5)); return h >= 24 ? `${Math.round(h / 24)} d` : `${h} h`; };
  const Card = ({ x }) => {
    const total = Math.max(1, (x.mine || 0) + (x.theirs || 0));
    return (
      <View style={[s.card, { marginVertical: 6 }]}>
        <T onPress={() => onProfile(x.other.id)} style={[s.rowi, { flexWrap: 'nowrap' }]}><Av a={x.other.avatar} photo={x.other.photo} size={36} /><View style={{ flex: 1 }}><Text style={s.b}>{x.other.username}</Text><Text style={s.sm}>{x.days} dní · nové stromy{x.status === 'active' ? ` · zbývá ${left(x.ends)}` : ''}</Text></View></T>
        {x.status === 'pending' ? (x.incoming ? <View style={{ flexDirection: 'row', gap: 8 }}><Btn style={{ flex: 1 }} title="Přijmout" icon="check" onPress={() => answer(x.id, 'accept')} /><Btn style={{ flex: 1 }} ghost title="Odmítnout" onPress={() => answer(x.id, 'decline')} /></View>
          : <View style={[s.rowi, { justifyContent: 'space-between', marginTop: 8 }]}><Text style={s.sm}>Čeká na odpověď…</Text><T onPress={() => answer(x.id, 'decline')}><Text style={[s.sm, { color: C.red }]}>Zrušit</Text></T></View>) : (<>
          <View style={[s.rowi, { justifyContent: 'space-between', marginTop: 10 }]}><Text style={s.statN}>{x.mine}</Text><Text style={s.sm}>ty × {x.other.username}</Text><Text style={s.statN}>{x.theirs}</Text></View>
          <View style={{ flexDirection: 'row', height: 10, borderRadius: 6, overflow: 'hidden', backgroundColor: C.line }}><View style={{ flex: x.mine || 0.001, backgroundColor: C.moss }} /><View style={{ flex: x.theirs || 0.001, backgroundColor: C.sun }} /></View>
          {x.status === 'done' && <Text style={[s.b, { marginTop: 8, color: x.winner === me.id ? C.moss : C.mute }]}>{x.winner == null ? 'Remíza' : x.winner === me.id ? `Vyhrál(a) jsi! +${x.win_pts} b` : 'Tentokrát vyhrál(a) soupeř'}</Text>}
        </>)}
      </View>);
  };
  if (!me) return <ScrollView contentContainerStyle={{ padding: 14 }}><NeedLogin onAuth={onAuth} t="Souboje s přáteli jsou jen pro přihlášené." /></ScrollView>;
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: bottom + 20 }}>
      <Text style={[s.h3, { marginTop: 6 }]}>Přátelské souboje</Text>
      <Text style={[s.sm, { marginTop: 2 }]}>Kdo za zvolenou dobu objeví víc nových stromů? Vítěz dostane +15 b.</Text>
      {!pick ? <Btn icon="sword-cross" title="Vyhlásit souboj" onPress={() => setPick(true)} /> : (
        <View style={s.card}>
          <Text style={s.b}>Délka souboje</Text>
          <Presets v={days} onChange={setDays} opts={[[3, '3 dny'], [7, '7 dní'], [14, '14 dní']]} />
          <Text style={[s.b, { marginTop: 12 }]}>Koho vyzveš?</Text>
          {!fr ? <ActivityIndicator color={C.moss} /> : !fr.length ? <Text style={s.sm}>Zatím nemáš žádné přátele. Pozvi je v sekci Přátelé.</Text> : fr.map((f) => (
            <T key={f.id} style={s.row} onPress={() => create(f.id)}><Av a={f.avatar} photo={f.photo} size={34} /><Text style={[s.b, { flex: 1 }]}>{f.username}</Text><Ic n="sword-cross" s={20} c={C.moss} /></T>))}
          <Btn ghost title="Zrušit" onPress={() => setPick(false)} />
        </View>)}
      {!d ? <ActivityIndicator color={C.moss} style={{ marginTop: 14 }} /> : (<>
        {d.active.map((x) => <Card key={x.id} x={x} />)}
        {!d.active.length && !pick && <Text style={[s.sm, { marginTop: 12 }]}>Žádný souboj teď neběží.</Text>}
        {!!d.done.length && <><Text style={[s.b, { marginTop: 16 }]}>Poslední souboje</Text>{d.done.map((x) => <Card key={x.id} x={x} />)}</>}
      </>)}
    </ScrollView>
  );
}

function UserListsModal({ points, onClose, onTree, toast }) {
  const [lists, setLists] = useState(null), [name, setName] = useState(''), [query, setQuery] = useState(''), [opened, setOpened] = useState(null), [busy, setBusy] = useState(false);
  const byKod = useMemo(() => Object.fromEntries(points.map((p) => [p[0], p])), [points]);
  const load = async () => { try { setLists((await api('/lists')).lists || []); } catch (e) { toast(e.message || 'Seznamy vyžadují přihlášení.', 'alert-circle-outline'); onClose(); } };
  useEffect(() => { load(); }, []);
  const create = async () => { if (!name.trim()) return; setBusy(true); try { await api('/lists', { json: { name: name.trim() } }); setName(''); await load(); } catch (e) { toast(e.message, 'alert-circle-outline'); } setBusy(false); };
  const update = async (list, treeKod) => { const tree_kods = list.tree_kods.includes(treeKod) ? list.tree_kods.filter((k) => k !== treeKod) : [...list.tree_kods, treeKod]; try { const n = await api(`/lists/${list.id}`, { method: 'PUT', json: { tree_kods } }); setLists((old) => old.map((x) => x.id === n.id ? n : x)); } catch (e) { toast(e.message, 'alert-circle-outline'); } };
  const del = (list) => Alert.alert('Smazat seznam?', `„${list.name}“ bude odstraněn.`, [{ text: 'Zrušit', style: 'cancel' }, { text: 'Smazat', style: 'destructive', onPress: async () => { await api(`/lists/${list.id}`, { method: 'DELETE' }); setLists((old) => old.filter((x) => x.id !== list.id)); } }]);
  const candidates = points.filter((p) => !query || `${p[1]} ${p[4]}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0, 40);
  return <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent><View style={{ flex: 1, backgroundColor: '#1f3d2bcc', justifyContent: 'flex-end' }}><View style={{ maxHeight: '92%', backgroundColor: C.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18 }}>
    <View style={[s.rowi, { justifyContent: 'space-between' }]}><Text style={s.h2}>Moje seznamy</Text><Close onPress={onClose} style={{ top: 0, right: 0 }} /></View>
    <View style={s.rowi}><TextInput value={name} onChangeText={setName} placeholder="Např. Víkend v Krkonoších" placeholderTextColor={C.mute} style={[s.input, { flex: 1 }]} accessibilityLabel="Název nového seznamu"/><Btn title="Vytvořit" disabled={busy || !name.trim()} onPress={create} /></View>
    <TextInput value={query} onChangeText={setQuery} placeholder="Najít strom pro přidání" placeholderTextColor={C.mute} style={[s.input, { marginTop: 10 }]} accessibilityLabel="Hledat strom do seznamu" />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
      {!lists ? <ActivityIndicator color={C.moss} /> : lists.map((list) => <View key={list.id} style={s.card}>
        <View style={[s.rowi, { justifyContent: 'space-between' }]}><T onPress={() => setOpened(opened === list.id ? null : list.id)} style={{ flex: 1, alignItems: 'flex-start' }}><Text style={s.h3}>{list.name}</Text><Text style={s.sm}>{list.tree_kods.length} stromů · klepni pro úpravu</Text></T><T onPress={() => del(list)} accessibilityLabel={`Smazat seznam ${list.name}`}><Ic n="delete-outline" s={22} c={C.red} /></T></View>
        {opened === list.id && <><Text style={[s.sm, { marginTop: 10, fontWeight: '800' }]}>Ve složce</Text>{list.tree_kods.map((k) => { const p = byKod[k]; return <View key={k} style={s.rowi}><View style={{ flex: 1 }}><Text style={s.b}>{p?.[1] || `Strom ${k}`}</Text><Text style={s.sm}>{p?.[4] || 'Katalog není aktuální'}</Text></View>{p && <T onPress={() => onTree(k)} accessibilityLabel={`Otevřít strom ${p[1]}`} hitSlop={8}><Ic n="chevron-right" s={20} c={C.mute}/></T>}<T onPress={() => update(list, k)} accessibilityLabel={`Odebrat strom ${p?.[1] || k} ze seznamu`} hitSlop={8}><Ic n="minus-circle-outline" s={20} c={C.red}/></T></View>; })}
          <Text style={[s.sm, { marginTop: 12, fontWeight: '800' }]}>Najít a přidat strom</Text>{candidates.filter((p) => !list.tree_kods.includes(p[0])).map((p) => <View key={p[0]} style={s.rowi}><T style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }} onPress={() => update(list, p[0])}><Ic n="plus-circle-outline" s={21} c={C.moss}/><View style={{ flex: 1 }}><Text style={s.b}>{p[1]}</Text><Text style={s.sm}>{p[4]}</Text></View></T><T onPress={() => onTree(p[0])} accessibilityLabel={`Otevřít strom ${p[1]}`} hitSlop={8}><Ic n="chevron-right" s={20} c={C.mute}/></T></View>)}</>}
      </View>)}
    </ScrollView>
  </View></View></Modal>;
}

function FriendsPanel({ me, bottom, onAuth, toast, onProfile }) {
  const [d, setD] = useState(null);
  const load = async () => { try { setD(await api('/friends/list')); } catch (e) { setD({ friends: [], incoming: [], sent: [] }); } };
  useEffect(() => { if (me) load(); }, [me && me.id]);
  const act = async (id, del) => { try { await api('/friend/' + id, { method: del ? 'DELETE' : 'POST', json: {} }); load(); } catch (e) { toast(e.message, 'alert-circle-outline'); } };
  if (!me) return <ScrollView contentContainerStyle={{ padding: 14 }}><NeedLogin onAuth={onAuth} t="Přátele najdeš po přihlášení." /></ScrollView>;
  const Row = ({ f, children }) => <T style={[s.row, { flexWrap: 'nowrap' }]} onPress={() => onProfile(f.id)}><Av a={f.avatar} photo={f.photo} size={38} /><View style={{ flex: 1 }}><Text style={s.b} numberOfLines={1}>{f.username}</Text><Text style={s.sm}>{f.visits} stromů · {f.score} b</Text></View>{children}</T>;
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: bottom + 20 }}>
      <Btn icon="share-variant-outline" title="Pozvat kamaráda do Stromobraní" onPress={() => Share.share({ message: `Pojď sbírat památné stromy! Přidej se ke mně ve Stromobraní 🌳 ${API}/s/pozvanka/${me.id}` })} />
      {!d ? <ActivityIndicator color={C.moss} style={{ marginTop: 16 }} /> : (<>
        {!!d.incoming.length && <><Text style={[s.b, { marginTop: 14 }]}>Žádosti o přátelství</Text>{d.incoming.map((f) => <Row key={f.id} f={f}><T onPress={() => act(f.id)} hitSlop={6}><Ic n="check-circle" s={30} c={C.moss} /></T><T onPress={() => act(f.id, true)} hitSlop={6}><Ic n="close-circle" s={30} c={C.red} /></T></Row>)}</>}
        <Text style={[s.b, { marginTop: 14 }]}>Přátelé ({d.friends.length})</Text>
        {d.friends.map((f) => <Row key={f.id} f={f}><Ic n="chevron-right" s={22} c={C.mute} /></Row>)}
        {!d.friends.length && <Text style={[s.sm, { marginTop: 6 }]}>Zatím žádní. Pošli pozvánku nebo je najdi v žebříčku.</Text>}
        {!!d.sent.length && <><Text style={[s.b, { marginTop: 14 }]}>Odeslané žádosti</Text>{d.sent.map((f) => <Row key={f.id} f={f}><Text style={s.sm}>čeká</Text></Row>)}</>}
      </>)}
    </ScrollView>
  );
}

function InviteModal({ id, me, onClose, onAuth, onProfile, toast }) {
  const [u, setU] = useState(null);
  useEffect(() => { api('/user/' + id).then(setU).catch(() => onClose()); }, [id]);
  const add = async () => {
    if (!me) { onClose(); return onAuth(); }
    try { const r = await api('/friend/' + id, { method: 'POST', json: {} }); toast(r.status === 'accepted' ? 'Jste přátelé!' : 'Žádost o přátelství odeslána.', 'account-check'); onClose(); } catch (e) { toast(e.message, 'alert-circle-outline'); }
  };
  if (!u) return null;
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#122719dd', justifyContent: 'center', padding: 22 }}>
        <View style={[s.card, { alignItems: 'center', padding: 22, backgroundColor: C.paper }]}>
          <Av a={u.avatar} photo={u.photo} size={72} />
          <Text style={[s.h2, { marginTop: 10, textAlign: 'center' }]}>{u.username} tě zve</Text>
          <Text style={[s.sm, { textAlign: 'center' }]}>Sbírejte spolu památné stromy, porovnávejte body a vyzvěte se na souboj.</Text>
          {me && me.id === id ? <Text style={[s.sm, { marginTop: 10 }]}>To je tvoje vlastní pozvánka.</Text> : <Btn style={{ alignSelf: 'stretch' }} icon="account-plus-outline" title={me ? 'Přidat do přátel' : 'Přihlásit se a přidat'} onPress={add} />}
          <Btn ghost style={{ alignSelf: 'stretch' }} title="Zobrazit profil" onPress={() => { onClose(); onProfile(id); }} />
          <T onPress={onClose} style={{ marginTop: 10 }}><Text style={s.sm}>Zavřít</Text></T>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- sbírky druhů a okresů ---------- */
const COL_MEDAL = ['#b9b4a0', '#b0713a', '#9aa3ab', '#d9a520'];
function CollectionsModal({ onClose, toast, onFog }) {
  const [d, setD] = useState(null), [tab, setTab] = useState('okres'), [q, setQ] = useState(''), [open, setOpen] = useState(null);
  useEffect(() => { api('/me/collections').then(setD).catch((e) => { toast(e.message, 'alert-circle-outline'); onClose(); }); }, []);
  const dist = useMemo(() => (d ? d.districts.filter((x) => !q || norm(x.name).includes(norm(q))).sort((a, b) => b.mine / b.total - a.mine / a.total || b.mine - a.mine) : []), [d, q]);
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#1f3d2bcc', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.paper, maxHeight: '93%', minHeight: '60%', borderTopLeftRadius: 26, borderTopRightRadius: 26 }}>
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
            <View style={[s.rowi, { justifyContent: 'space-between' }]}><Text style={s.h2}>Sbírky</Text><T onPress={onClose} hitSlop={10}><Ic n="close" s={24} c={C.forest} /></T></View>
            <Seg v={tab} onChange={setTab} opts={[['okres', 'Okresy'], ['sp', 'Druhy stromů']]} />
            <Btn ghost icon="weather-fog" title="Zobrazit mlhu okresů na mapě" onPress={onFog} />
            {!d ? <ActivityIndicator color={C.moss} style={{ marginTop: 20 }} /> : tab === 'sp' ? (<>
              <Text style={[s.sm, { marginTop: 6 }]}>Odznaky bronz, stříbro a zlato za 3, 10 a 25 stromů jednoho druhu.</Text>
              {d.species.map((x) => (
                <View key={x.druh} style={s.row}>
                  <Ic n="medal" s={30} c={COL_MEDAL[x.tier]} />
                  <View style={{ flex: 1 }}>
                    <View style={[s.rowi, { justifyContent: 'space-between' }]}><Text style={s.b}>{x.druh}</Text><Text style={s.sm}>{x.mine}/{x.total}</Text></View>
                    <View style={[s.bar, { marginTop: 5 }]}><View style={{ width: Math.min(100, (x.mine / x.total) * 100) + '%', height: '100%', backgroundColor: COL_MEDAL[Math.max(1, x.tier)] }} /></View>
                    <Text style={[s.sm, { fontSize: 11 }]}>{x.next ? `Další odznak za ${x.next} stromů` : x.tier ? 'Všechny odznaky získány' : 'Zatím žádný odznak'}</Text>
                  </View>
                </View>))}
            </>) : (<>
              <TextInput style={[s.input, { marginTop: 10 }]} value={q} onChangeText={setQ} placeholder="Hledat okres…" placeholderTextColor={C.mute} />
              {dist.map((x) => {
                const pct = Math.round((x.mine / x.total) * 100), full = x.mine >= x.total;
                return (
                  <View key={x.name} style={[s.row, { flexDirection: 'column', alignItems: 'stretch', gap: 4 }, full && { borderColor: C.sun, backgroundColor: '#fbf0cf' }]}>
                    <T onPress={() => setOpen(open === x.name ? null : x.name)} style={[s.rowi, { flexWrap: 'nowrap' }]}>
                      <Ic n={full ? 'check-decagram' : 'map-marker-radius-outline'} s={24} c={full ? C.sun : C.moss} />
                      <Text style={[s.b, { flex: 1 }]} numberOfLines={1}>{x.name}</Text><Text style={s.sm}>{x.mine}/{x.total} · {pct} %</Text>
                      {!!x.species && <Ic n={open === x.name ? 'chevron-up' : 'chevron-down'} s={20} c={C.mute} />}
                    </T>
                    <View style={[s.bar, { marginTop: 0 }]}><View style={{ width: pct + '%', height: '100%', backgroundColor: full ? C.sun : C.leaf }} /></View>
                    {open === x.name && !!x.species && x.species.map((sp) => <View key={sp.druh} style={[s.rowi, { justifyContent: 'space-between', flexWrap: 'nowrap' }]}><Text style={s.sm}>{sp.druh}{sp.mine >= sp.total ? ' ✓' : ''}</Text><Text style={s.sm}>{sp.mine}/{sp.total}</Text></View>)}
                  </View>);
              })}
              {!dist.length && <Text style={[s.sm, { marginTop: 10 }]}>Žádný okres nenalezen.</Text>}
            </>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* mlha okresů na mapě: tmavší a „zamlžené“ okresy se s přibývajícími stromy projasňují, hotové dostanou zlatý lem */
const P_FOG_BASE = { 'fill-color': '#2d3b34', 'fill-opacity': ['interpolate', ['linear'], ['get', 'pct'], 0, 0.58, 40, 0.38, 80, 0.14, 99, 0.04, 100, 0] };
const P_FOG_MIST = { 'fill-color': '#eef1e6', 'fill-opacity': ['interpolate', ['linear'], ['get', 'pct'], 0, 0.3, 60, 0.12, 100, 0] };
const P_FOG_GLOW = { 'line-color': ['case', ['>=', ['get', 'pct'], 100], '#e9b44c', '#f7f2e4'], 'line-width': ['case', ['>=', ['get', 'pct'], 100], 9, 7], 'line-blur': 6, 'line-opacity': ['case', ['>=', ['get', 'pct'], 100], 0.55, 0.28] };
const P_FOG_LINE = { 'line-color': ['case', ['>=', ['get', 'pct'], 100], '#e9b44c', '#f7f2e4'], 'line-width': ['case', ['>=', ['get', 'pct'], 100], 2.6, 1], 'line-opacity': 0.9 };
const L_FOG_TXT = (font) => ({ 'text-field': ['concat', ['get', 'n'], '\n', ['to-string', ['get', 'pct']], ' %'], 'text-size': 12, 'text-allow-overlap': false, ...(font ? { 'text-font': font } : {}) });
const P_FOG_TXT = { 'text-color': '#fffdf6', 'text-halo-color': '#1f3d2b', 'text-halo-width': 1.6 };
const FogCard = ({ f, bottom, onClose }) => (
  <View style={[s.sheet, { bottom, maxHeight: undefined, padding: 18 }]}>
    <Close onPress={onClose} />
    <View style={[s.rowi, { flexWrap: 'nowrap' }]}><Ic n={f.pct >= 100 ? 'check-decagram' : 'weather-fog'} s={30} c={f.pct >= 100 ? C.sun : C.moss} /><View style={{ flex: 1, paddingRight: 36 }}><Text style={s.h2}>{f.n}</Text><Text style={s.sm}>{f.mine} z {f.total} stromů · {f.pct >= 100 ? 'mlha je pryč ☀️' : `ještě ${f.total - f.mine} do rozptýlení mlhy`}</Text></View></View>
    <View style={s.bar}><View style={{ width: f.pct + '%', height: '100%', backgroundColor: f.pct >= 100 ? C.sun : C.leaf }} /></View>
  </View>
);

/* ---------- soukromé poznámky ---------- */
function NotesBlock({ kod, me, pos, toast }) {
  const [open, setOpen] = useState(false), [list, setList] = useState(null), [text, setText] = useState('');
  const load = async () => { try { setList(await api('/me/notes?kod=' + kod)); } catch (e) { setList([]); } };
  useEffect(() => { setOpen(false); setList(null); setText(''); }, [kod]);
  useEffect(() => { if (open && !list) load(); }, [open]);
  if (!me) return null;
  const add = async () => {
    if (!text.trim()) return;
    try { await api('/me/notes', { json: { tree_kod: kod, text: text.trim(), lat: pos ? pos.lat : undefined, lon: pos ? pos.lon : undefined } }); setText(''); load(); } catch (e) { toast(e.message, 'alert-circle-outline'); }
  };
  const del = async (id) => { try { await api('/me/notes/' + id, { method: 'DELETE' }); load(); } catch (e) { toast(e.message, 'alert-circle-outline'); } };
  return (
    <View style={s.card}>
      <T onPress={() => setOpen((v) => !v)} style={[s.rowi, { justifyContent: 'space-between', flexWrap: 'nowrap' }]}>
        <View style={s.rowi}><Ic n="notebook-outline" s={20} c={C.moss} /><Text style={s.b}>Moje poznámky{list && list.length ? ` (${list.length})` : ''}</Text></View>
        <Ic n={open ? 'chevron-up' : 'chevron-down'} s={22} c={C.mute} />
      </T>
      {open && <>
        <Text style={[s.sm, { marginTop: 4 }]}>Vidíš je jen ty. Diktovat můžeš mikrofonem na klávesnici.</Text>
        <TextInput style={[s.input, { marginTop: 8, minHeight: 70 }]} multiline value={text} onChangeText={setText} maxLength={2000} placeholder="Co jsi tu viděl(a)? Jak se sem dostat?" placeholderTextColor={C.mute} />
        <Btn ghost icon="content-save-outline" title="Uložit poznámku" disabled={!text.trim()} onPress={add} />
        {!list ? <ActivityIndicator color={C.moss} /> : list.map((n) => (
          <View key={n.id} style={{ marginTop: 8, backgroundColor: C.paper, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: C.line }}>
            <View style={[s.rowi, { justifyContent: 'space-between', flexWrap: 'nowrap' }]}><Text style={s.sm}>{fmtDay(dayKey(n.created))} {hmOf(n.created)}{n.lat != null ? ' · s polohou' : ''}</Text><T onPress={() => del(n.id)} hitSlop={8}><Ic n="trash-can-outline" s={18} c={C.red} /></T></View>
            <Text style={{ color: C.ink, marginTop: 3 }}>{n.text}</Text>
          </View>))}
      </>}
    </View>
  );
}

function DiaryModal({ onClose, onTree, toast }) {
  const [list, setList] = useState(null);
  const load = () => api('/me/notes').then(setList).catch((e) => { toast(e.message, 'alert-circle-outline'); setList([]); });
  useEffect(() => { load(); }, []);
  const del = async (id) => { try { await api('/me/notes/' + id, { method: 'DELETE' }); load(); } catch (e) { toast(e.message, 'alert-circle-outline'); } };
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#1f3d2bcc', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.paper, maxHeight: '90%', minHeight: '50%', borderTopLeftRadius: 26, borderTopRightRadius: 26 }}>
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }}>
            <View style={[s.rowi, { justifyContent: 'space-between' }]}><Text style={s.h2}>Deník poznámek</Text><T onPress={onClose} hitSlop={10}><Ic n="close" s={24} c={C.forest} /></T></View>
            {!list ? <ActivityIndicator color={C.moss} /> : !list.length ? <Text style={s.sm}>Zatím žádné poznámky. Napíšeš je u stromu v detailu.</Text> : list.map((n) => (
              <View key={n.id} style={s.row}>
                <T style={{ flex: 1 }} onPress={() => { onClose(); onTree(n.tree_kod); }}><Text style={s.b} numberOfLines={1}>{n.name}</Text><Text style={s.sm}>{fmtDay(dayKey(n.created))}</Text><Text style={{ color: C.ink, marginTop: 3 }}>{n.text}</Text></T>
                <T onPress={() => del(n.id)} hitSlop={8}><Ic n="trash-can-outline" s={20} c={C.red} /></T>
              </View>))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- roční shrnutí ---------- */
function WrappedModal({ onClose, toast }) {
  const yr = new Date().getFullYear(), [year, setYear] = useState(yr), [d, setD] = useState(null), ref = useRef(null);
  useEffect(() => { setD(null); api('/me/wrapped?year=' + year).then(setD).catch((e) => { toast(e.message, 'alert-circle-outline'); setD({ empty: true }); }); }, [year]);
  const share = async () => {
    try { const uri = await captureRef(ref.current, { format: 'png', quality: 1 }); await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Tvůj rok se Stromobraním' }); }
    catch (e) { toast('Sdílení se nepodařilo.', 'alert-circle-outline'); }
  };
  const Stat = ({ n, l }) => <View style={{ flex: 1, backgroundColor: '#ffffff14', borderRadius: 16, paddingVertical: 12, alignItems: 'center' }}><Text style={{ fontFamily: SERIF, fontWeight: '800', fontSize: 26, color: C.sun }}>{n}</Text><Text style={{ color: '#dfeccf', fontSize: 12, fontWeight: '700' }}>{l}</Text></View>;
  const Line = ({ ic, t }) => <View style={[s.rowi, { flexWrap: 'nowrap', marginTop: 9 }]}><Ic n={ic} s={20} c={C.sun} /><Text style={{ color: '#fff', fontWeight: '700', flex: 1 }}>{t}</Text></View>;
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#122719ee', justifyContent: 'center', padding: 14 }}>
        <ScrollView contentContainerStyle={{ paddingVertical: 20 }}>
          <View style={[s.rowi, { justifyContent: 'center', marginBottom: 10 }]}>{[yr, yr - 1].map((y) => <T key={y} onPress={() => setYear(y)} style={[s.chip, year === y && s.chipOn]}><Text style={[s.chipT, year === y && { color: '#fff' }]}>{y}</Text></T>)}</View>
          {!d ? <ActivityIndicator color={C.sun} style={{ margin: 40 }} /> : d.empty ? <View style={[s.card, { alignItems: 'center' }]}><Ic n="tree-outline" s={44} c={C.mute} /><Text style={[s.sm, { textAlign: 'center' }]}>V roce {year} jsi zatím žádný strom neodklikl(a).</Text></View> : (
            <ViewShot ref={ref} options={{ format: 'png', quality: 1 }}>
              <View style={{ backgroundColor: C.forest, borderRadius: 28, padding: 22 }}>
                <Text style={{ color: C.sun, fontWeight: '900', letterSpacing: 3, fontSize: 12 }}>STROMOBRANÍ · TVŮJ ROK {d.year}</Text>
                <Text style={{ fontFamily: SERIF, fontWeight: '800', fontSize: 74, color: '#fff', marginTop: 6 }}>{d.trees}</Text>
                <Text style={{ color: '#dfeccf', fontSize: 17, fontWeight: '700', marginTop: -8 }}>stromů, z toho {d.new_trees} nových</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}><Stat n={String(d.km).replace('.', ',')} l="km mezi stromy" /><Stat n={d.active_days} l="aktivních dní" /></View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}><Stat n={d.best_streak} l="nejdelší série" /><Stat n={d.points} l="bodů" /></View>
                <View style={{ marginTop: 10 }}>
                  {!!d.top_species && <Line ic="leaf" t={`Nejčastější druh: ${d.top_species.name} (${d.top_species.n}×)`} />}
                  {!!d.top_district && <Line ic="map-marker-radius-outline" t={`Nejoblíbenější okres: ${d.top_district.name}`} />}
                  <Line ic="calendar-star" t={`Nejaktivnější měsíc: ${MONTHS[d.best_month.month - 1]} (${d.best_month.n}×)`} />
                  {!!d.oldest && <Line ic="history" t={`Nejstarší strom: ${d.oldest.name} (~${d.oldest.stari} let)`} />}
                  <Line ic="flag-outline" t={`První strom roku: ${d.first_tree.name}`} />
                  {!!d.top_transport && TR[d.top_transport.key] && <Line ic={TR[d.top_transport.key][0]} t={`Nejčastěji ${TR[d.top_transport.key][1]}`} />}
                  <Line ic="camera" t={`${d.photos} fotek · ${d.likes} lajků${d.rank ? ` · #${d.rank} v žebříčku` : ''}`} />
                </View>
                <Text style={{ color: '#b9cdb0', fontSize: 11, fontWeight: '700', marginTop: 14 }}>Vzdálenosti jsou vzdušnou čarou mezi odkliky ve stejný den.</Text>
              </View>
            </ViewShot>)}
          {!!d && !d.empty && <Btn icon="share-variant-outline" title="Sdílet jako obrázek" onPress={share} />}
          <Btn ghost title="Zavřít" onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ---------- export sbírky (GPX / KML / PDF / CSV) ---------- */
function ExportModal({ onClose, trees, points, isPlus, onPlus, onCsv, toast }) {
  const [busy, setBusy] = useState('');
  const uniq = useMemo(() => {
    const co = new Map(); for (const p of points) if (!co.has(p[0])) co.set(p[0], [p[2], p[3]]);
    const m = new Map();
    for (const t of [...trees].reverse()) { const e = m.get(t.kod); if (e) e.n++; else if (co.has(t.kod)) m.set(t.kod, { ...t, n: 1, lon: co.get(t.kod)[0], lat: co.get(t.kod)[1] }); }
    return [...m.values()];
  }, [trees, points]);
  const desc = (t) => [t.druh, t.okres, fmtDay(dayKey(t.created)), t.rating ? '★'.repeat(t.rating) : ''].filter(Boolean).join(' · ');
  const run = (key, fn) => async () => {
    if (!isPlus) { onClose(); return onPlus(); }
    if (!uniq.length) return toast('Zatím nemáš žádné stromy k exportu.', 'alert-circle-outline');
    setBusy(key); try { await fn(); } catch (e) { toast(e.message || 'Export se nezdařil.', 'alert-circle-outline'); } setBusy('');
  };
  const wpts = () => uniq.map((t) => ({ lat: t.lat, lon: t.lon, name: t.name, desc: desc(t), time: utc(t.created).toISOString() }));
  const pdf = async () => {
    const rows = uniq.map((t, i) => `<tr><td>${i + 1}</td><td>${esc(fmtDay(dayKey(t.created)))}</td><td><b>${esc(t.name)}</b></td><td>${esc(t.druh || '')}</td><td>${esc(t.okres || '')}</td><td>${t.rating ? '★'.repeat(t.rating) : ''}</td><td>${t.n}×</td></tr>`).join('');
    const html = `<html><head><meta charset="utf-8"><style>body{font-family:sans-serif;color:#23301f;padding:24px}h1{color:#1f3d2b;margin:0}p{color:#7a8570}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}th{background:#1f3d2b;color:#fff;text-align:left;padding:6px}td{padding:6px;border-bottom:1px solid #e3dcc3}</style></head><body><h1>Moje sbírka stromů</h1><p>Stromobraní · ${uniq.length} stromů · vytvořeno ${esc(fmtDay(dayKey(new Date().toISOString().slice(0, 19).replace('T', ' '))))}</p><table><tr><th>#</th><th>První návštěva</th><th>Strom</th><th>Druh</th><th>Okres</th><th>Hodnocení</th><th>Návštěv</th></tr>${rows}</table></body></html>`;
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Moje sbírka stromů' });
  };
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#1f3d2bcc', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingBottom: 30 }}>
          <View style={[s.rowi, { justifyContent: 'space-between' }]}><Text style={s.h2}>Export sbírky</Text><T onPress={onClose} hitSlop={10}><Ic n="close" s={24} c={C.forest} /></T></View>
          <Text style={s.sm}>{uniq.length} různých stromů{isPlus ? '' : ' · GPX, KML a PDF jsou součástí Plus'}</Text>
          <View style={{ gap: 10, marginTop: 12 }}>
            <ActionRow icon={isPlus ? 'map-marker-multiple-outline' : 'crown'} title={busy === 'gpx' ? 'Připravuji…' : 'GPX body'} sub="Do Mapy.cz, Locus, Garmin a dalších" onPress={run('gpx', async () => { await shareFile('stromobrani-sbirka.gpx', 'application/gpx+xml', gpxOf('Moje sbírka stromů', wpts())); })} />
            <ActionRow icon={isPlus ? 'google-earth' : 'crown'} title={busy === 'kml' ? 'Připravuji…' : 'KML body'} sub="Google Earth a Moje mapy" onPress={run('kml', async () => { await shareFile('stromobrani-sbirka.kml', 'application/vnd.google-earth.kml+xml', kmlOf('Moje sbírka stromů', wpts())); })} />
            <ActionRow icon={isPlus ? 'file-pdf-box' : 'crown'} title={busy === 'pdf' ? 'Připravuji…' : 'PDF seznam'} sub="Přehledná tabulka k tisku" onPress={run('pdf', pdf)} />
            <ActionRow icon="file-delimited-outline" title="CSV historie" sub="Všechny odklikané návštěvy v tabulce" onPress={onCsv} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- časová osa fotek stromu (před / po) ---------- */
function TimelineModal({ kod, name, onClose, toast }) {
  const [ph, setPh] = useState(null), [cmp, setCmp] = useState([]);
  useEffect(() => { api(`/tree/${kod}/timeline`).then((r) => { setPh(r); setCmp(r.length > 1 ? [r[0].id, r[r.length - 1].id] : []); }).catch((e) => { toast(e.message, 'alert-circle-outline'); setPh([]); }); }, [kod]);
  const byId = (id) => ph && ph.find((p) => p.id === id);
  const tap = (id) => setCmp(([a, b]) => { if (a && !b && id !== a) { const x = byId(a), y = byId(id); return x.created <= y.created ? [a, id] : [id, a]; } return [id]; });
  const [A, B] = [byId(cmp[0]), byId(cmp[1])];
  const Pic = ({ p, label }) => <View style={{ flex: 1 }}><Text style={[s.sm, { textAlign: 'center', fontWeight: '800' }]}>{label}</Text><Image source={{ uri: API + '/uploads/' + p.file }} resizeMethod="resize" style={{ width: '100%', aspectRatio: 0.8, borderRadius: 14, backgroundColor: C.line, marginTop: 4 }} /><Text style={[s.sm, { textAlign: 'center', marginTop: 3 }]}>{fmtDay(dayKey(p.created))}</Text></View>;
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#1f3d2bcc', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.paper, maxHeight: '94%', borderTopLeftRadius: 26, borderTopRightRadius: 26 }}>
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }}>
            <View style={[s.rowi, { justifyContent: 'space-between', flexWrap: 'nowrap' }]}><View style={{ flex: 1 }}><Text style={s.h2}>Časová osa</Text><Text style={s.sm} numberOfLines={1}>{name}</Text></View><T onPress={onClose} hitSlop={10}><Ic n="close" s={24} c={C.forest} /></T></View>
            {!ph ? <ActivityIndicator color={C.moss} style={{ margin: 30 }} /> : !ph.length ? <Text style={s.sm}>U tohoto stromu zatím nejsou žádné fotky.</Text> : (<>
              {A && B ? <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}><Pic p={A} label="PŘED" /><Pic p={B} label="PO" /></View> : A ? <Pic p={A} label="VYBRANÁ FOTKA" /> : null}
              <Text style={[s.sm, { marginTop: 10 }]}>Klepni na dvě fotky a porovnáš je. {ph.length < 2 ? 'Porovnání bude možné, až přibude další fotka.' : ''}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>
                {ph.map((p) => <T key={p.id} onPress={() => tap(p.id)} style={{ width: 92, opacity: cmp.includes(p.id) ? 1 : 0.7 }}>
                  <Image source={{ uri: API + '/uploads/' + p.file }} resizeMethod="resize" style={{ width: 92, height: 92, borderRadius: 14, borderWidth: 3, borderColor: cmp.includes(p.id) ? C.sun : 'transparent', backgroundColor: C.line }} />
                  <Text style={[s.sm, { fontSize: 11, textAlign: 'center' }]}>{fmtDay(dayKey(p.created))}</Text></T>)}
              </ScrollView>
            </>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- hlášení stavu stromu ---------- */
const COND = [['ok', 'check-circle-outline', 'V pořádku'], ['broken', 'tree-outline', 'Zlomená větev'], ['fallen', 'chevron-triple-down', 'Vyvrácený nebo pokácený'], ['disease', 'bug-outline', 'Choroba nebo škůdci'], ['sign', 'sign-direction-remove', 'Chybí nebo je poškozená tabule'], ['access', 'fence', 'Nepřístupný nebo zarostlý']];
function ConditionModal({ kod, name, onClose, toast, onDone }) {
  const [kind, setKind] = useState('ok'), [note, setNote] = useState(''), [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try { const r = await api(`/tree/${kod}/condition`, { json: { kind, note } }); toast('Díky za hlášení! 🌳', 'check-circle-outline'); onDone(r.conditions); onClose(); }
    catch (e) { toast(e.message, 'alert-circle-outline'); }
    setBusy(false);
  };
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#1f3d2bcc', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingBottom: 26, maxHeight: '90%' }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={[s.rowi, { justifyContent: 'space-between', flexWrap: 'nowrap' }]}><View style={{ flex: 1 }}><Text style={s.h2}>Stav stromu</Text><Text style={s.sm} numberOfLines={1}>{name}</Text></View><T onPress={onClose} hitSlop={10}><Ic n="close" s={24} c={C.forest} /></T></View>
            {COND.map(([k, ic, l]) => <T key={k} onPress={() => setKind(k)} style={[s.row, kind === k && { borderColor: C.moss, backgroundColor: '#eef6e4' }]}><Ic n={ic} s={22} c={kind === k ? C.moss : C.mute} /><Text style={[s.b, { flex: 1 }]}>{l}</Text><Ic n={kind === k ? 'radiobox-marked' : 'radiobox-blank'} s={22} c={kind === k ? C.moss : C.mute} /></T>)}
            <TextInput style={[s.input, { marginTop: 10, minHeight: 64 }]} multiline value={note} onChangeText={setNote} maxLength={500} placeholder="Poznámka (nepovinná)" placeholderTextColor={C.mute} />
            <Text style={[s.sm, { marginTop: 6, fontSize: 11 }]}>Hlášení uvidí ostatní jako upozornění u stromu a posoudí je správce databáze. Body za něj nejsou.</Text>
            <Btn icon="send" title={busy ? 'Odesílám…' : 'Odeslat hlášení'} disabled={busy} onPress={send} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}


/* ============================== hlavní aplikace ============================== */
function Main() {
  const ins = useSafeAreaInsets();
  const [plusOpen, setPlusOpen] = useState(false);
  const [iapError, setIapError] = useState('');
  const [giftOpen,setGiftOpen]=useState(false);
  const [incomingGift,setIncomingGift]=useState(null);
  const [iapBusy, setIapBusy] = useState(false);
  const [restorePending, setRestorePending] = useState(false);
  const restoreError = useRef(false);
  const iapFinish = useRef(null);
  const integrityPurchase = useRef(null);
  const inappPurchase = useRef(null);
  const giftPurchase = useRef(null);
  const restoreTimer = useRef(null);
  const iap = useIAP({
    onPurchaseSuccess: async (purchase) => {
      try {
        if (!purchase.purchaseToken) throw new Error('Google Play nevrátil token nákupu.');
        if (inappPurchase.current) {
          const pending=inappPurchase.current;
          const integrity=await getIntegrityPayload(purchase.productId);
          const result=await api('/me/inapp-purchase',{json:{productId:purchase.productId,purchaseToken:purchase.purchaseToken,...integrity,...(pending.payload||{})}});
          await loadMe();
          if(result.action==='patron_tree')toast('Patronský strom čeká na kontrolu.','tree');
          else if(result.action==='gift_plus'||result.action==='gift_extra')toast('Dárek byl odeslán s přáním.','gift');
          else toast(result.gifCredit?'GIF profilovka odemčena.':'Změna profilu potvrzena.','check-circle-outline');
          await iapFinish.current?.({purchase,isConsumable:true});inappPurchase.current=null;return;
        }
        const integrity = integrityPurchase.current;
        integrityPurchase.current = null;
        const result = await api('/me/purchase', { json: { productId: purchase.productId, purchaseToken: purchase.purchaseToken, ...(integrity || {}) } });
        if (!result.plus) throw new Error('Server nákup nepotvrdil.');
        await loadMe();
        toast(result.points_awarded ? `Stromobraní ${result.tier === 'extra' ? 'EXTRA' : 'Plus'} aktivní · +100 bodů!` : `Stromobraní ${result.tier === 'extra' ? 'EXTRA' : 'Plus'} aktivní!`, result.tier === 'extra' ? 'star-circle' : 'crown');
        await iapFinish.current?.({ purchase, isConsumable: false });
      } catch (e) { setIapError(e.message || 'Nákup zatím nelze ověřit. Zkus obnovení nákupů.'); }
      finally { setIapBusy(false); }
    },
    onPurchaseError: (e) => { integrityPurchase.current = null; if (e.code !== 'user-cancelled') setIapError(e.message || 'Nákup se nepodařil.'); setIapBusy(false); },
    onError: (e) => setIapError(e.message || 'Google Play není dostupný.'),
  });
  iapFinish.current = iap.finishTransaction;
  useEffect(() => { if (iap.connected && Platform.OS === 'android') iap.fetchProducts({ skus: PLUS_PRODUCTS, type: 'subs' }).catch(() => {}); }, [iap.connected]);
  useEffect(() => { if (iap.connected && Platform.OS === 'android') iap.fetchProducts({ skus: INAPP_PRODUCTS, type: 'in-app' }).catch(() => {}); }, [iap.connected]);
  useEffect(() => { if(Platform.OS==='android')prepareRewardedAds().catch(()=>{}); },[]);
  useEffect(() => {
    if (!restorePending || !iap.availablePurchases?.length) return;
    (async () => {
      let restored = false;
      restoreError.current = false;
      for (const purchase of iap.availablePurchases) {
        if (!PLUS_PRODUCTS.includes(purchase.productId) || !purchase.purchaseToken) continue;
        try {
          const integrity = await getIntegrityPayload(purchase.productId);
          const result = await api('/me/purchase', { json: { productId: purchase.productId, purchaseToken: purchase.purchaseToken, ...integrity } });
          if (result.plus) { restored = true; await iapFinish.current?.({ purchase, isConsumable: false }); }
        } catch (e) { restoreError.current = true; setIapError(e.message || 'Předplatné zatím nebylo možné obnovit.'); }
      }
      await loadMe();
      if (restored) toast('Stromobraní Plus obnoveno.', 'crown');
      else if (!restoreError.current) setIapError('Nenašli jsme aktivní předplatné Stromobraní Plus.');
      clearTimeout(restoreTimer.current);
      setRestorePending(false); setIapBusy(false);
    })();
  }, [restorePending, iap.availablePurchases]);
  const TABH = 62 + ins.bottom;
  const [me, setMe] = useState(null);
  const [integrityMsg, setIntegrityMsg] = useState(null);
  useEffect(() => { integrityBlockHandler = setIntegrityMsg; return () => { integrityBlockHandler = null; }; }, []);
  useEffect(() => { if (me?.id) verifyAppIntegrity(false).catch(() => {}); }, [me?.id]);
  const [visited, setVisited] = useState(new Set());
  const [favorites, setFavorites] = useState([]);
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
  const mapSt = useMapState();
  const [layersOpen, setLayersOpen] = useState(false);
  const downSeen = useRef(false);
  useEffect(() => { checkMapRiot(); }, []);
  useEffect(() => {
    if (mapSt.down && !downSeen.current) { downSeen.current = true; if (mapSt.sel === 'mapriot') toast('MapRiot teď není dostupný, mapa se přepnula na OpenFreeMap', 'map-marker-alert-outline'); }
    if (!mapSt.down) downSeen.current = false;
  }, [mapSt.down]);
  const onMapFail = useCallback(() => {
    if (MAP_SEL === 'reperfect') {
      if (!LAYER_ERRORS.reperfect) {
        LAYER_ERRORS.reperfect = 'MapLibre nedokázal načíst PMTiles mapu.';
        setMapSel('liberty');
        toast('Reperfect.it Maps se nepodařilo načíst, používá se OpenFreeMap', 'map-marker-alert-outline');
      }
    } else if (resolveLayer(MAP_SEL, MR_DOWN) === 'mapriot') checkMapRiot();
  }, []);
  const pickLayer = async (id) => {
    if (id === 'reperfect' && LAYER_ERRORS.reperfect) {
      setLayersOpen(false);
      return toast('Reperfect.it Maps je dočasně nedostupná, používá se OpenFreeMap', 'map-marker-alert-outline');
    }
    if (id === 'mapriot' && mapSt.down) {
      const r = await checkMapRiot();
      if (r !== 'ok') return toast('MapRiot je pořád nedostupný', 'map-marker-alert-outline');
    }
    if (id === 'reperfect') {
      const info = await ensureLayerInfo(id);
      if (info.error) {
        setMapSel('liberty'); setLayersOpen(false);
        return toast('Reperfect.it Maps se nepodařilo načíst, používá se OpenFreeMap', 'map-marker-alert-outline');
      }
    }
    setMapSel(id); setLayersOpen(false);
  };
  tabRef.current = tab; pointsRef.current = points; fltRef.current = flt;

  /* kamera: pohyb + zapamatování (kdyby mapa právě nebyla připojená, objeví se po návratu na správném místě) */
  const flyTo = (o) => {
    const l = lastCam.current;
    if (o.center) l.center = o.center;
    if (o.zoom != null) l.zoom = o.zoom;
    if (o.bearing != null) l.bearing = o.bearing;
    if (o.padding) l.padding = o.padding;
    const c = cam.current; if (!c) return;
    try { c.easeTo({ center: l.center, zoom: l.zoom, bearing: l.bearing || 0, ...(l.padding ? { padding: l.padding } : {}), duration: o.duration != null ? o.duration : 500 }); } catch (e) {}
  };
  const onMapIdle = useCallback((e) => {
    try {
      const p = e && e.nativeEvent; if (!p || !p.center) return;
      const l = lastCam.current; l.center = p.center; l.zoom = p.zoom; l.bearing = p.bearing || 0;
    } catch (err) {}
  }, []);
  const toast = (m, ic) => { setMsg({ t: m, ic }); clearTimeout(tm.current); tm.current = setTimeout(() => setMsg(null), 2800); };
  useEffect(() => () => clearTimeout(tm.current), []);
  const byKod = useMemo(() => { const o = {}; points.forEach((p) => { (o[p[0]] ??= { pts: [], name: p[1], count: p[5], druh: p[4], obvod: p[6] || 0, vyska: p[7] || 0, stari: p[8] || 0, patron: p[9] ? 1 : 0 }).pts.push([p[2], p[3]]); }); return o; }, [points]);
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
    if (fogSel) { setFogSel(null); return true; }
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
      const [m, cm, cq, cs] = await Promise.all(['sb_meta', 'sb_me', 'sb_queue', 'sb_settings'].map((k) => AsyncStorage.getItem(k)));
      setFavorites(jparse(await AsyncStorage.getItem('sb_favorites'), []));
      const st = { ...DEF_SET, ...jparse(cs, {}) }; settingsRef.current = st; setSettings(st);
      const qq = jparse(cq, []);
      queueRef.current = qq; setQueue(qq);
      const pts = await readTreesCache();
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
  useEffect(() => { Appearance.setColorScheme(Platform.OS === 'android' && settings.darkMode ? 'dark' : 'light'); }, [settings.darkMode]);
  const toggleFavorite = (kod) => setFavorites((old) => {
    const next = old.includes(kod) ? old.filter((x) => x !== kod) : [...old, kod];
    AsyncStorage.setItem('sb_favorites', JSON.stringify(next)).catch(() => {});
    return next;
  });
  const patchMe = (u) => { setMe(u); AsyncStorage.getItem('sb_me').then((c) => { const o = jparse(c, { visited: [] }); AsyncStorage.setItem('sb_me', JSON.stringify({ ...o, me: u })); }).catch(() => {}); };
  const loadMe = async (check) => {
    try {
      const r = await api('/me');
      if (r.user?.settings && Object.keys(r.user.settings).length) { const st = { ...settingsRef.current, ...r.user.settings }; settingsRef.current = st; setSettings(st); AsyncStorage.setItem('sb_settings', JSON.stringify(st)).catch(() => {}); }
      setMe(r.user); setVisited(new Set([...r.visited, ...queueRef.current.map((x) => x.kod)]));
      AsyncStorage.setItem('sb_me', JSON.stringify({ me: r.user, visited: r.visited }));
      avSync(r.user.photo, check === true);
      const gifts=await api('/me/gifts').catch(()=>[]);if(gifts?.length)setIncomingGift(gifts[0]);
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
      await writeTreesCache(r.points);
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
    if (patch.bgNearby === true) AsyncStorage.removeItem(BG_LOW_BATTERY_KEY).catch(() => {});
    if (TOKEN) api('/me/settings', { method: 'PUT', json: patch }).catch(() => {});
    if (patch.rot === false) flyTo({ bearing: 0, duration: 300 });   // srovnat na sever
  };
  useEffect(() => {
    let busy = false;
    const checkBatteryForGeofencing = async () => {
      if (busy) return;
      busy = true;
      try {
        const disabled = await enforceBgBatteryLimit(settingsRef.current);
        const marker = await AsyncStorage.getItem(BG_LOW_BATTERY_KEY);
        if (disabled || marker && settingsRef.current.bgNearby) {
          await AsyncStorage.removeItem(BG_LOW_BATTERY_KEY).catch(() => {});
          setSetting({ bgNearby: false });
          toast('Baterie klesla pod 5 %; poloha na pozadí byla vypnuta.', 'battery-alert-variant-outline');
        }
      } catch (e) {} finally { busy = false; }
    };
    checkBatteryForGeofencing();
    const batterySub = Battery.addBatteryLevelListener(checkBatteryForGeofencing);
    const appSub = AppState.addEventListener('change', (state) => { if (state === 'active') checkBatteryForGeofencing(); });
    const timer = settings.bgNearby ? setInterval(() => { if (AppState.currentState === 'active') checkBatteryForGeofencing(); }, 20000) : null;
    return () => { batterySub.remove(); appSub.remove(); if (timer) clearInterval(timer); };
  }, [settings.bgNearby]);
  const loadTaken = useCallback(async (force) => {
    if (!force && takenTs.current && Date.now() - takenTs.current < 60000) return true;
    try { const r = await api('/trees/taken'); setTaken(new Set(r.kods)); takenTs.current = Date.now(); return true; } catch (e) { return false; }
  }, []);
  const saveQueue = (qq) => { queueRef.current = qq; setQueue(qq); AsyncStorage.setItem('sb_queue', JSON.stringify(qq)); };
  const addQueue = (it) => saveQueue([...queueRef.current, it]);
  const syncQueue = async () => {
    if (TOKEN) flushPenalty();
    if (!TOKEN || syncing.current || !queueRef.current.length) return;
    syncing.current = true; let ok = 0, pointsEarned = 0, chs = [];
    for (const it of [...queueRef.current]) {
      try { const r = await api(`/tree/${it.kod}/visit`, { json: it }); ok++; pointsEarned += r.total || 0; if (r.challenges) chs = chs.concat(r.challenges); }
      catch (e) { if (!e.code || e.code === 401) break; }   // síť/odhlášení → zkusit později; ostatní chyby (409…) položku zahodí
      saveQueue(queueRef.current.filter((x) => x !== it));
    }
    syncing.current = false;
    if (ok) {
      if (chs.length) celebrate(pointsEarned, chs);
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
    flyTo({ center: [pos.lon, pos.lat], zoom: 15.5, duration: 1500 });
  }, [pos]);

  /* nejbližší nenavštívené stromy (levný průchod s ploskou aproximací, přesná vzdálenost jen pro pár kandidátů) */
  const grid = useMemo(() => buildGrid(points), [points]);
  const near = useMemo(() => {
    if (!pos || !points.length) return [];
    const seen = new Set(), out = [];
    for (const [, p] of nearestUnvisited(points, grid, visited, pos, 40)) { if (seen.has(p[0])) continue; seen.add(p[0]); out.push({ d: hav(pos.lat, pos.lon, p[3], p[2]), p, pos }); }
    out.sort((a, b) => a.d - b.d);
    return out.slice(0, 10);
  }, [pos && Math.round(pos.lat * 20000), pos && Math.round(pos.lon * 20000), points, visited]);

  /* série (se zmrazením dnů) ze serveru; strom dne podle serveru (stejný pro všechny) */
  const [streak, setStreak] = useState(null), [todKod, setTodKod] = useState(null);
  const loadStreak = useCallback(() => { if (TOKEN) api('/me/streak').then(setStreak).catch(() => {}); }, []);
  useEffect(() => { if (!me) { setStreak(null); return; } loadStreak(); }, [me && me.id, visited.size]);
  useEffect(() => { api('/tree-of-day').then((r) => setTodKod(r.kod)).catch(() => {}); }, [tab === 'radar', me && me.id]);
  const todPoint = useMemo(() => (todKod && points.find((p) => p[0] === todKod)) || dayTree(points), [todKod, points]);
  /* widget: živý update, nejvýš jednou za 15 s (koncová pauza, takže poslední změna se vždy odešle) */
  const wTimer = useRef(null), wLast = useRef(0);
  useEffect(() => {
    const push = () => {
      const n = near[0], now = Date.now(); wLast.current = now;
      const snap = { streak: streak ? streak.current : 0, treeName: n ? n.p[1] : '', distance: n ? fmtD(n.d) : '', kod: n ? n.p[0] : 0, tod: todPoint ? todPoint[1] : '', todKod: todPoint ? todPoint[0] : 0, visits: visited.size, ts: now };
      AsyncStorage.setItem('sb_widget', JSON.stringify({ streak: snap.streak, tod: snap.tod, visits: snap.visits })).catch(() => {});
      TreeWidget.updateSnapshot(snap);
    };
    clearTimeout(wTimer.current);
    wTimer.current = setTimeout(push, Math.max(0, 15000 - (Date.now() - wLast.current)));
    return () => clearTimeout(wTimer.current);
  }, [streak && streak.current, near[0] && near[0].p[0], near[0] && Math.round(near[0].d / 10), visited.size, todPoint && todPoint[0]]);

  /* haptika + oznámení při vstupu do dosahu */
  useEffect(() => {
    const n = near[0];
    if (n && n.d <= RADIUS && lastIn.current !== n.p[0]) {
      lastIn.current = n.p[0];
      if (!isQuietNow(settings)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast(`Jsi u stromu „${n.p[1]}“! Můžeš ho odkliknout.`, 'map-marker-check');
        if (settings.nearbyNotif) Notifications.scheduleNotificationAsync({ content: { title: 'Strom poblíž 🌳', body: `Jsi u stromu „${n.p[1]}“.` }, trigger: { channelId: 'nearby' } }).catch(() => {});
      }
    } else if (n && n.d > RADIUS + 15) lastIn.current = null;
  }, [near, settings.nearbyNotif]);

  /* data mapy (filtr se aplikuje na zdroj, aby seděly počty ve shlucích) */
  const shown = useMemo(() => applyFilter(points, flt, visited, taken, favorites, !!(me && me.plus)), [points, flt, visited, taken, favorites, me && me.plus]);
  const geo = useMemo(() => fc(shown.map((p) => pointF(p[2], p[3], { k: p[0], v: visited.has(p[0]) ? 1 : 0, pa: p[9] ? 1 : 0 }))), [shown, visited]);
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
    if (fly && t) flyTo({ center: t.pts[0], zoom: 16.5, padding: { top: 0, right: 0, bottom: 420, left: 0 }, duration: 700 });
  }, [byKod]);
  pressRef.current = async (e) => {
    const ne = e && e.nativeEvent, f = ne && ne.features && ne.features[0]; if (!f) return;
    if (f.properties.cluster) {
      const z = await src.current.getClusterExpansionZoom(f.properties.cluster_id);
      flyTo({ center: f.geometry.coordinates, zoom: z + 0.5, duration: 500 });
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
    AsyncStorage.getItem('sb_me').then((c) => { const o = jparse(c, null); if (o) { o.visited = [...new Set([...(o.visited || []), kod])]; AsyncStorage.setItem('sb_me', JSON.stringify(o)); } }).catch(() => {});
    setTimeout(loadStreak, 600);
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
  const toggleHeat = async () => {
    if (heatOn) return setHeatOn(false);
    if (!me) return setAuth('login');
    if (!me.plus) return setPlusOpen(true);
    try { const r = await api('/me/heatmap'); setHeatPoints(r.points || []); setHeatOn(true); }
    catch (e) { toast(e.message || 'Tepelnou mapu se nepodařilo načíst.', 'alert-circle-outline'); }
  };
  const buyPlus = async (product, selectedOffer) => {
    if (!me) { setPlusOpen(false); return setAuth('login'); }
    try {
      setIapError(''); setIapBusy(true);
      const offer = selectedOffer || trialOffer(product) || product.subscriptionOffers?.find((x) => x.offerTokenAndroid);
      integrityPurchase.current = await getIntegrityPayload(product.id);
      await iap.requestPurchase({ type: 'subs', request: { google: { skus: [product.id], ...(offer ? { subscriptionOffers: [{ sku: product.id, offerToken: offer.offerTokenAndroid }] } : {}) } } });
    } catch (e) { integrityPurchase.current = null; setIapBusy(false); setIapError(e.message || 'Nákupní dialog Google Play se nepodařilo otevřít.'); }
  };
  const buyInapp = async (productId, pending) => {
    if(!me)throw new Error('Nejdřív se přihlas.');
    if(!INAPP_PRODUCTS.includes(productId))throw new Error('Tento produkt není nakonfigurován.');
    inappPurchase.current={productId,payload:pending};setIapError('');setIapBusy(true);
    try { await iap.requestPurchase({type:'in-app',request:{google:{skus:[productId]}}}); }
    catch(e){inappPurchase.current=null;setIapBusy(false);throw e;}
  };
  const restorePlus = async () => {
    setIapError(''); restoreError.current = false; setIapBusy(true);
    try {
      setRestorePending(true); await iap.getAvailablePurchases(); toast('Kontroluji nákupy Google Play…', 'restore');
      restoreTimer.current = setTimeout(() => { setRestorePending(false); setIapBusy(false); if (!(me && me.plus)) setIapError('Nenašli jsme aktivní předplatné Stromobraní Plus.'); }, 10000);
    }
    catch (e) { setIapError(e.message || 'Nákupy se nepodařilo obnovit.'); setIapBusy(false); }
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
    if (l.type === 'pozvanka') { linkRef.current = null; setInvite(l.id); return; }
    if (l.type === 'vyprava') { linkRef.current = null; setTab('comm'); setTripCode(l.code); return; }
    if (l.type === 'uzivatel') { linkRef.current = null; openProfile(l.id); return; }
    if (byKod[l.id]) {
      linkRef.current = null;
      openTree(l.id);
    }
    else if (ready) { linkRef.current = null; toast('Tento strom se nepodařilo najít', 'tree-outline'); }
  };
  useEffect(() => { applyRef.current(); }, [byKod, ready]);


  /* ---------- 1.6.0: nové stavy a obsluha ---------- */
  const [planner, setPlanner] = useState(false), [tripDraft, setTripDraft] = useState(null), [tripCode, setTripCode] = useState(null), [tripsKey, setTripsKey] = useState(0);
  const [coll, setColl] = useState(false), [wrapped, setWrapped] = useState(false), [diary, setDiary] = useState(false), [invite, setInvite] = useState(null);
  const [fogOn, setFogOn] = useState(false), [fogF, setFogF] = useState(null), [fogSel, setFogSel] = useState(null);
  const [ro, setRoS] = useState(DEF_RO);
  const setRo = useCallback((fn) => setRoS((o) => { const n = typeof fn === 'function' ? fn(o) : { ...o, ...fn }; AsyncStorage.setItem('sb_ro', JSON.stringify(n)).catch(() => {}); return n; }), []);
  useEffect(() => { AsyncStorage.getItem('sb_ro').then((v) => { const o = jparse(v, null); if (o) setRoS({ ...DEF_RO, ...o }); }).catch(() => {}); ensureChannels(); }, []);
  const openPlanner = () => { if (!me) return setAuth('login'); if (!me.plus) return setPlusOpen(true); setPlanner(true); };
  const freezeStreak = async () => {
    try {
      const adId = streak && streak.needs_ad ? await rewardMode('streak_freeze', {}, me.id, me.tier) : null;
      const r = await api('/me/streak/freeze', { json: { adRewardId: adId || undefined } });
      setStreak(r.streak); toast('Série zachráněna ❄️', 'snowflake');
    } catch (e) { toast(e.message || 'Zmrazení se nepodařilo.', 'alert-circle-outline'); }
  };
  /* oznámení: plánovač (denní připomenutí, strom dne, záchrana série) + klepnutí na oznámení otevře strom */
  useEffect(() => { if (ready) syncNotifications(settings, points, streak); }, [ready, settings.dailyReminder, settings.reminderHour, settings.reminderMin, settings.todNotif, settings.todHour, settings.todMin, settings.streakNotif, settings.streakHour, settings.streakMin, points.length, streak && streak.current, streak && streak.today]);
  useEffect(() => {
    const handle = async (r) => {
      const k = r && r.notification.request.content.data && r.notification.request.content.data.kod;
      if (!k) return;
      const id = r.notification.request.identifier + ':' + (r.notification.date || 0);
      if ((await AsyncStorage.getItem('sb_last_notif')) === id) return;
      AsyncStorage.setItem('sb_last_notif', id).catch(() => {});
      linkRef.current = { type: 'strom', id: +k }; applyRef.current();
    };
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
    return () => sub.remove();
  }, []);
  /* upozornění na pozadí: geofencing se přepočítá po 600 m pohybu nebo po novém odkliku */
  const geoPos = useRef(null), geoKey = useRef('');
  useEffect(() => {
    if (!settings.bgNearby) { geoPos.current = null; stopGeofences(); return; }
    if (!pos || !ready) return;
    const l = geoPos.current;
    if (l && hav(l.lat, l.lon, pos.lat, pos.lon) < 600 && geoKey.current === String(visited.size)) return;
    geoPos.current = { lat: pos.lat, lon: pos.lon }; geoKey.current = String(visited.size);
    setupGeofences(pos);
  }, [settings.bgNearby, settings.nearbyRadius, pos && Math.round(pos.lat * 200), pos && Math.round(pos.lon * 200), ready, visited.size]);
  /* mlha okresů */
  const fogData = useRef(null);
  const buildFog = (r) => setFogF({ type: 'FeatureCollection', features: fogData.current.features.map((f) => { const [mine, total] = r.districts[f.properties.n] || [0, 0]; return { ...f, properties: { n: f.properties.n, mine, total, pct: total ? Math.floor((mine / total) * 100) : 0 } }; }) });
  const toggleFog = async (force) => {
    if (fogOn && !force) { setFogOn(false); setFogSel(null); return; }
    if (!me) return setAuth('login');
    try {
      toast('Načítám mlhu okresů…', 'weather-fog');
      if (!fogData.current) fogData.current = await api('/districts/geo');
      buildFog(await api('/me/districts')); setFogOn(true);
    } catch (e) { toast(e.message || 'Mlhu se nepodařilo načíst.', 'alert-circle-outline'); }
  };
  useEffect(() => { if (fogOn && fogData.current) api('/me/districts').then(buildFog).catch(() => {}); }, [visited.size]);
  const onFogPress = useCallback((e) => { const ne = e && e.nativeEvent, f = ne && ne.features && ne.features[0]; if (f) setFogSel(f.properties); }, []);

  const nearIn = near[0] && near[0].d <= RADIUS;
  return (
    <View style={{ flex: 1, backgroundColor: C.cream }}>
      <StatusBar barStyle={Platform.OS === 'android' && settings.darkMode ? 'light-content' : 'dark-content'} />
      {/* nativní mapa se na ostatních záložkách úplně odpojí (žádné překryvy ani záblesky a šetří baterii); po návratu se obnoví na stejném místě */}
      {tab === 'map' && <MapBase mapRef={mapRef} cam={cam} src={src} geo={geo} range={range} meF={meF} heatF={heatOn ? heatF : null} onPress={onMapPress} tabh={TABH} rot={settings.rot} ctop={ins.top + 130} initCam={lastCam.current} onRegion={onMapIdle} fogOn={fogOn} fogF={fogF} onFog={onFogPress} layerId={resolveLayer(mapSt.sel, mapSt.down)} layerReady={mapSt.ready} onFail={onMapFail} />}

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
        <Fab bottom={TABH + 14} icon="crosshairs-gps" onPress={() => pos && flyTo({ center: [pos.lon, pos.lat], zoom: 16.5, duration: 600 })} />
        <Fab bottom={TABH + 74} icon="layers-outline" onPress={() => setLayersOpen(true)} />
        <Fab bottom={TABH + 134} icon={heatOn ? 'fire' : 'fire-circle'} onPress={toggleHeat} />
        <Fab bottom={TABH + 194} icon="download" badge={queue.length} onPress={() => setOff(true)} />
        <Fab bottom={TABH + 254} icon="filter-variant" badge={nF} badgeColor={C.moss} onPress={() => setFOpen(true)} />
        <Fab bottom={TABH + 314} icon="tree-outline" onPress={() => openSuggest({ kind: 'new' })} />
        <Fab bottom={TABH + 374} icon={fogOn ? 'weather-sunny' : 'weather-fog'} onPress={() => toggleFog()} />
      </>)}

      {/* panely */}
      {tab === 'radar' && <Radar near={near} heading={heading} points={points} top={ins.top} bottom={TABH} visited={visited} onOpen={openTree} onShow={openTree} isPlus={!!(me && me.plus)} onPlus={() => setPlusOpen(true)} day={todPoint} streak={streak} onFreeze={freezeStreak} onPlan={openPlanner} />}
      {tab === 'comm' && <Community me={me} top={ins.top} bottom={TABH} onProfile={openProfile} onPlus={() => setPlusOpen(true)} onAuth={() => setAuth('login')} toast={toast} onPlan={openPlanner} onTripOpen={setTripCode} tripsKey={tripsKey} settings={settings} />}
      {tab === 'prof' && <Profile id={profId} me={me} top={ins.top} bottom={TABH} toast={toast} onAuth={() => setAuth('login')} onTree={openTree} onProfile={openProfile} onLogout={logout} onEdit={() => setAuth('edit')} onDelete={deleteAccount} onSettings={() => setSett(true)} onPlus={() => setPlusOpen(true)} onGift={()=>setGiftOpen(true)} onPurchase={buyInapp} allSpecies={species.map(([name]) => name).filter((name) => name !== 'Jiný')} points={points} streak={streak} onFreeze={freezeStreak} onCollections={() => setColl(true)} onWrapped={() => setWrapped(true)} onDiary={() => setDiary(true)} />}
      {tab === 'map' && sel && byKod[sel] && (
        <TreeSheet kod={sel} tree={byKod[sel]} pos={pos} me={me} bottom={TABH} onClose={() => setSel(null)} onAuth={() => setAuth('login')}
          onVisited={onVisited} toast={toast} onProfile={openProfile} queued={queue} onQueue={addQueue} favorites={favorites} onFavorite={toggleFavorite} onSuggest={openSuggest} onPlus={() => setPlusOpen(true)} ro={ro} setRo={setRo} />
      )}
      {tab === 'map' && !sel && !!fogSel && <FogCard f={fogSel} bottom={TABH} onClose={() => setFogSel(null)} />}

      {/* spodní lišta */}
      <View style={[s.nav, { height: TABH, paddingBottom: ins.bottom }]}>
        {[['map', 'map-outline', 'map', 'Mapa'], ['radar', 'radar', 'radar', 'Radar'], ['comm', 'account-group-outline', 'account-group', 'Komunita'], ['prof', 'account-circle-outline', 'account-circle', 'Profil']].map(([k, ico, icoOn, l]) => (
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
      {fOpen && <FilterModal init={flt} points={points} visited={visited} taken={taken} species={species} dendro={dendro} loadTaken={loadTaken} onApply={applyFlt} onClose={() => setFOpen(false)} favorites={favorites} isPlus={!!(me && me.plus)} onPlus={() => setPlusOpen(true)} />}
      {layersOpen && <MapLayersModal sel={mapSt.sel} down={mapSt.down} onPick={pickLayer} onClose={() => setLayersOpen(false)} />}
      {off && <OfflineModal onClose={() => { setOff(false); }} mapRef={mapRef} pos={pos} meta={meta} queue={queue} settings={settings} onTrees={() => downloadTrees(true, false)} onSync={syncQueue} onSettings={() => { setOff(false); setSett(true); }} toast={toast} msg={msg && msg.t} isPlus={!!(me && me.plus)} onPlus={() => setPlusOpen(true)} />}
      {sett && <SettingsModal me={me} settings={settings} onSet={setSetting} onClose={() => setSett(false)} onMe={patchMe} />}
      <PlusModal visible={plusOpen} onClose={() => setPlusOpen(false)} products={iap.subscriptions || []} loading={!iap.connected || iapBusy} error={iapError} onBuy={buyPlus} onRestore={restorePlus} plus={!!(me && me.plus)} tier={me?.tier || 'free'} />
      {!!integrityMsg && <Modal visible transparent animationType="fade" onRequestClose={() => {}}><View style={{ flex: 1, backgroundColor: '#122719f2', justifyContent: 'center', padding: 24 }}><View style={{ backgroundColor: C.paper, borderRadius: 22, padding: 22 }}>
        <View style={{ alignItems: 'center' }}><Ic n="shield-alert-outline" s={44} c={C.red} /><Text style={[s.h2, { marginTop: 8, textAlign: 'center' }]}>Aplikaci nelze spustit</Text></View>
        <Text style={[s.b, { marginTop: 10, textAlign: 'center' }]}>{integrityMsg}</Text>
        <Text style={[s.sm, { marginTop: 8, textAlign: 'center' }]}>Stromobraní běží jen na neupravených zařízeních s aplikací nainstalovanou z Google Play.</Text>
        <View style={{ marginTop: 16 }}><Btn icon="refresh" title="Zkusit znovu" onPress={() => { verifyAppIntegrity().catch(() => {}); }} /></View>
        <View style={{ marginTop: 8 }}><Btn ghost icon="logout" title="Odhlásit se" onPress={logout} /></View>
      </View></View></Modal>}
      <GiftModal visible={giftOpen} onClose={()=>setGiftOpen(false)} onBuy={buyInapp} />
      {!!incomingGift&&<Modal visible transparent animationType="fade" onRequestClose={()=>{}}><View style={{flex:1,backgroundColor:'#122719dd',justifyContent:'center',padding:20}}><View style={[s.card,{padding:24,backgroundColor:incomingGift.style==='gold'?'#fbf0cf':incomingGift.style==='forest'?'#eaf2df':'#fffdf6'}]}><Ic n="gift" s={60} c={incomingGift.style==='gold'?C.sun:C.moss}/><Text style={[s.h2,{textAlign:'center',marginTop:8}]}>{incomingGift.style==='winter'?'Veselé Vánoce! 🌟':incomingGift.style==='forest'?'Pozdrav z lesa 🌲':'Dárek plný výprav ✨'}</Text><Text style={[s.sm,{textAlign:'center',marginTop:10}]}><Text style={s.b}>{incomingGift.giver}</Text> ti věnoval(a) rok Stromobraní {incomingGift.tier==='extra'?'EXTRA':'Plus'}.</Text>{!!incomingGift.message&&<Text style={{color:C.ink,textAlign:'center',marginTop:14,fontSize:16}}>{incomingGift.message}</Text>}<Btn title="Přijmout dárek" onPress={async()=>{try{await api(`/me/gifts/${incomingGift.id}/seen`);await loadMe();setIncomingGift(null);toast('Dárek je aktivní. Krásné výpravy! 🌳','gift');}catch(e){setIncomingGift(null);}}}/></View></View></Modal>}
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
      {planner && <TripPlanner onClose={() => setPlanner(false)} pos={pos} points={points} grid={grid} visited={visited} ro={ro} setRo={setRo} toast={toast} onShare={(stops) => setTripDraft({ stops })} />}
      {!!tripDraft && <TripCreate draft={tripDraft} points={points} onClose={() => setTripDraft(null)} toast={toast} onCreated={(code) => { setTripDraft(null); setTripsKey((k) => k + 1); setTab('comm'); setTripCode(code); }} />}
      {!!tripCode && <TripDetail code={tripCode} me={me} onClose={() => setTripCode(null)} toast={toast} onTree={openTree} onAuth={() => setAuth('login')} onChanged={() => setTripsKey((k) => k + 1)} />}
      {coll && <CollectionsModal onClose={() => setColl(false)} toast={toast} onFog={() => { setColl(false); setTab('map'); toggleFog(true); }} />}
      {wrapped && <WrappedModal onClose={() => setWrapped(false)} toast={toast} />}
      {diary && <DiaryModal onClose={() => setDiary(false)} onTree={openTree} toast={toast} />}
      {invite != null && <InviteModal id={invite} me={me} onClose={() => setInvite(null)} onAuth={() => setAuth('login')} onProfile={openProfile} toast={toast} />}
      {auth && <Auth mode={auth} me={me} onClose={() => setAuth(null)} onDone={authDone} onMe={patchMe} />}
      {!!suggesting && <SuggestModal draft={suggesting} pos={pos} toast={toast} onClose={() => setSuggesting(null)} />}
    </View>
  );
}
export default function App() { return <SafeAreaProvider><Main /></SafeAreaProvider>; }

/* ============================== styly ============================== */
const s = StyleSheet.create({
  plusLock: { minHeight: 150, borderRadius: 20, overflow: 'hidden', marginTop: 10, backgroundColor: '#e8efd9', borderWidth: 1, borderColor: '#cbdab8' },
  plusBlur: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 8, transform: [{ scale: 1.12 }] },
  plusOverlay: { flex: 1, minHeight: 150, padding: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fffdf6d9' },
  plusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 99, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: C.forest },
  plusCta: { marginTop: 10, borderRadius: 99, backgroundColor: C.moss, paddingVertical: 10, paddingHorizontal: 18 },
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

/* doplňkové styly (1.5.1) */
const s2 = StyleSheet.create({
  tile: { flexGrow: 1, flexBasis: '30%', minWidth: 96, minHeight: 76, backgroundColor: C.cream, borderWidth: 1.5, borderColor: C.line, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 8, gap: 6, shadowColor: '#1f3d2b', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  tileWide: { flexBasis: '45%', minHeight: 54, flexDirection: 'row', gap: 8, paddingVertical: 10 },
  tileT: { color: C.forest, fontWeight: '800', fontSize: 14, textAlign: 'center', flexShrink: 1 },
  actRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.cream, borderWidth: 1.5, borderColor: C.line, borderRadius: 18, padding: 12, shadowColor: '#1f3d2b', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  actIc: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#eef6e4', alignItems: 'center', justifyContent: 'center' },
  actT: { color: C.ink, fontWeight: '800', fontSize: 15 },
  bdgBox: { minHeight: 78, paddingVertical: 10, gap: 4, justifyContent: 'center' },
  patron: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fbf1d6', borderWidth: 1.5, borderColor: C.sun, borderRadius: 16, padding: 11, marginTop: 10 },
  patronIc: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.sun, alignItems: 'center', justifyContent: 'center' },
});
