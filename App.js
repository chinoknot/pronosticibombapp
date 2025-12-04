// App.js

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  Linking,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";

// =======================
// CONFIG SUPABASE
// =======================
const SUPABASE_URL = "https://oiudaxsyvhjpjjhglejd.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pdWRheHN5dmhqcGpqaGdsZWpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMDk0OTcsImV4cCI6MjA3OTU4NTQ5N30.r7kz3FdijAhsJLz1DcEtobJLaPCqygrQGgCPpSc-05A";

// favicon del sito
const APP_ICON_URL =
  "https://raw.githubusercontent.com/chinoknot/pronosticibomba-site/main/favicon.png";

// =======================
// UTILS
// =======================
function pad2(n) {
  return n < 10 ? "0" + n : "" + n;
}

function todayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = pad2(now.getMonth() + 1);
  const d = pad2(now.getDate());
  return `${y}-${m}-${d}`;
}

function formatDateIT(str) {
  if (!str) return "";
  const parts = str.split("-");
  if (parts.length !== 3) return str;
  const [y, m, d] = parts.map(Number);
  const dt = new Date(y, m - 1, d);
  const weekday = dt.toLocaleDateString("it-IT", { weekday: "long" });
  const day = pad2(dt.getDate());
  const month = dt.toLocaleDateString("it-IT", { month: "long" });
  return `${weekday} ${day} ${month} ${y}`;
}

function getDateStrOffset(offsetDays) {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  const y = now.getFullYear();
  const m = pad2(now.getMonth() + 1);
  const d = pad2(now.getDate());
  return `${y}-${m}-${d}`;
}

function safeOdd(o) {
  const n = Number(o);
  if (!isFinite(n) || n <= 1) return 1.0;
  return n;
}

async function sbFetch(table, query) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer " + SUPABASE_ANON_KEY,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error ${res.status}: ${text}`);
  }
  return await res.json();
}

function parseMatchDateTime(row) {
  const d = row.match_date;
  const t = row.match_time;
  if (!d || !t) return null;
  const [h, m] = t.split(":").map((x) => parseInt(x, 10));
  const [yy, mm, dd] = d.split("-").map((x) => parseInt(x, 10));
  if (!yy || !mm || !dd || isNaN(h) || isNaN(m)) return null;
  return new Date(yy, mm - 1, dd, h, m);
}

function groupByCategory(picks) {
  const map = new Map();
  for (const p of picks) {
    const cat = p.category || "OTHER";
    if (!map.has(cat)) {
      map.set(cat, []);
    }
    map.get(cat).push(p);
  }
  return map;
}

