// ===== サイトの設定ファイル =====
// 初心者の方が編集するのは、基本的にこのファイルだけです。

const SITE_CONFIG = {
  // 登録フォーム用の Google Apps Script「ウェブアプリ」のURL（…/exec で終わるもの）
  // 空のままだと、同じフォルダの sample-content.json（サンプル）を表示します。
  GAS_URL: "https://script.google.com/macros/s/AKfycbwcsGLptrL9wJtEhSdPYLJP-mkB3v6NJlTLhYGTNLo-LYTcSMNG0ztKwSBJx-BnhepU4Q/exec",

  // QGIS から書き出したポイントのファイル
  GEOJSON_URL: "https://raw.githubusercontent.com/Saitonishi/20261011website_claude_iinari/main/points.geojson",

  // 地図の初期位置（[緯度, 経度]）と拡大率。
  // ポイントが1つ以上あれば、全ポイントが入る位置に自動で合わせます。
  MAP_CENTER: [35.0251, 135.7866],
  MAP_ZOOM: 15,

  // 追加で重ねたい QGIS のレイヤー（範囲・路線など）。使わなければ空のままでOK。
  // 例: { name: "旧村境", url: "layers/boundary.geojson", color: "#1d4e89" }
  EXTRA_LAYERS: [],
};
