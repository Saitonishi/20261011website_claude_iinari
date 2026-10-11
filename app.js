"use strict";

// ===== 章の見出し =====
// ※ gas/Form.html の CHAPTERS と同じ内容にしておくこと。
const CHAPTERS = [
  { key: "ch1", title: "第1章：吉田の地形と自然(空間)" },
  { key: "ch2", title: "第2章：吉田の歴史と信仰(時間)" },
  { key: "ch3", title: "第3章：歴史的な建物と建造物(風景)" },
  { key: "ch4", title: "第4章：学校と学術文化(教育・文化)" },
  { key: "ch5", title: "第5章：暮らしの移り変わり(生活)" },
];

// ===== 表示用の部品（画面がなくても動く関数。テストしやすいよう分けてある） =====

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 本文を安全なHTMLにする（改行は <br> に）
function textToHtml(s) {
  return escapeHtml(s).replace(/\r?\n/g, "<br>");
}

// 写真のURLを作る。
// ・file_id があれば Google ドライブのサムネイルURL
// ・url があれば（サンプル用）、images/ か https:// で始まるものだけ許可
function photoUrl(photo, size) {
  if (photo.file_id) {
    return "https://drive.google.com/thumbnail?id=" +
      encodeURIComponent(photo.file_id) + "&sz=w" + size;
  }
  if (photo.url && /^(images\/|https:\/\/)/.test(photo.url)) return photo.url;
  return "";
}

function hasContent(entry, photos) {
  const hasText = CHAPTERS.some(c => entry && String(entry[c.key] || "").trim());
  return hasText || (photos && photos.length > 0);
}

// 解説パネルのHTMLを作る。解説も写真もない章は出さない。
function buildPanelHtml(name, entry, photos) {
  entry = entry || {};
  photos = photos || [];

  const sections = CHAPTERS.map(c => {
    const text = String(entry[c.key] || "").trim();
    const imgs = photos
      .filter(p => p.chapter === c.key && photoUrl(p, 600))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (!text && imgs.length === 0) return "";   // ← 空の章は非表示

    const textHtml = text ? `<p class="chapter-text">${textToHtml(text)}</p>` : "";
    const gallery = imgs.length
      ? `<div class="gallery">${imgs.map(p => {
          const cap = escapeHtml(p.caption || "");
          return `<figure><button type="button" class="thumb"
              data-full="${escapeHtml(photoUrl(p, 2000))}" data-caption="${cap}"
              aria-label="写真を拡大${cap ? "：" + cap : ""}">
              <img src="${escapeHtml(photoUrl(p, 600))}" alt="${cap}" loading="lazy">
            </button>${cap ? `<figcaption>${cap}</figcaption>` : ""}</figure>`;
        }).join("")}</div>`
      : "";

    return `<section class="chapter"><h3>${escapeHtml(c.title)}</h3>${textHtml}${gallery}</section>`;
  }).join("");

  const body = sections || `<p class="placeholder">このポイントの解説は準備中です。</p>`;
  return `<h2>${escapeHtml(name)}</h2>${body}`;
}

// ===== ここから下は画面（ブラウザ）の処理 =====

function fetchJson(url) {
  return fetch(url).then(r => {
    if (!r.ok) throw new Error(url + " を読み込めません（HTTP " + r.status + "）");
    return r.json();
  });
}

function showNotice(msg) {
  const el = document.getElementById("notice");
  el.textContent = msg;
  el.hidden = !msg;
}

