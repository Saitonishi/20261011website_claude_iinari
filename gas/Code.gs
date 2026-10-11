/**
 * 吉田村風土記 ― バックエンド（Google Apps Script）
 *
 * やっていること
 *  1. 公開サイトに「解説と写真の一覧」を JSON で渡す      （doGet）
 *  2. 登録フォームの画面を表示する                         （doGet ?page=form）
 *  3. フォームから届いた解説をスプレッドシートに保存する   （saveChapters）
 *  4. フォームから届いた写真を Google ドライブに保存する   （uploadPhoto）
 *
 * ポイントの「位置」は持ちません。位置は QGIS で作った points.geojson が正です。
 */

// ===== 設定（ここだけ書き換えてください） =====
const CONFIG = {
  // 登録フォームで入力する合言葉。必ず自分だけの文字列に変更してください。
  EDIT_PASSWORD: "CHANGE_ME",

  // 公開サイトに置いた points.geojson のURL（フォームのポイント一覧に使います）
  GEOJSON_URL: "https://saitonishi.github.io/yoshida-fudoki/points.geojson",

  // 写真を保存する Google ドライブのフォルダ名（なければ自動で作ります）
  PHOTO_FOLDER_NAME: "吉田村風土記_写真",

  // 写真1枚あたりの上限（バイト）。フォーム側で縮小するので通常は十分です。
  MAX_PHOTO_BYTES: 4 * 1024 * 1024,
};

// ===== 以下は基本的に触らなくてOK =====
const CHAPTER_KEYS = ["ch1", "ch2", "ch3", "ch4", "ch5", "ch6"];
const SHEET_POINTS = "points";
const SHEET_PHOTOS = "photos";
const POINT_HEADERS = ["id", "name"].concat(CHAPTER_KEYS).concat(["updated"]);
const PHOTO_HEADERS = ["point_id", "chapter", "file_id", "caption", "order", "uploaded"];
const MAX_TEXT_LENGTH = 5000;
const MAX_CAPTION_LENGTH = 200;

/** 最初に1回だけ手動で実行します（シートとフォルダを用意します）。 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEET_POINTS, POINT_HEADERS);
  ensureSheet_(ss, SHEET_PHOTOS, PHOTO_HEADERS);
  getPhotoFolder_();
  SpreadsheetApp.flush();
  Logger.log("セットアップが完了しました。");
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, headers.length).setNumberFormat("@").setValues([headers]).setFontWeight("bold");
  sh.setFrozenRows(1);
}

// ===== 画面・JSON の入口 =====
function doGet(e) {
  const page = e && e.parameter && e.parameter.page;
  if (page === "form") {
    return HtmlService.createHtmlOutputFromFile("Form")
      .setTitle("吉田村風土記 登録フォーム")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }
  return json_(getContent_());
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== 公開サイトに渡すデータ =====
function getContent_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const points = {};
  readRows_(ss, SHEET_POINTS, POINT_HEADERS).forEach(function (r) {
    if (!r.id) return;
    const entry = {};
    CHAPTER_KEYS.forEach(function (k) {
      const t = String(r[k] || "");
      if (t.trim()) entry[k] = t;
    });
    points[String(r.id)] = entry;
  });
  const photos = readRows_(ss, SHEET_PHOTOS, PHOTO_HEADERS)
    .filter(function (r) { return r.point_id && r.file_id; })
    .map(function (r) {
      return {
        point_id: String(r.point_id),
        chapter: String(r.chapter),
        file_id: String(r.file_id),
        caption: String(r.caption || ""),
        order: Number(r.order) || 0,
      };
    });
  return { points: points, photos: photos };
}

function readRows_(ss, name, headers) {
  const sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues();
  return values.map(function (row) {
    const o = {};
    headers.forEach(function (h, i) { o[h] = row[i]; });
    return o;
  });
}

function writeRow_(sh, rowNumber, values) {
  // 先頭が「=」の文字列が数式として動かないよう、書き込み先を「書式なしテキスト」にする
  sh.getRange(rowNumber, 1, 1, values.length).setNumberFormat("@").setValues([values]);
}

// ===== ポイント一覧（points.geojson から取得） =====
function fetchPointList_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("pointList");
  if (cached) return JSON.parse(cached);

  const res = UrlFetchApp.fetch(CONFIG.GEOJSON_URL + "?t=" + Date.now(), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error("points.geojson を取得できませんでした（HTTP " + res.getResponseCode() +
      "）。Code.gs の GEOJSON_URL を確認してください。");
  }
  const gj = JSON.parse(res.getContentText());
  const list = (gj.features || [])
    .filter(function (f) { return f.properties && f.properties.id; })
    .map(function (f) {
      return { id: String(f.properties.id), name: String(f.properties.name || f.properties.id) };
    });
  list.sort(function (a, b) { return a.id.localeCompare(b.id); });
  cache.put("pointList", JSON.stringify(list), 60);
  return list;
}

function assertPointExists_(pointId) {
  const hit = fetchPointList_().filter(function (p) { return p.id === String(pointId); })[0];
  if (!hit) throw new Error("ポイント「" + pointId + "」が points.geojson にありません。");
  return hit;
}

function checkPassword_(password) {
  if (!CONFIG.EDIT_PASSWORD || CONFIG.EDIT_PASSWORD === "CHANGE_ME") {
    throw new Error("Code.gs の EDIT_PASSWORD（合言葉）を設定してください。");
  }
  if (String(password) !== CONFIG.EDIT_PASSWORD) {
    Utilities.sleep(1000);
    throw new Error("合言葉が違います。");
  }
}

// ===== フォームから呼ばれる関数 =====

/** フォームのポイント選択欄に出す一覧。 */
function getPointList() {
  return fetchPointList_();
}

