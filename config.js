// ===== サイトの設定ファイル =====
// 初心者の方が編集するのは、基本的にこのファイルだけです。

const SITE_CONFIG = {
  // 登録フォーム用の Google Apps Script「ウェブアプリ」のURL（…/exec で終わるもの）
  // 空のままだと、同じフォルダの sample-content.json（サンプル）を表示します。
  GAS_URL: "https://script.googleusercontent.com/macros/echo?user_content_key=AUkAhnRMNbQsGY-65ae3naYSFl8iXGGevy7L_8hhpMA1f2E6ODK8y9hDfh3-p07ZIw6949SKrBMpC983M0usL3yYBvxqhr0NV44Mo6VXXGMqNBg_X4V7INi5D4pWQgXOkjyo7GBnEYe0CgwvRlhRdbXl1smWviP6JibbsEfKbaz2wGqjYL9m5qHJT4B_rFW1pTBagyxgGmlsNp7NiRfy-3F5JLqhzvy7hRAiAj6nD50D2zTa38itEFTA4V3B9rAVpT7jDjM6RGknOEU67kvgGOCcLwgNq35SEQ&lib=MP0L-79dtqQ-Ib2gskoWYUKH4pJ2ujTTZ",

  // QGIS から書き出したポイントのファイル
  GEOJSON_URL: "points.geojson",

  // 地図の初期位置（[緯度, 経度]）と拡大率。
  // ポイントが1つ以上あれば、全ポイントが入る位置に自動で合わせます。
  MAP_CENTER: [35.0251, 135.7866],
  MAP_ZOOM: 15,

  // 追加で重ねたい QGIS のレイヤー（範囲・路線など）。使わなければ空のままでOK。
  // 例: { name: "旧村境", url: "layers/boundary.geojson", color: "#1d4e89" }
  EXTRA_LAYERS: [],
};