function init() {
  const cfg = SITE_CONFIG;
  const panel = document.getElementById("panel");
  const listEl = document.getElementById("point-list");

  // --- 地図 ---
  const map = L.map("map", { center: cfg.MAP_CENTER, zoom: cfg.MAP_ZOOM, maxZoom: 18 });
  const gsiAttr = '<a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>';
  const base = {
    "地理院地図": L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
      { attribution: gsiAttr, maxZoom: 18 }),
    "地理院 淡色": L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png",
      { attribution: gsiAttr, maxZoom: 18 }),
    "地理院 航空写真": L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
      { attribution: gsiAttr, maxZoom: 18 }),
  };
  base["地理院地図"].addTo(map);
  const overlays = {};
  const layerControl = L.control.layers(base, overlays, { collapsed: true }).addTo(map);

  // 追加レイヤー（範囲・路線など）
  (cfg.EXTRA_LAYERS || []).forEach(ex => {
    fetchJson(ex.url).then(gj => {
      const layer = L.geoJSON(gj, {
        style: { color: ex.color || "#1d4e89", weight: 2, fillOpacity: 0.1 },
        onEachFeature: (f, l) => {
          const n = f.properties && f.properties.name;
          if (n) l.bindTooltip(escapeHtml(n));
        },
      }).addTo(map);
      layerControl.addOverlay(layer, ex.name || ex.url);
    }).catch(err => console.warn(err));
  });

  // --- データ読み込み ---
  // --- データ読み込み ---
  let contentUrl = "sample-content.json";
  if (cfg.GAS_URL) {
    const separator = cfg.GAS_URL.includes("?") ? "&" : "?";
    contentUrl = cfg.GAS_URL + separator + "action=content";
  }
  const contentPromise = fetchJson(contentUrl).catch(err => {
    console.warn(err);
    showNotice("解説データを読み込めませんでした。地図の点だけ表示します。");
    return { points: {}, photos: [] };
  });

  Promise.all([fetchJson(cfg.GEOJSON_URL), contentPromise]).then(([geojson, content]) => {
    const entries = content.points || {};
    const photosById = {};
    (content.photos || []).forEach(p => {
      (photosById[p.point_id] = photosById[p.point_id] || []).push(p);
    });

    if (!cfg.GAS_URL) {
      showNotice("いまはサンプルを表示しています。config.js に GAS_URL を設定すると、実際の登録内容が表示されます。");
    }

    const layersById = {};
    const features = geojson.features || [];

    function styleFor(id, selected) {
      const filled = hasContent(entries[id], photosById[id]);
      return {
        radius: selected ? 12 : 9,
        weight: selected ? 4 : 2,
        color: selected ? "#1d4e89" : "#7a3b12",
        fillColor: "#c0622b",
        fillOpacity: filled ? 0.9 : 0.15,
      };
    }

    let currentId = null;
    function select(id, fromUser) {
      const f = features.find(x => x.properties && String(x.properties.id) === id);
      if (!f) return;
      if (currentId && layersById[currentId]) layersById[currentId].setStyle(styleFor(currentId, false));
      currentId = id;
      layersById[id].setStyle(styleFor(id, true));
      layersById[id].bringToFront();

      panel.innerHTML = buildPanelHtml(f.properties.name || id, entries[id], photosById[id]);
      try { history.replaceState(null, "", "#id=" + encodeURIComponent(id)); } catch (e) { /* 無視 */ }
      if (fromUser) {
        map.panTo(layersById[id].getLatLng());
        //panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    const geoLayer = L.geoJSON(geojson, {
      pointToLayer: (f, latlng) => L.circleMarker(latlng, styleFor(String(f.properties.id), false)),
      onEachFeature: (f, layer) => {
        const id = String(f.properties.id);
        layersById[id] = layer;
        layer.bindTooltip(escapeHtml(f.properties.name || id));
        layer.on("click", () => select(id, true));
      },
    }).addTo(map);

    // 全ポイントが入る位置に合わせる
    if (features.length > 0) {
      map.fitBounds(geoLayer.getBounds().pad(0.3), { maxZoom: 17 });
    }

    // ポイント一覧（スマホや、点が重なって押しにくいとき用）
    features.forEach(f => {
      const id = String(f.properties.id);
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = f.properties.name || id;
      if (!hasContent(entries[id], photosById[id])) btn.className = "empty";
      btn.addEventListener("click", () => select(id, true));
      li.appendChild(btn);
      listEl.appendChild(li);
    });

    // URLの #id=Y001 で、開いた時点でそのポイントを表示
    const m = location.hash.match(/^#id=(.+)$/);
    if (m) select(decodeURIComponent(m[1]), false);
  }).catch(err => {
    console.error(err);
    showNotice("地図のポイントを読み込めませんでした（" + err.message + "）");
  });

  setupLightbox(panel);
}

// ===== 写真の拡大表示 =====
function setupLightbox(panel) {
  const box = document.getElementById("lightbox");
  const img = document.getElementById("lightbox-img");
  const cap = document.getElementById("lightbox-cap");
  const closeBtn = document.getElementById("lightbox-close");
  let opener = null;

  function close() {
    box.hidden = true;
    img.removeAttribute("src");
    if (opener) opener.focus();
  }
  panel.addEventListener("click", e => {
    const btn = e.target.closest(".thumb");
    if (!btn) return;
    opener = btn;
    img.src = btn.dataset.full;
    img.alt = btn.dataset.caption || "";
    cap.textContent = btn.dataset.caption || "";
    box.hidden = false;
    closeBtn.focus();
  });
  closeBtn.addEventListener("click", close);
  box.addEventListener("click", e => { if (e.target === box) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !box.hidden) close(); });
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", init);
}
if (typeof module !== "undefined") {
  module.exports = { CHAPTERS, escapeHtml, textToHtml, photoUrl, hasContent, buildPanelHtml };
}
