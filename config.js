// ===== サイトの設定ファイル =====
// 初心者の方が編集するのは、基本的にこのファイルだけです。

const SITE_CONFIG = {
  // 登録フォーム用の Google Apps Script「ウェブアプリ」のURL（…/exec で終わるもの）
  // 空のままだと、同じフォルダの sample-content.json（サンプル）を表示します。
  GAS_URL: "https://script.google.com/macros/s/AKfycbwcsGLptrL9wJtEhSdPYLJP-mkB3v6NJlTLhYGTNLo-LYTcSMNG0ztKwSBJx-BnhepU4Q/exec",

  // QGIS から書き出したポイントのファイル
  GEOJSON_URL: "./points.geojson",

  // 地図の初期位置（[緯度, 経度]）と拡大率。
  // ポイントが1つ以上あれば、全ポイントが入る位置に自動で合わせます。
  MAP_CENTER: [35.0251, 135.7866],
  MAP_ZOOM: 15,

  // 追加で重ねたい QGIS のレイヤー（範囲・路線など）。使わなければ空のままでOK。
  // 例: { name: "旧村境", url: "layers/boundary.geojson", color: "#1d4e89" }
  EXTRA_LAYERS: [
    {
      name: "吉田村古図（画像重ね合わせ）",
      type: "image",                            // 画像を重ねる場合
      url: "./yoshidamurakozu.tiff",              // プロジェクトに置いた古地図画像
      bounds: [
        [35.017617829, 135.770349458],                    // 南西の座標 [緯度, 経度]
        [35.030318488, 135.791455844]                     // 北東の座標 [緯度, 経度]
      ],
      opacity: 0.6                            // 透け具合（0.0〜1.0）
    },
    
    {
      name: "旧尾張藩邸", 
      url: "./owarihantei.geojson",              // ベクターデータの GeoJSON ファイル
      color: "#b20071",                            // 線の色
      opacity: 0.6                            // 透け具合（0.0〜1.0）
    },

    {
      name: "明治期の迅速測図（タイル）",
      type: "tile",                             // タイル地図の場合
      url: "https://cyberjapandata.gsi.go.jp/xyz/rapid_fig/{z}/{x}/{y}.png",
      opacity: 0.7
    }
  ],
};
