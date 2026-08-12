/***** LINE 記帳機器人 — 分類規則模組（貼進你的 LINE bot Apps Script 用）*****
 * 為什麼要換：舊邏輯「認不出來就丟第一個類別」→ 什麼都變「餐飲」
 * （例：「1755 美妝（眼藥水」被記成 餐飲）。
 *
 * 用法：把這整份貼進 LINE bot 的 Apps Script 專案，
 * 然後把 bot 裡原本決定 category 的那行改成：
 *   var category = guessCategory_(item);   // item = 使用者輸入去掉金額後的文字
 *
 * 規則說明：
 * 1. 順序＝優先序，越具體的類別放越前面；「餐飲」是大網子，放最後掃。
 * 2. 全部沒中 → 回「其他」，不再亂猜。
 ********************************************/

var CATWORD_ = [
  ['餐飲', '咖啡儲值'],
  ['醫療', '醫院|診所|醫生|藥局|藥師|健保|掛號|看診|處方|牙醫|眼科|皮膚科|貼布'],
  ['美容', '睫毛|美睫|美甲|頭髮|剪髮|燙髮|染髮|理髮|髮廊|髮基因|做臉|美容|spa'],
  ['善心', '捐款|樂捐|善捐|捐獻|香油'],
  ['交際', '弔唁|白包|紅包|禮金|喜酒|伴手禮|送禮'],
  ['住宿', '飯店|hotel|airbnb|民宿|住宿|旅館|青旅'],
  ['交通', '捷運|高鐵|台鐵|火車|計程|小黃|uber(?!\\s?eats)|taxi|停車|加油|中油|油錢|客運|公車|ubike|悠遊卡|一卡通|儲值|機票|航空|租車|過路費'],
  ['娛樂', '電影|影城|ktv|遊戲|steam|netflix|spotify|disney|訂閱|展覽|演唱會|門票'],
  ['生活', '全聯|家樂福|大潤發|超市|costco|好市多|日用|洗衣|水電|電費|水費|瓦斯|電信|手機費|電話費|網路費|國民年金|年金|保險|稅|貢品|拜拜|口罩|充電'],
  ['購物', '購物|百貨|shopee|蝦皮|momo|pchome|博客來|amazon|淘寶|服飾|衣服|鞋|uniqlo|zara|lativ|3c|電器|家電|藥妝|屈臣|康是美|寶雅|美妝|保養|化妝|眼藥水|藥膏|感冒藥|維他命|保溫瓶|sabon'],
  ['餐飲', '早餐|午餐|晚餐|宵夜|餐|飯|麵|食|咖啡|cafe|starbucks|星巴克|路易莎|麥當勞|肯德基|摩斯|手搖|飲料|奶茶|茶|甜點|蛋糕|火鍋|燒肉|壽司|拉麵|便當|小吃|夜市|超商|7-?11|全家|便利|foodpanda|ubereats|外送']
];

/* 帳本類別若沒有「醫療」，中了醫療關鍵字時改回「生活」（藥妝同類），
   其他一律照表；全沒中回「其他」。 */
function guessCategory_(text) {
  text = ('' + text).toLowerCase();
  for (var i = 0; i < CATWORD_.length; i++) {
    if (new RegExp(CATWORD_[i][1], 'i').test(text)) {
      var c = CATWORD_[i][0];
      if (c === '醫療' && !hasCategory_('醫療')) return '生活';
      return c;
    }
  }
  return '其他';
}

/* 如果 bot 拿得到類別清單就檢查，拿不到就當作有 */
function hasCategory_(name) {
  try {
    if (typeof getConfig_ === 'function') {
      var cats = getConfig_().categories;
      if (cats && cats.length) return cats.indexOf(name) >= 0;
    }
  } catch (e) {}
  return true;
}