/** 選んだポイントの登録済み内容を返す（フォームに入れて編集できるように）。 */
function getPointForEdit(password, pointId) {
  checkPassword_(password);
  assertPointExists_(pointId);
  const content = getContent_();
  const photoCounts = {};
  content.photos.forEach(function (p) {
    if (p.point_id === String(pointId)) photoCounts[p.chapter] = (photoCounts[p.chapter] || 0) + 1;
  });
  return { chapters: content.points[String(pointId)] || {}, photoCounts: photoCounts };
}

/** 6つの章の解説を保存（そのポイントの行を上書き）。 */
function saveChapters(password, pointId, chapters) {
  checkPassword_(password);
  const point = assertPointExists_(pointId);

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_POINTS);
    if (!sh) throw new Error("先に Apps Script で setup を1回実行してください。");

    const row = [point.id, point.name];
    CHAPTER_KEYS.forEach(function (k) {
      row.push(String((chapters && chapters[k]) || "").trim().slice(0, MAX_TEXT_LENGTH));
    });
    row.push(new Date().toISOString());

    const lastRow = sh.getLastRow();
    let target = lastRow + 1;
    if (lastRow >= 2) {
      const ids = sh.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === point.id) { target = i + 2; break; }
      }
    }
    writeRow_(sh, target, row);
    return "ok";
  } finally {
    lock.releaseLock();
  }
}

/** 写真を1枚保存（ドライブに保存し、photos シートに1行追加）。 */
function uploadPhoto(password, pointId, chapter, caption, dataUrl) {
  checkPassword_(password);
  const point = assertPointExists_(pointId);
  if (CHAPTER_KEYS.indexOf(chapter) < 0) throw new Error("章の指定が正しくありません。");

  const m = /^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+\/=]+)$/.exec(String(dataUrl));
  if (!m) throw new Error("画像の形式が正しくありません（JPEG / PNG / WebP のみ）。");
  const bytes = Utilities.base64Decode(m[3]);
  if (bytes.length > CONFIG.MAX_PHOTO_BYTES) throw new Error("写真が大きすぎます。");

  const ext = m[2] === "jpeg" ? "jpg" : m[2];
  const blob = Utilities.newBlob(bytes, m[1], point.id + "_" + chapter + "_" + Date.now() + "." + ext);

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PHOTOS);
    if (!sh) throw new Error("先に Apps Script で setup を1回実行してください。");

    const file = getPhotoFolder_().createFile(blob);
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (err) {
      file.setTrashed(true);
      throw new Error("写真の共有設定に失敗しました（組織の設定で外部共有が禁止されている可能性があります）。");
    }

    let order = 1;
    const lastRow = sh.getLastRow();
    if (lastRow >= 2) {
      sh.getRange(2, 1, lastRow - 1, 2).getValues().forEach(function (r) {
        if (String(r[0]) === point.id && String(r[1]) === chapter) order++;
      });
    }
    writeRow_(sh, lastRow + 1, [
      point.id, chapter, file.getId(),
      String(caption || "").trim().slice(0, MAX_CAPTION_LENGTH),
      order, new Date().toISOString(),
    ]);
    return "ok";
  } finally {
    lock.releaseLock();
  }
}

function getPhotoFolder_() {
  const it = DriveApp.getFoldersByName(CONFIG.PHOTO_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.PHOTO_FOLDER_NAME);
}
