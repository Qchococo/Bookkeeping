/***** 記帳 App — Google Apps Script JSON API 後端（給 GitHub Pages 前端用）*****
 * 用法：到 https://script.google.com 新增專案，貼上這份 Code.gs，部署成「網頁應用程式」。
 * 它用「明確的試算表 ID」綁定你的「記帳本」，所以無論從哪裡呼叫，都一定讀寫同一份 Sheet。
 *
 * 前端（index.html）會用 fetch 呼叫這個 /exec 網址：
 *   - 讀資料：GET  ?action=getData
 *   - 寫資料：GET  ?action=addEntry&payload=...（小資料）
 *   - 上傳收據：POST {action:"uploadReceipt", payload:{...}}
 ********************************************/

var SHEET_ID = '1FaRsCYbJlUXvbxFfgZwI7knQSGqRIq81mq90PpVmU78'; // 你的「記帳本」
var RECEIPT_FOLDER_ID = '1AO2P1S6Dn4LLPDWwoiCWJD3FMyVhziFp'; // 寫死的收據資料夾（收據自動上傳到這裡）
var SHEET_EXP = 'Expenses';
var SHEET_CFG = 'Config';
var HEAD = ['id','date','item','amount','currency','base','rateUsed','payer','method','category','kind','note','ts','receipts','trip','day'];

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    var a = (e && e.parameter && e.parameter.action) || 'getData';
    if (a === 'getData') return out_(getData());
    var payload = (e && e.parameter && e.parameter.payload) ? JSON.parse(e.parameter.payload) : null;
    return out_({ result: dispatch_(a, payload) });
  } catch (err) {
    return out_({ error: String(err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    return out_({ result: dispatch_(body.action, body.payload) });
  } catch (err) {
    return out_({ error: String(err) });
  }
}

function dispatch_(a, p) {
  if (a === 'getData') return getData();
  if (a === 'addEntry') return addEntry(p);
  if (a === 'updateEntry') return updateEntry(p);
  if (a === 'deleteEntry') return deleteEntry(p);
  if (a === 'saveConfig') return saveConfig(p);
  if (a === 'uploadReceipt') return uploadReceipt(p);
  throw new Error('unknown action: ' + a);
}

function ss_() { return SpreadsheetApp.openById(SHEET_ID); }

function ensure_() {
  var s = ss_();
  var e = s.getSheetByName(SHEET_EXP);
  if (!e) { e = s.insertSheet(SHEET_EXP); e.appendRow(HEAD); }
  var lastCol = Math.max(e.getLastColumn(), 1);
  var header = e.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < HEAD.length; i++) {
    if (header[i] !== HEAD[i]) e.getRange(1, i + 1).setValue(HEAD[i]);
  }
  var c = s.getSheetByName(SHEET_CFG);
  if (!c) { c = s.insertSheet(SHEET_CFG); c.appendRow(['key', 'value']); }
  return { e: e, c: c };
}

function getConfig_() {
  var c = ensure_().c;
  var vals = c.getDataRange().getValues();
  var o = {};
  for (var i = 1; i < vals.length; i++) {
    if (vals[i][0] === '') continue;
    try { o[vals[i][0]] = JSON.parse(vals[i][1]); }
    catch (err) { o[vals[i][0]] = vals[i][1]; }
  }
  return o;
}

function getData() {
  var e = ensure_().e;
  var vals = e.getDataRange().getValues();
  var head = vals[0];
  var items = [];
  for (var i = 1; i < vals.length; i++) {
    if (vals[i][0] === '') continue;
    var r = {};
    for (var j = 0; j < head.length; j++) {
      var v = vals[i][j];
      if (v instanceof Date) v = Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      r[head[j]] = v;
    }
    items.push(r);
  }
  return { items: items, config: getConfig_() };
}

function rowOf_(rec) {
  return HEAD.map(function (k) {
    var v = rec[k];
    if (v === undefined || v === null) return '';
    if (k === 'receipts' && typeof v !== 'string') return JSON.stringify(v);
    return v;
  });
}

function receiptFolder_() {
  if (RECEIPT_FOLDER_ID) { try { return DriveApp.getFolderById(RECEIPT_FOLDER_ID); } catch (e) {} }
  var cfg = getConfig_();
  var link = cfg.drive || '';
  var m = ('' + link).match(/[-\w]{25,}/);
  if (m) { try { return DriveApp.getFolderById(m[0]); } catch (e) {} }
  var it = DriveApp.getFoldersByName('記帳收據');
  return it.hasNext() ? it.next() : DriveApp.createFolder('記帳收據');
}
function subFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function uploadReceipt(payload) {
  var folder = receiptFolder_();
  if (payload.month) folder = subFolder_(folder, payload.month);
  var bytes = Utilities.base64Decode(payload.dataBase64);
  var blob = Utilities.newBlob(bytes, payload.mime || 'image/jpeg', payload.name || ('receipt_' + Date.now() + '.jpg'));
  var file = folder.createFile(blob);
  return { id: file.getId(), url: file.getUrl() };
}

function addEntry(rec) { ensure_().e.appendRow(rowOf_(rec)); return true; }

function updateEntry(rec) {
  var e = ensure_().e;
  var ids = e.getRange(1, 1, e.getLastRow(), 1).getValues();
  for (var i = 1; i < ids.length; i++) {
    if (ids[i][0] === rec.id) { e.getRange(i + 1, 1, 1, HEAD.length).setValues([rowOf_(rec)]); return true; }
  }
  return false;
}

function deleteEntry(id) {
  var e = ensure_().e;
  var ids = e.getRange(1, 1, e.getLastRow(), 1).getValues();
  for (var i = 1; i < ids.length; i++) {
    if (ids[i][0] === id) { e.deleteRow(i + 1); return true; }
  }
  return false;
}

function saveConfig(cfg) {
  var c = ensure_().c;
  c.clear();
  c.appendRow(['key', 'value']);
  var rows = Object.keys(cfg).map(function (k) { return [k, JSON.stringify(cfg[k])]; });
  if (rows.length) c.getRange(2, 1, rows.length, 2).setValues(rows);
  return true;
}

/***** 一次性：把預設值寫進 Sheet 設定 *****
 * 在 Apps Script 編輯器上方函式下拉選 setupDefaults → 按 Run，跑一次即可。
 * 會設定付款人 = Q,J，以及常用項目清單；其他設定（幣別、類別…）保留原本的。
 ********************************************/
function setupDefaults() {
  var cfg = getConfig_();
  cfg.people = ['Q', 'J'];
  cfg.quickItems = ['早餐,餐飲','午餐,餐飲','晚餐,餐飲','手搖飲,餐飲','咖啡,餐飲','uber,交通','儲值,交通','全聯,生活','日用品,生活'];
  if (!cfg.base) cfg.base = 'TWD';
  if (!cfg.currencies) cfg.currencies = ['TWD', 'JPY'];
  if (!cfg.categories) cfg.categories = ['餐飲','交通','購物','娛樂','住宿','生活','其他'];
  if (!cfg.methods) cfg.methods = ['現金','信用卡','行動支付','其他'];
  if (!cfg.manualRates) cfg.manualRates = { JPY: 0.21 };
  if (!cfg.trips) cfg.trips = [];
  saveConfig(cfg);
  return cfg;
}