function sortCategoriesOrder(categories) {
  const preferred = [
    "BEST_TIPS_OF_DAY",
    "SAFE_PICKS",
    "VALUE_PICKS",
    "OVER_UNDER_TIPS",
    "BTTS_TIPS",
    "DAILY_2PLUS",
    "DAILY_10PLUS",
    "SINGLE_GAME",
    "TOP_5_TIPS",
  ];
  return categories.sort((a, b) => {
    const ia = preferred.indexOf(a);
    const ib = preferred.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

function classifyResult(resultRaw) {
  const res = (resultRaw || "").toUpperCase();
  if (res === "WIN") return "win";
  if (res === "LOSE") return "lose";
  if (res === "PENDING") return "pending";
  if (res === "UNKNOWN") return "unknown";
  return "";
}

// Nomi eleganti categorie
const CATEGORY_LABELS = {
  BEST_TIPS_OF_DAY: "Scelte d’Élite",
  SAFE_PICKS: "Selezioni Affidabili",
  VALUE_PICKS: "Quote di Valore",
  OVER_UNDER_TIPS: "Tendenze Goal",
  BTTS_TIPS: "Probabilità Entrambe",
  DAILY_2PLUS: "Combo Selettiva",
  DAILY_10PLUS: "Combo High Stakes",
  SINGLE_GAME: "Pick Esclusiva",
  TOP_5_TIPS: "Top 5 Esclusive",
};

function getCategoryLabel(cat) {
  const k = (cat || "").trim().toUpperCase();
  return CATEGORY_LABELS[k] || (cat || "Altro").replace(/_/g, " ");
}

// Reliability (come web)
function reliabilityLabel(played, winrate, needed) {
  if (!played || played <= 0 || !winrate || !needed) return "N/D";
  if (played < 30) return "Dati pochi (campione ridotto)";
  const diff = winrate - needed;
  if (diff >= 10) return "Molto solida";
  if (diff >= 5) return "Buona";
  if (diff >= 0) return "Sul confine";
  if (diff >= -5) return "Debole";
  return "Negativa";
}

// =======================
// COMPONENTI GENERICI
// =======================

const Accordion = ({ title, subtitle, children, initiallyOpen = false }) => {
  const [open, setOpen] = useState(initiallyOpen);

  return (
    <View style={styles.accordionContainer}>
      <TouchableOpacity
        onPress={() => setOpen(!open)}
        style={styles.accordionHeader}
        activeOpacity={0.8}
      >
        <View>
          <Text style={styles.accordionTitle}>{title}</Text>
          {subtitle ? (
            <Text style={styles.accordionSubtitle}>{subtitle}</Text>
          ) : null}
        </View>
        <Text style={styles.accordionChevron}>{open ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {open ? <View style={styles.accordionBody}>{children}</View> : null}
    </View>
  );
};

const TabButton = ({ label, active, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.tabButton, active && styles.tabButtonActive]}
    activeOpacity={0.8}
  >
    <Text
      style={[styles.tabButtonText, active && styles.tabButtonTextActive]}
      numberOfLines={1}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

// =======================
// SCREEN: Picks di oggi
// =======================
const TodayPicksScreen = () => {
  const [loading, setLoading] = useState(true);
  const [picksByCategory, setPicksByCategory] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const today = todayStr();
      const picks = await sbFetch(
        "picks",
        `?run_date=eq.${today}&match_date=eq.${today}&select=*`
      );

      if (!Array.isArray(picks) || !picks.length) {
        setPicksByCategory([]);
        setLoading(false);
        return;
      }

      const results = await sbFetch(
        "results",
        `?picks_date=eq.${today}&select=*`
      );
      const resultMap = new Map();
      if (Array.isArray(results)) {
        for (const r of results) {
          if (r.fixture_id && r.pick) {
            const key = String(r.fixture_id) + "__" + String(r.pick).trim();
            resultMap.set(key, r);
          }
        }
      }

      const byCat = groupByCategory(picks);
      const cats = sortCategoriesOrder(Array.from(byCat.keys()));

      const out = cats.map((cat) => {
        const list = [...(byCat.get(cat) || [])];
        list.sort((a, b) => {
          const da = parseMatchDateTime(a);
          const db = parseMatchDateTime(b);
          if (da && db) return da - db;
          if (da) return -1;
          if (db) return 1;
          return 0;
        });

        const total = list.length;
        let wins = 0;
        let loses = 0;

        for (const p of list) {
          const key = String(p.fixture_id) + "__" + String(p.pick || "").trim();
          const res = resultMap.get(key);
          const rLabel = (res && res.result ? res.result : "").toUpperCase();
          if (rLabel === "WIN") wins++;
          if (rLabel === "LOSE") loses++;
        }

        return {
          catKey: cat,
          label: getCategoryLabel(cat),
          total,
          wins,
          loses,
          picks: list,
          resultMap,
        };
      });

      setPicksByCategory(out);
    } catch (e) {
      setError(e.message || "Errore nel caricamento");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openSnack = () => {
    Linking.openURL("https://www.buymeacoffee.com/pronosticibomba");
  };

  const renderPickCard = (p, resultMap) => {
    const dt = parseMatchDateTime(p);
    const timeStr = dt
      ? dt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
      : p.match_time || "-";

    const oddNum = Number(p.odd || 0);
    const oddStr = oddNum ? oddNum.toFixed(2) : "-";

    const key = String(p.fixture_id) + "__" + String(p.pick || "").trim();
    const res = resultMap.get(key);
    const resResult = res ? res.result : "";
    const resScore = res ? res.final_score : "";

    const resultClass = classifyResult(resResult);
    const resultLabel = (resResult || "").toUpperCase();
    const finalScore = resScore || "";
    const badgeText = resultLabel
      ? finalScore
        ? `${resultLabel} · ${finalScore}`
        : resultLabel
      : "";

    const badgeStyle =
      resultClass === "win"
        ? styles.badge_pos
        : resultClass === "lose"
        ? styles.badge_neg
        : resultClass === "pending"
        ? styles.badge_pending
        : resultClass === "unknown"
        ? styles.badge_unknown
        : styles.badgeNeutral;

    return (
      <View key={key} style={[styles.pickCard, styles[resultClass]]}>
        <View style={styles.pickHeader}>
          <Text style={styles.leaguePill} numberOfLines={1} ellipsizeMode="tail">
            {p.league || ""} ({p.country || ""})
          </Text>
          <Text style={styles.matchTime}>{timeStr}</Text>
        </View>
        <Text
          style={styles.teams}
          numberOfLines={1}
          ellipsizeMode="tail"
        >{`${p.home || ""} – ${p.away || ""}`}</Text>
        <View style={styles.pickMain}>
          <Text style={styles.pickLabel}>{p.pick || ""}</Text>
          <Text style={styles.oddLabel}>@ {oddStr}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.scoreText}>
            <Text style={styles.scoreStrong}>Confidenza modello: </Text>
            {(() => {
              const val = Number(p.score || 0) * 100;
              if (val > 130) return "molto alta";
              if (val > 110) return "alta";
              if (val > 90) return "medio-alta";
              if (val > 70) return "media";
              if (val > 50) return "bassa";
              return "rischiosa";
            })()}
          </Text>
          {badgeText ? (
            <Text style={[styles.resultBadge, badgeStyle]}>{badgeText}</Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}
    >
     {/* HEADER */}
<View style={styles.appHeaderCard}>
  <View style={styles.appHeaderRow}>
    <Image
      source={{ uri: APP_ICON_URL }}
      style={styles.appIcon}
      resizeMode="contain"
    />
    <View style={styles.appHeaderText}>
      <Text style={styles.appTitle}>PRONOSTICI BOMBA</Text>
      <Text style={styles.appSubtitle}>
        Pronostici da modelli statistici con ROI reale e storico sempre visibile e a portata di mano.
      </Text>
    </View>
  </View>

  <View style={styles.headerDateRow}>
  <View style={styles.fullDateBadge}>
    <Text style={styles.fullDateText}>{formatDateIT(todayStr())}</Text>
  </View>
</View>
</View>


      <Text style={styles.subtitle}>
        I pronostici non sono copiati da altri siti: vengono generati giorno per
        giorno da modelli che analizzano quote, statistiche e dati storici. Vedi
        solo partite che superano determinati filtri di qualità e sono
        organizzate per famiglia di selezioni, rischio e valore.
      </Text>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator />
          <Text style={styles.muted}>Carico i picks di oggi...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.muted}>{error}</Text>
        </View>
      ) : picksByCategory.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={styles.muted}>
            Nessun pick disponibile per oggi. Riapri l’app quando lo scraper
            avrà generato nuovi pronostici.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.categoriesContainer}>
            {picksByCategory.map((cat) => (
              <Accordion
                key={cat.catKey}
                title={cat.label}
                subtitle={`${cat.total} picks · ${cat.wins} win / ${cat.loses} lose`}
                initiallyOpen={false}
              >
                {cat.picks.map((p) => renderPickCard(p, cat.resultMap))}
              </Accordion>
            ))}
          </View>

          {/* SNACK BUTTON SOTTO GLI ACCORDION */}
          <View style={styles.snackButtonWrapper}>
            <TouchableOpacity
              onPress={openSnack}
              style={styles.snackButton}
              activeOpacity={0.85}
            >
              <Text style={styles.snackCookie}>🍪</Text>
              <Text style={styles.snackText}>Compra uno snack per Ralph</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
};

// =======================
// SCREEN: Storico picks (per data)
// =======================
const PicksHistoryScreen = () => {
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dailySummary, setDailySummary] = useState(null);
  const [picksByCategory, setPicksByCategory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadForDate = useCallback(async (date) => {
    try {
      setLoading(true);
      setError(null);

      const picks = await sbFetch("picks", `?run_date=eq.${date}&select=*`);
      if (!Array.isArray(picks) || !picks.length) {
        setPicksByCategory([]);
        setDailySummary(null);
        setLoading(false);
        return;
      }

      const results = await sbFetch(
        "results",
        `?picks_date=eq.${date}&select=*`
      );
      const resultMap = new Map();
      if (Array.isArray(results)) {
        for (const r of results) {
          if (r.fixture_id && r.pick) {
            const key =
              String(r.fixture_id) +
              "__" +
              String(r.category || "").trim() +
              "__" +
              String(r.pick).trim();
            resultMap.set(key, r);
          }
        }
      }

      let totalPicks = picks.length;
      let wins = 0;
      let loses = 0;
      let pending = 0;
      let nd = 0;
      let stakeRoi = 0;
      let profitNet = 0;

      for (const p of picks) {
        const key =
          String(p.fixture_id) +
          "__" +
          String(p.category || "").trim() +
          "__" +
          String(p.pick || "").trim();
        const res = resultMap.get(key);
        const resultLabel = (res && res.result ? res.result : "").toUpperCase();

        const odd = safeOdd(p.odd);

        if (resultLabel === "WIN") {
          wins++;
          stakeRoi++;
          profitNet += odd - 1;
        } else if (resultLabel === "LOSE") {
          loses++;
          stakeRoi++;
          profitNet -= 1;
        } else if (resultLabel === "PENDING") {
          pending++;
        } else {
          nd++;
        }
      }

      const roi =
        stakeRoi > 0 ? ((profitNet / stakeRoi) * 100).toFixed(1) : "-";

      const dailySummaryObj = {
        date,
        totalPicks,
        wins,
        loses,
        pending,
        nd,
        stakeRoi,
        profitNet,
        roi,
      };

      const byCat = groupByCategory(picks);
      const cats = sortCategoriesOrder(Array.from(byCat.keys()));

      const out = cats.map((cat) => {
        const list = [...(byCat.get(cat) || [])];
        list.sort((a, b) => {
          const da = parseMatchDateTime(a);
          const db = parseMatchDateTime(b);
          if (da && db) return da - db;
          if (da) return -1;
          if (db) return 1;
          return 0;
        });

        let cw = 0;
        let cl = 0;

        for (const p of list) {
          const key =
            String(p.fixture_id) +
            "__" +
            String(p.category || "").trim() +
            "__" +
            String(p.pick || "").trim();
          const res = resultMap.get(key);
          const rLabel = (res && res.result ? res.result : "").toUpperCase();
          if (rLabel === "WIN") cw++;
          if (rLabel === "LOSE") cl++;
        }

        return {
          catKey: cat,
          label: getCategoryLabel(cat),
          total: list.length,
          wins: cw,
          loses: cl,
          picks: list,
          resultMap,
        };
      });

      setDailySummary(dailySummaryObj);
      setPicksByCategory(out);
      setLoading(false);
    } catch (e) {
      setError(e.message || "Errore nel caricamento dello storico picks");
      setLoading(false);
    }
  }, []);

  const loadAvailableDates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const toDate = todayStr();
      const fromDate = getDateStrOffset(-6); // ultimi 7 giorni

      const picks = await sbFetch(
        "picks",
        `?run_date=gte.${fromDate}&run_date=lte.${toDate}&select=run_date`
      );

      const setDates = new Set();
      (picks || []).forEach((p) => {
        if (p.run_date) setDates.add(p.run_date);
      });

      const sortedDates = Array.from(setDates).sort().reverse();
      setAvailableDates(sortedDates);

      const first = sortedDates[0] || null;
      setSelectedDate(first);

      if (first) {
        await loadForDate(first);
      } else {
        setPicksByCategory([]);
        setDailySummary(null);
        setLoading(false);
      }
    } catch (e) {
      setError(e.message || "Errore nel caricamento delle date");
      setLoading(false);
    }
  }, [loadForDate]);

  useEffect(() => {
    loadAvailableDates();
  }, [loadAvailableDates]);

  const onSelectDate = (date) => {
    if (date === selectedDate) return;
    setSelectedDate(date);
    loadForDate(date);
  };

  const renderPickRow = (p, resultMap) => {
    const key =
      String(p.fixture_id) +
      "__" +
      String(p.category || "").trim() +
      "__" +
      String(p.pick || "").trim();
    const res = resultMap.get(key);
    const resResult = res ? res.result : "";
    const resScore = res ? res.final_score : "";
    const resultClass = classifyResult(resResult);
    const resultLabel = (resResult || "").toUpperCase();
    const finalScore = resScore || "";
    const badgeText = resultLabel
      ? finalScore
        ? `${resultLabel} · ${finalScore}`
        : resultLabel
      : "";

    const badgeStyle =
      resultClass === "win"
        ? styles.badge_pos
        : resultClass === "lose"
        ? styles.badge_neg
        : resultClass === "pending"
        ? styles.badge_pending
        : resultClass === "unknown"
        ? styles.badge_unknown
        : styles.badgeNeutral;

    return (
      <View key={key} style={[styles.historyRow, styles[resultClass]]}>
        <Text style={styles.historyRowTitle}>
          {p.league || ""} · {p.home || ""} – {p.away || ""}
        </Text>
        <Text style={styles.historyRowText}>
          Pick: <Text style={styles.bold}>{p.pick || ""}</Text> @{" "}
          {p.odd ? Number(p.odd).toFixed(2) : "-"}
        </Text>
        <Text style={styles.historyRowText}>
          Confidenza modello:{" "}
          {(() => {
            const val = Number(p.score || 0) * 100;
            if (val > 130) return "molto alta";
            if (val > 110) return "alta";
            if (val > 90) return "medio-alta";
            if (val > 70) return "media";
            if (val > 50) return "bassa";
            return "rischiosa";
          })()}
        </Text>
        {badgeText ? (
          <Text style={[styles.resultBadgeSmall, badgeStyle]}>{badgeText}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>Storico Picks</Text>
      <Text style={styles.subtitle}>
        Seleziona una data per vedere il riepilogo della giornata e il dettaglio
        picks per categoria.
      </Text>

      {availableDates.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dateSelectorScroll}
          contentContainerStyle={styles.dateSelectorRow}
        >
          {availableDates.map((d) => (
            <TouchableOpacity
              key={d}
              onPress={() => onSelectDate(d)}
              style={[
                styles.dateChip,
                selectedDate === d && styles.dateChipActive,
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.dateChipText,
                  selectedDate === d && styles.dateChipTextActive,
                ]}
              >
                {d}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator />
          <Text style={styles.muted}>Carico storico picks...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.muted}>{error}</Text>
        </View>
      ) : !dailySummary ? (
        <View style={styles.centerBox}>
          <Text style={styles.muted}>
            Nessun pick disponibile per le date selezionate.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.dailySummaryCard}>
            <Text style={styles.dailySummaryTitle}>
              Riepilogo giornata – {formatDateIT(dailySummary.date)}
            </Text>
            <Text style={styles.dailySummaryText}>
              Totale picks generate: {dailySummary.totalPicks}
            </Text>
            <Text style={styles.dailySummaryText}>
              Esiti: {dailySummary.wins}W / {dailySummary.loses}L /{" "}
              {dailySummary.pending} Pending / {dailySummary.nd} N.D.
            </Text>
            <Text style={styles.dailySummaryText}>
              Profitto netto (stake 1 per pick risolta):{" "}
              {dailySummary.profitNet.toFixed(2)} unità
            </Text>
            <Text style={styles.dailySummaryText}>
              ROI sui picks risolti:{" "}
              {dailySummary.roi === "-" ? "-" : `${dailySummary.roi}%`}
            </Text>
            <Text style={styles.dailySummaryText}>
              Stake considerato per ROI: {dailySummary.stakeRoi} unità (solo
              picks con esito WIN/LOSE)
            </Text>
          </View>

          {picksByCategory.length === 0 ? (
            <View style={styles.centerBox}>
              <Text style={styles.muted}>
                Nessun pick per questa data nelle categorie supportate.
              </Text>
            </View>
          ) : (
            <View style={styles.categoriesContainer}>
              {picksByCategory.map((cat) => (
                <Accordion
                  key={cat.catKey}
                  title={cat.label}
                  subtitle={`${cat.total} picks · ${cat.wins} win / ${cat.loses} lose`}
                  initiallyOpen={false}
                >
                  {cat.picks.map((p) => renderPickRow(p, cat.resultMap))}
                </Accordion>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
};

// =======================
// SCREEN: Storico ROI
// =======================
const RoiHistoryScreen = () => {
  const [rangeDays, setRangeDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [dailyRows, setDailyRows] = useState([]);
  const [categoryRows, setCategoryRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  const loadHistory = useCallback(async (daysBack) => {
    setLoading(true);
    setError(null);

    const toDate = getDateStrOffset(0);
    const fromDate = getDateStrOffset(-daysBack + 1);

    try {
      const rawResults = await sbFetch(
        "results",
        `?picks_date=gte.${fromDate}&picks_date=lte.${toDate}&select=*`
      );

      if (!Array.isArray(rawResults) || !rawResults.length) {
        setDailyRows([]);
        setCategoryRows([]);
        setSummary(null);
        setLoading(false);
        return;
      }

      const latestByKey = new Map();
      for (const r of rawResults) {
        if (!r.fixture_id || !r.pick) continue;
        const key =
          String(r.fixture_id) +
          "__" +
          String(r.category || "").trim() +
          "__" +
          String(r.pick).trim();
        latestByKey.set(key, r);
      }
      const resultsRows = Array.from(latestByKey.values());
      if (!resultsRows.length) {
        setDailyRows([]);
        setCategoryRows([]);
        setSummary(null);
        setLoading(false);
        return;
      }

      const picksRows = await sbFetch(
        "picks",
        `?run_date=gte.${fromDate}&run_date=lte.${toDate}&select=*`
      );

      const pickMap = new Map();
      for (const p of picksRows) {
        if (!p.fixture_id || !p.pick) continue;
        const key =
          String(p.fixture_id) +
          "__" +
          String(p.category || "").trim() +
          "__" +
          String(p.pick).trim();
        pickMap.set(key, p);
      }

      const byDay = new Map();
      const byCategory = new Map();
      let totalWins = 0;
      let totalLoses = 0;
      let totalStake = 0;
      let totalProfit = 0;
      let totalOddsSum = 0;
      let totalOddsCount = 0;

      for (const r of resultsRows) {
        const date = r.picks_date || r.match_date;
        if (!date) continue;

        const result = (r.result || "").toUpperCase();
        if (result !== "WIN" && result !== "LOSE") continue;

        const key =
          String(r.fixture_id) +
          "__" +
          String(r.category || "").trim() +
          "__" +
          String(r.pick || "").trim();
        const pick = pickMap.get(key);
        const odd = pick ? safeOdd(pick.odd) : 1.0;

        let wins = 0;
        let loses = 0;
        let stake = 0;
        let profit = 0;

        if (result === "WIN") {
          wins = 1;
          stake = 1;
          profit = odd - 1;
        } else if (result === "LOSE") {
          loses = 1;
          stake = 1;
          profit = -1;
        }

        if (!byDay.has(date)) {
          byDay.set(date, { wins: 0, loses: 0, stake: 0, profit: 0 });
        }
        const agg = byDay.get(date);
        agg.wins += wins;
        agg.loses += loses;
        agg.stake += stake;
        agg.profit += profit;

        const catKey = (r.category || "ALTRO").trim() || "ALTRO";
        if (!byCategory.has(catKey)) {
          byCategory.set(catKey, {
            wins: 0,
            loses: 0,
            stake: 0,
            profit: 0,
            oddsSum: 0,
            oddsCount: 0,
          });
        }
        const cAgg = byCategory.get(catKey);
        cAgg.wins += wins;
        cAgg.loses += loses;
        cAgg.stake += stake;
        cAgg.profit += profit;
        if (odd && !isNaN(odd)) {
          cAgg.oddsSum += odd;
          cAgg.oddsCount += 1;
        }

        totalWins += wins;
        totalLoses += loses;
        totalStake += stake;
        totalProfit += profit;
        if (odd && !isNaN(odd)) {
          totalOddsSum += odd;
          totalOddsCount += 1;
        }
      }

      const sortedDays = Array.from(byDay.keys()).sort().reverse();

      if (!sortedDays.length) {
        setDailyRows([]);
        setCategoryRows([]);
        setSummary(null);
        setLoading(false);
        return;
      }

      const firstDay = sortedDays[sortedDays.length - 1];
      const lastDay = sortedDays[0];

      const totalPlayed = totalWins + totalLoses;
      const winrateTotal =
        totalPlayed > 0 ? (totalWins / totalPlayed) * 100 : null;
      const roiTotal =
        totalStake > 0 ? (totalProfit / totalStake) * 100 : null;

      const avgOddGlobal =
        totalOddsCount > 0 ? totalOddsSum / totalOddsCount : null;
      const winrateNeededGlobal =
        avgOddGlobal && avgOddGlobal > 1 ? 100 / avgOddGlobal : null;

      const summaryObj = {
        periodText: `${formatDateIT(firstDay)} → ${formatDateIT(lastDay)}`,
        daysText: `${sortedDays.length} giorni con picks`,
        winrateText:
          winrateTotal == null ? "-" : `${winrateTotal.toFixed(1)}%`,
        wlText: `${totalWins} win / ${totalLoses} lose`,
        roiText: roiTotal == null ? "-" : `${roiTotal.toFixed(1)}%`,
        roiPositive: roiTotal != null && roiTotal >= 0,
        profitText: `Profitto: ${totalProfit
          .toFixed(2)
          .replace(".", ",")} unità (stake = ${totalStake})`,
        profitPositive:
          totalProfit > 0 ? "pos" : totalProfit < 0 ? "neg" : "neu",
        winrateNeededText:
          winrateNeededGlobal == null
            ? "Winrate necessaria: -"
            : `Winrate necessaria per break-even: ${winrateNeededGlobal
                .toFixed(1)
                .toString()}% (quota media ~ ${avgOddGlobal
                .toFixed(2)
                .toString()})`,
        reliabilityText:
          winrateTotal == null || winrateNeededGlobal == null
            ? "-"
            : reliabilityLabel(
                totalPlayed,
                winrateTotal,
                winrateNeededGlobal
              ),
        reliabilityClass: (() => {
          if (winrateTotal == null || winrateNeededGlobal == null)
            return "neutral";
          const label = reliabilityLabel(
            totalPlayed,
            winrateTotal,
            winrateNeededGlobal
          );
          if (label.startsWith("Molto") || label.startsWith("Buona"))
            return "pos";
          if (label.startsWith("Debole") || label.startsWith("Negativa"))
            return "neg";
          return "neutral";
        })(),
      };

      const daily = sortedDays.map((day) => {
        const { wins, loses, stake, profit } = byDay.get(day);
        const played = wins + loses;
        const winrate = played > 0 ? (wins / played) * 100 : null;
        const roi = stake > 0 ? (profit / stake) * 100 : null;

        return {
          dayKey: day,
          dayLabel: formatDateIT(day),
          played,
          wins,
          loses,
          winrateText: winrate == null ? "-" : `${winrate.toFixed(1)}%`,
          roiText: roi == null ? "-" : `${roi.toFixed(1)}%`,
          roiPositive: roi != null && roi >= 0,
          profitText: profit.toFixed(2),
          profitPositive:
            profit > 0 ? "pos" : profit < 0 ? "neg" : "neu",
        };
      });

      const byCategoryArr = Array.from(byCategory.keys())
        .sort()
        .map((catKey) => {
          const c = byCategory.get(catKey);
          const playedCat = c.wins + c.loses;
          const winrateCat =
            playedCat > 0 ? (c.wins / playedCat) * 100 : null;
          const roiCat =
            c.stake > 0 ? (c.profit / c.stake) * 100 : null;
          const avgOdd =
            c.oddsCount > 0 ? c.oddsSum / c.oddsCount : null;
          const winNeedCat =
            avgOdd && avgOdd > 1 ? 100 / avgOdd : null;

          const label = getCategoryLabel(catKey);

          const rel = (() => {
            if (winrateCat == null || winNeedCat == null)
              return { label: "-", cls: "neutral" };
            const wrNum = winrateCat;
            const needNum = winNeedCat;
            const lab = reliabilityLabel(playedCat, wrNum, needNum);
            let cls = "neutral";
            if (lab.startsWith("Molto") || lab.startsWith("Buona"))
              cls = "pos";
            else if (lab.startsWith("Debole") || lab.startsWith("Negativa"))
              cls = "neg";
            return { label: lab, cls };
          })();

          return {
            catKey,
            label,
            played: playedCat,
            wins: c.wins,
            loses: c.loses,
            winrateText:
              winrateCat == null ? "-" : `${winrateCat.toFixed(1)}%`,
            roiText: roiCat == null ? "-" : `${roiCat.toFixed(1)}%`,
            roiPositive: roiCat != null && roiCat >= 0,
            avgOddText: avgOdd == null ? "-" : avgOdd.toFixed(2),
            winNeedText:
              winNeedCat == null ? "-" : `${winNeedCat.toFixed(1)}%`,
            reliabilityText: rel.label,
            reliabilityClass: rel.cls,
          };
        });

      setSummary(summaryObj);
      setDailyRows(daily);
      setCategoryRows(byCategoryArr);
    } catch (e) {
      setError(e.message || "Errore nel caricamento dello storico");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(rangeDays);
  }, [rangeDays, loadHistory]);

  const RangeButton = ({ value, label }) => (
    <TouchableOpacity
      onPress={() => setRangeDays(value)}
      style={[
        styles.rangeBtn,
        rangeDays === value && styles.rangeBtnActive,
      ]}
      activeOpacity={0.8}
    >
      <Text
        style={[
          styles.rangeBtnText,
          rangeDays === value && styles.rangeBtnTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>Storico ROI</Text>
      <Text style={styles.subtitle}>
        Rendimento storico delle picks con stake fisso 1 unità per
        pronostico. Il ROI e il profitto sono calcolati solo sulle picks con
        esito WIN/LOSE.
      </Text>

      <View style={styles.rangeRow}>
        <Text style={styles.rangeLabel}>Intervallo analizzato</Text>
        <View style={styles.rangeBtnRow}>
          <RangeButton value={7} label="7 giorni" />
          <RangeButton value={14} label="14 giorni" />
          <RangeButton value={30} label="30 giorni" />
        </View>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator />
          <Text style={styles.muted}>
            Carico lo storico ROI degli ultimi {rangeDays} giorni...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.muted}>{error}</Text>
        </View>
      ) : !summary ? (
        <View style={styles.centerBox}>
          <Text style={styles.muted}>
            Nessun dato disponibile per questo periodo.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>ROI totale</Text>
              <Text
                style={[
                  styles.summaryValue,
                  summary.roiText === "-"
                    ? styles.badgeNeutral
                    : summary.roiPositive
                    ? styles.badgePos
                    : styles.badgeNeg,
                ]}
              >
                {summary.roiText}
              </Text>
              <Text
                style={[
                  styles.summaryValueSmall,
                  summary.profitPositive === "pos"
                    ? styles.badgePos
                    : summary.profitPositive === "neg"
                    ? styles.badgeNeg
                    : styles.badgeNeutral,
                ]}
              >
                {summary.profitText}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Periodo coperto</Text>
              <Text style={styles.summaryValueSmall}>
                {summary.periodText}
              </Text>
              <Text style={[styles.summaryValueSmall, styles.muted]}>
                {summary.daysText}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Winrate & affidabilità</Text>
              <Text style={[styles.summaryValue, styles.badgeNeutral]}>
                {summary.winrateText}
              </Text>
              <Text style={[styles.summaryValueSmall, styles.muted]}>
                {summary.wlText}
              </Text>
              <Text style={[styles.summaryValueSmall, styles.muted]}>
                {summary.winrateNeededText}
              </Text>
              <Text
                style={[
                  styles.summaryValueSmall,
                  summary.reliabilityClass === "pos"
                    ? styles.badgePos
                    : summary.reliabilityClass === "neg"
                    ? styles.badgeNeg
                    : styles.badgeNeutral,
                ]}
              >
                Reliability: {summary.reliabilityText}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>
            Andamento giornaliero (solo picks risolte)
          </Text>
          {dailyRows.map((row) => (
            <View key={row.dayKey} style={styles.tableCard}>
              <Text style={styles.tableRowTitle}>{row.dayLabel}</Text>
              <Text style={styles.tableRowText}>
                Picks giocati: {row.played}
              </Text>
              <Text style={styles.tableRowText}>
                Win: {row.wins} · Lose: {row.loses}
              </Text>
              <Text style={styles.tableRowText}>
                Winrate: {row.winrateText}
              </Text>
              <Text
                style={[
                  styles.tableRowText,
                  row.roiText === "-"
                    ? styles.badgeNeutral
                    : row.roiPositive
                    ? styles.badgePos
                    : styles.badgeNeg,
                ]}
              >
                ROI: {row.roiText}
              </Text>
              <Text
                style={[
                  styles.tableRowText,
                  row.profitPositive === "pos"
                    ? styles.badgePos
                    : row.profitPositive === "neg"
                    ? styles.badgeNeg
                    : styles.badgeNeutral,
                ]}
              >
                Profitto: {row.profitText}
              </Text>
            </View>
          ))}

          {categoryRows.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                Rendimento per categoria (solo picks WIN/LOSE)
              </Text>
              {categoryRows.map((row) => (
                <View key={row.catKey} style={styles.tableCard}>
                  <Text style={styles.tableRowTitle}>{row.label}</Text>
                  <Text style={styles.tableRowText}>
                    Picks giocati: {row.played}
                  </Text>
                  <Text style={styles.tableRowText}>
                    Win: {row.wins} · Lose: {row.loses}
                  </Text>
                  <Text style={styles.tableRowText}>
                    Winrate: {row.winrateText}
                  </Text>
                  <Text
                    style={[
                      styles.tableRowText,
                      row.roiText === "-"
                        ? styles.badgeNeutral
                        : row.roiPositive
                        ? styles.badgePos
                        : styles.badgeNeg,
                    ]}
                  >
                    ROI: {row.roiText}
                  </Text>
                  <Text style={styles.tableRowText}>
                    Quota media: {row.avgOddText}
                  </Text>
                  <Text style={styles.tableRowText}>
                    Winrate necessaria: {row.winNeedText}
                  </Text>
                  <Text
                    style={[
                      styles.tableRowText,
                      row.reliabilityClass === "pos"
                        ? styles.badgePos
                        : row.reliabilityClass === "neg"
                        ? styles.badgeNeg
                        : styles.badgeNeutral,
                    ]}
                  >
                    Reliability: {row.reliabilityText}
                  </Text>
                </View>
              ))}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
};

// =======================
// SCREEN: Guida / Info (NO accordion)
// =======================
const InfoScreen = () => (
  <ScrollView
    style={{ flex: 1 }}
    contentContainerStyle={styles.screenContent}
    showsVerticalScrollIndicator={false}
  >
    <Text style={styles.screenTitle}>Guida all’uso dei pronostici</Text>
    <Text style={styles.subtitle}>
      Piccola guida pratica su come leggere le categorie, la confidenza del
      modello e come usarle nel bankroll.
    </Text>

    <View style={styles.infoCard}>
      <Text style={styles.infoBlockTitle}>Come leggere le selezioni di oggi</Text>
      <Text style={styles.infoText}>
        Ogni blocco raccoglie una famiglia di pronostici con un ruolo diverso
        nel bankroll:
      </Text>
      <View style={styles.infoList}>
        <Text style={styles.infoBullet}>
          • <Text style={styles.bold}>Scelte d’Élite</Text>
          {
            ": selezioni in cui il modello vede un equilibrio solido fra quota e probabilità."
          }
        </Text>
        <Text style={styles.infoBullet}>
          • <Text style={styles.bold}>Selezioni Affidabili</Text>
          {
            ": pronostici più prudenti, pensati per dare stabilità al rendimento."
          }
        </Text>
        <Text style={styles.infoBullet}>
          • <Text style={styles.bold}>Quote di Valore</Text>
          {
            ": partite in cui la quota sembra pagare troppo rispetto al rischio stimato."
          }
        </Text>
        <Text style={styles.infoBullet}>
          • <Text style={styles.bold}>Tendenze Goal</Text> e{" "}
          <Text style={styles.bold}>Probabilità Entrambe</Text>
          {
            ": mercati legati ai gol, utili per diversificare il tipo di giocata."
          }
        </Text>
        <Text style={styles.infoBullet}>
          • <Text style={styles.bold}>Combo Selettiva</Text> e{" "}
          <Text style={styles.bold}>Combo High Stakes</Text>
          {
            ": multiple con rischio crescente, da usare solo come extra."
          }
        </Text>
      </View>

      <Text style={[styles.infoBlockTitle, { marginTop: 8 }]}>
        Come usare la “confidenza”
      </Text>
      <Text style={styles.infoText}>
        La confidenza non significa che il pick è “sicuro”, ma indica quanto il
        modello vede i numeri dalla nostra parte rispetto alla quota proposta
        dal bookmaker.
      </Text>
      <View style={styles.infoList}>
        <Text style={styles.infoBullet}>
          • <Text style={styles.bold}>Confidenza molto alta / alta</Text>
          {
            ": buone per le singole, dove vuoi costruire rendimento nel tempo."
          }
        </Text>
        <Text style={styles.infoBullet}>
          • <Text style={styles.bold}>Confidenza media</Text>
          {
            ": adatte per completare una schedina da 2–3 eventi o per variare un po’ le giocate."
          }
        </Text>
        <Text style={styles.infoBullet}>
          • <Text style={styles.bold}>Confidenza bassa</Text>
          {
            ": giocate dove il modello vede potenziale, ma il rischio è alto. Da usare solo con importi piccoli."
          }
        </Text>
        <Text style={styles.infoBullet}>
          •{" "}
          <Text style={styles.bold}>
            Confidenza molto bassa / rischiosa
          </Text>
          {
            ": idee ad alto rischio. Se le usi, trattale come extra e non come base del bankroll."
          }
        </Text>
      </View>

      <Text style={[styles.infoBlockTitle, { marginTop: 8 }]}>
        Esempi di utilizzo pratico
      </Text>
      <View style={styles.infoList}>
        <Text style={styles.infoBullet}>
          • <Text style={styles.bold}>Approccio prudente</Text>
          {
            ": stake fisso (es. 1 unità) su 3–5 Selezioni Affidabili o Scelte d’Élite con confidenza medio–alta. Evita le confidenze basse e le combo più pesanti."
          }
        </Text>
        <Text style={styles.infoBullet}>
          • <Text style={styles.bold}>Approccio bilanciato</Text>
          {
            ": singole su 2–3 Scelte d’Élite con confidenza alta + una Combo Selettiva con stake ridotto rispetto alle singole."
          }
        </Text>
        <Text style={styles.infoBullet}>
          •{" "}
          <Text style={styles.bold}>Approccio speculativo controllato</Text>
          {
            ": stessa base prudente (singole con confidenza alta) e, in più, una sola giocata con confidenza bassa (o una Combo High Stakes) con stake molto più piccolo rispetto alle giocate principali."
          }
        </Text>
      </View>

      <Text style={[styles.infoText, { marginTop: 8 }]}>
        Lo storico del sito e dell’app è calcolato con stake fisso di 1 unità
        per pick: se mantieni una logica simile è più semplice confrontare i
        tuoi risultati con quelli mostrati nello storico ROI.
      </Text>
    </View>
  </ScrollView>
);

// =======================
// MAIN APP + SafeAreaProvider
// =======================
function MainApp() {
  const [tab, setTab] = useState("today");

  let Screen;
  if (tab === "today") Screen = TodayPicksScreen;
  else if (tab === "history") Screen = PicksHistoryScreen;
  else if (tab === "roi") Screen = RoiHistoryScreen;
  else Screen = InfoScreen;

  return (
    <SafeAreaView
      style={styles.screen}
      edges={["top", "right", "bottom", "left"]}
    >
      <View style={styles.appContainer}>
        <View style={styles.contentArea}>
          <Screen />
        </View>

        <View style={styles.bottomBar}>
          <TabButton
            label="Picks di oggi"
            active={tab === "today"}
            onPress={() => setTab("today")}
          />
          <TabButton
            label="Storico picks"
            active={tab === "history"}
            onPress={() => setTab("history")}
          />
          <TabButton
            label="Storico ROI"
            active={tab === "roi"}
            onPress={() => setTab("roi")}
          />
          <TabButton
            label="Guida"
            active={tab === "info"}
            onPress={() => setTab("info")}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

// =======================
// STILI
// =======================

const MAX_WIDTH = 480;

/* eslint-disable react-native/no-unused-styles */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#050816",
  },
  appContainer: {
    flex: 1,
  },
  contentArea: {
    flex: 1,
  },

  screenContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    width: "100%",
    maxWidth: MAX_WIDTH,
    alignSelf: "center",
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#e5e7eb",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#9ca3af",
    marginBottom: 12,
  },
  muted: {
    fontSize: 12,
    color: "#9ca3af",
  },
  bold: {
    fontWeight: "600",
  },

  // HEADER APP
  appHeaderRow: {
  flexDirection: "row",
  alignItems: "center",
},

 appHeaderLeft: {
  flexDirection: "row",
  alignItems: "center",
  flexShrink: 1,
},
  appIcon: {
    width: 52,
    height: 52,
    marginRight: 10,
  },
  appTitleBlock: {
  flexShrink: 1,
},

appTitleBadge: {
  alignSelf: "flex-start",
  paddingHorizontal: 12,
  paddingVertical: 4,
  borderRadius: 999,
  backgroundColor: "#020617",
  borderWidth: 1,
  borderColor: "rgba(249,115,22,0.9)",
  marginBottom: 4,
  shadowColor: "#000",
  shadowOpacity: 0.45,
  shadowOffset: { width: 0, height: 2 },
  shadowRadius: 4,
  elevation: 4, // per Android
},

appTitle: {
  fontSize: 20,
  fontWeight: "900",
  letterSpacing: 2.2,
  textTransform: "uppercase",
  color: "#f9fafb",
},

  appSubtitle: {
  fontSize: 12,
  color: "#9ca3af",
  marginTop: 4,
  lineHeight: 16,
},
  dayBadgeText: {
  marginTop: 6,
  alignSelf: "flex-start",
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 999,
  backgroundColor: "rgba(249, 115, 22, 0.18)",
  borderWidth: 1,
  borderColor: "rgba(249, 115, 22, 0.55)",
  color: "#fed7aa",
  fontSize: 14,           // AUMENTATO
  fontWeight: "700",
  textTransform: "uppercase",
  letterSpacing: 1.3,     // PIÙ SPAZIO FRA LETTERE
},



  snackButtonWrapper: {
    marginTop: 16,
    marginBottom: 8,
    alignItems: "center",
    width: "100%",
  },
  snackButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.8)",
    backgroundColor: "rgba(15, 23, 42, 0.95)",
  },
  snackCookie: {
    fontSize: 14,
    marginRight: 6,
  },
  snackText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#fed7aa",
  },

  centerBox: {
    marginTop: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  categoriesContainer: {
    marginTop: 4,
  },
  pickCard: {
    backgroundColor: "#020617",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    padding: 10,
    marginBottom: 8,
  },
  win: {
    borderColor: "#16a34a",
  },
  lose: {
    borderColor: "#dc2626",
  },
  pending: {
    borderColor: "#facc15",
  },
  unknown: {
    borderColor: "#6b7280",
  },
  pickHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  leaguePill: {
    maxWidth: "70%",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    backgroundColor: "rgba(148,163,184,0.15)",
    fontSize: 11,
    color: "#e5e7eb",
  },
  matchTime: {
    fontSize: 12,
    fontWeight: "500",
    color: "#e5e7eb",
  },
  teams: {
    fontSize: 14,
    fontWeight: "500",
    color: "#e5e7eb",
    marginBottom: 4,
  },
  pickMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  pickLabel: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(248,250,252,0.22)",
    backgroundColor: "rgba(15,23,42,0.9)",
    fontSize: 12,
    color: "#e5e7eb",
    fontWeight: "500",
  },
  oddLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: "#e5e7eb",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scoreText: {
    fontSize: 11,
    color: "#9ca3af",
  },
  scoreStrong: {
    fontWeight: "600",
    color: "#e5e7eb",
  },
  resultBadge: {
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  resultBadgeSmall: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  badge_pos: {
    borderColor: "#16a34a",
    color: "#bbf7d0",
  },
  badge_neg: {
    borderColor: "#dc2626",
    color: "#fecaca",
  },
  badge_pending: {
    borderColor: "#facc15",
    color: "#fef9c3",
  },
  badge_unknown: {
    borderColor: "#6b7280",
    color: "#e5e7eb",
  },
  badgeNeutral: {
    color: "#e5e7eb",
  },
  badgePos: {
    color: "#bbf7d0",
  },
  badgeNeg: {
    color: "#fecaca",
  },

  accordionContainer: {
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(30,64,175,0.4)",
    backgroundColor: "rgba(15,23,42,0.95)",
  },
  accordionHeader: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(30,64,175,0.5)",
  },
  accordionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e5e7eb",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  accordionSubtitle: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 2,
  },
  accordionChevron: {
    fontSize: 14,
    color: "#9ca3af",
  },
  accordionBody: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  historyRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(31,41,55,0.7)",
  },
  historyRowTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#e5e7eb",
    marginBottom: 2,
  },
  historyRowText: {
    fontSize: 11,
    color: "#9ca3af",
  },

  // Date selector per storico picks
  dateSelectorScroll: {
    marginBottom: 8,
  },
  dateSelectorRow: {
    paddingVertical: 4,
  },
  dateChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    marginRight: 8,
    backgroundColor: "rgba(15,23,42,0.95)",
  },
  dateChipActive: {
    borderColor: "#f97316",
    backgroundColor: "rgba(249,115,22,0.16)",
  },
  dateChipText: {
    fontSize: 12,
    color: "#e5e7eb",
  },
  dateChipTextActive: {
    color: "#fed7aa",
    fontWeight: "600",
  },

  dailySummaryCard: {
    marginTop: 4,
    marginBottom: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(15,23,42,0.97)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.35)",
  },
  dailySummaryTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#e5e7eb",
    marginBottom: 4,
  },
  dailySummaryText: {
    fontSize: 11,
    color: "#9ca3af",
  },

  rangeRow: {
    marginTop: 8,
    marginBottom: 10,
  },
  rangeLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#9ca3af",
    marginBottom: 4,
  },
  rangeBtnRow: {
    flexDirection: "row",
  },
  rangeBtn: {
    marginRight: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
  },
  rangeBtnActive: {
    borderColor: "#f97316",
    backgroundColor: "rgba(249,115,22,0.12)",
  },
  rangeBtnText: {
    fontSize: 12,
    color: "#e5e7eb",
  },
  rangeBtnTextActive: {
    color: "#fed7aa",
  },

  summaryCard: {
    marginTop: 4,
    marginBottom: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(15,23,42,0.97)",
    borderWidth: 1,
    borderColor: "rgba(30,64,175,0.55)",
  },
  summaryItem: {
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 11,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  summaryValueSmall: {
    fontSize: 12,
    fontWeight: "500",
    color: "#e5e7eb",
  },

  sectionTitle: {
    fontSize: 13,
    color: "#9ca3af",
    fontWeight: "500",
    marginBottom: 6,
    marginTop: 6,
  },
  tableCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(31,41,55,0.8)",
    backgroundColor: "rgba(15,23,42,0.98)",
    padding: 10,
    marginBottom: 8,
  },
  tableRowTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#e5e7eb",
    marginBottom: 4,
  },
  tableRowText: {
    fontSize: 11,
    color: "#9ca3af",
  },

  infoCard: {
    marginTop: 8,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    backgroundColor: "rgba(15,23,42,0.95)",
  },
  infoBlockTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#e5e7eb",
  },
  infoText: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
  },
  infoList: {
    marginTop: 4,
  },
  infoBullet: {
    fontSize: 12,
    color: "#9ca3af",
    marginBottom: 2,
  },

  bottomBar: {
    height: 60,
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(31,41,55,0.9)",
    backgroundColor: "#020617",
    paddingHorizontal: 6,
    paddingVertical: 8,
    width: "100%",
    maxWidth: MAX_WIDTH,
    alignSelf: "center",
  },
  tabButton: {
    flex: 1,
    paddingHorizontal: 4,
    paddingVertical: 6,
    marginHorizontal: 2,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  tabButtonActive: {
    backgroundColor: "rgba(249,115,22,0.12)",
  },
  tabButtonText: {
    fontSize: 11,
    color: "#9ca3af",
  },
  tabButtonTextActive: {
    color: "#fed7aa",
    fontWeight: "600",
  },
  headerCentered: {
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 12,
},
appHeaderCard: {
  width: "100%",
  maxWidth: MAX_WIDTH,
  alignSelf: "center",
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderRadius: 18,
  backgroundColor: "#020617",
  borderWidth: 1,
  borderColor: "rgba(30,64,175,0.55)",
  marginBottom: 10,
  shadowColor: "#000",
  shadowOpacity: 0.35,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 3 },
  elevation: 4,
},

appHeaderText: {
  flex: 1,
  flexShrink: 1,
},

headerDateRow: {
  marginTop: 8,
  alignItems: "center",
},

logoCentered: {
  width: 48,
  height: 48,
  resizeMode: "contain",
  marginBottom: 6,
},

appTitleCentered: {
  color: "#ffffff",
  fontSize: 22,
  letterSpacing: 1.5,
  fontWeight: "900",
  textAlign: "center",
  marginBottom: 4,
},

appSubtitleCentered: {
  color: "#9ca3af",
  fontSize: 13,
  textAlign: "center",
  marginBottom: 10,
  paddingHorizontal: 20,
},
fullDateBadge: {
  width: "100%",
  paddingVertical: 10,
  borderRadius: 12,
  backgroundColor: "rgba(249, 115, 22, 0.18)",
  borderWidth: 1,
  borderColor: "rgba(249, 115, 22, 0.4)",
  alignItems: "center",
  justifyContent: "center",
  marginTop: 6,
},

fullDateText: {
  fontSize: 13,
  color: "#fed7aa",
  fontWeight: "700",
  textTransform: "uppercase",
  letterSpacing: 1,
},


});
/* eslint-enable react-native/no-unused-styles */
