/* ==========================================================================
   head cool — script.js (ใช้ร่วมกันทุกหน้า)
   - product.html : #filter-bar, #product-list
   - order.html   : #orderForm, #customerName, #contact, #items, #total, #note
   - admin.html   : #ordersTable tbody
   แต่ละส่วนจะทำงานเฉพาะเมื่อเจอ element ของหน้านั้นๆ
   ========================================================================== */

(function () {
  'use strict';

  /* ---------- Config ---------- */
  var ORDER_ENDPOINT =
    'https://script.google.com/macros/s/AKfycbzp1W1nsK_ihC8WurchpSGbeZ0CfUdFRTebtdBnE4nGgfRbQOvrTeVBpp2Cc8J_0meV/exec';

  var ORDERS_CSV_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQppe5C2k_u__-TR_LeX1E20TNga_CwZ1IrQN6U5d-53tY2V85st9B1o9YD3vONkLRrcmJuT7Kab_-Y/pub?gid=0&single=true&output=csv';

  var MOODS = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'sport', label: 'SPORT' },
    { key: 'confident', label: 'CONFIDENT' }
  ];

  /* ---------- Helpers ---------- */
  function $(selector) {
    return document.querySelector(selector);
  }

  function formatPrice(n) {
    return Number(n).toLocaleString('th-TH');
  }

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  /* ==========================================================================
     1) product.html — โหลดสินค้า + กรองตามสูตร
     ========================================================================== */
  function initProducts() {
    var filterBar = $('#filter-bar');
    var list = $('#product-list');
    if (!filterBar || !list) return;

    var products = [];
    var currentMood = 'all';

    function isValidMood(m) {
      return MOODS.some(function (x) { return x.key === m; });
    }

    function renderFilters() {
      filterBar.innerHTML = '';
      MOODS.forEach(function (m) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-btn' + (m.key === currentMood ? ' is-active' : '');
        btn.dataset.mood = m.key;
        btn.textContent = m.label;
        btn.setAttribute('aria-pressed', m.key === currentMood ? 'true' : 'false');
        btn.addEventListener('click', function () {
          setMood(m.key);
        });
        filterBar.appendChild(btn);
      });
    }

    function buildOrderUrl(p) {
      var itemName = p.size ? p.name + ' ' + p.size : p.name;
      return (
        'order.html?item=' + encodeURIComponent(itemName) +
        '&price=' + encodeURIComponent(p.price)
      );
    }

    function createCard(p) {
      var card = document.createElement('article');
      card.className = 'product-card';
      card.dataset.mood = p.mood;

      var media = document.createElement('div');
      media.className = 'product-card__media';
      var img = document.createElement('img');
      img.src = p.image;
      img.alt = p.name + (p.size ? ' ' + p.size : '');
      img.loading = 'lazy';
      media.appendChild(img);

      var body = document.createElement('div');
      body.className = 'product-card__body';

      var moodLabel = document.createElement('span');
      moodLabel.className = 'mood-label';
      var dot = document.createElement('span');
      dot.className = 'mood-dot';
      moodLabel.appendChild(dot);
      moodLabel.appendChild(
        document.createTextNode(p.mood.charAt(0).toUpperCase() + p.mood.slice(1))
      );

      var title = document.createElement('h3');
      title.className = 'product-card__title';
      title.textContent = p.name;

      var meta = document.createElement('p');
      meta.className = 'product-card__meta';
      meta.textContent = p.size ? 'แชมพูสำหรับคนรักกีฬา ' + p.size : 'แชมพูสำหรับคนรักกีฬา';

      var desc = document.createElement('p');
      desc.className = 'product-card__desc';
      desc.textContent = p.description || '';

      var foot = document.createElement('div');
      foot.className = 'product-card__foot';

      var price = document.createElement('span');
      price.className = 'price';
      price.textContent = formatPrice(p.price);
      var unit = document.createElement('small');
      unit.textContent = 'บาท';
      price.appendChild(unit);

      var buy = document.createElement('a');
      buy.className = 'btn btn--accent';
      buy.href = buildOrderUrl(p);
      buy.textContent = 'สั่งซื้อ';

      foot.appendChild(price);
      foot.appendChild(buy);

      body.appendChild(moodLabel);
      body.appendChild(title);
      body.appendChild(meta);
      body.appendChild(desc);
      body.appendChild(foot);

      card.appendChild(media);
      card.appendChild(body);
      return card;
    }

    function renderProducts() {
      list.innerHTML = '';
      var shown = products.filter(function (p) {
        return currentMood === 'all' || p.mood === currentMood;
      });

      if (shown.length === 0) {
        var empty = document.createElement('p');
        empty.textContent = 'ไม่พบสินค้าในหมวดนี้';
        list.appendChild(empty);
        return;
      }

      shown.forEach(function (p) {
        list.appendChild(createCard(p));
      });
    }

    function setMood(mood) {
      currentMood = isValidMood(mood) ? mood : 'all';
      renderFilters();
      renderProducts();
    }

    // กรองอัตโนมัติจาก ?mood=xxx
    var paramMood = (getParam('mood') || '').toLowerCase();
    if (isValidMood(paramMood)) currentMood = paramMood;
    renderFilters();

    fetch('products.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        products = data;
        renderProducts();
      })
      .catch(function (error) {
        console.error(error);
        list.innerHTML = '';
        var msg = document.createElement('p');
        msg.textContent = 'โหลดข้อมูลสินค้าไม่สำเร็จ กรุณารีเฟรชหน้านี้อีกครั้ง';
        list.appendChild(msg);
      });
  }

  /* ==========================================================================
     2) order.html — เติมฟอร์มจาก URL + ส่งคำสั่งซื้อ
     ========================================================================== */
  function initOrder() {
    var form = $('#orderForm');
    if (!form) return;

    var itemsEl = $('#items');
    var totalEl = $('#total');

    // เติมชื่อสินค้าและราคาจาก URL parameter ทันทีที่โหลดหน้า
    var item = getParam('item');
    var price = getParam('price');
    if (itemsEl && item) itemsEl.value = item;
    if (totalEl && price) totalEl.value = price;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;

      function val(id) {
        var el = document.getElementById(id);
        return el ? el.value.trim() : '';
      }

      var payload = {
        customerName: val('customerName'),
        contact: val('contact'),
        items: val('items'),
        total: val('total'),
        note: val('note')
      };

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      fetch(ORDER_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      .then(() => { window.location.href = 'thankyou.html'; })
      .catch(error => {
        console.error(error);
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        if (submitBtn) submitBtn.disabled = false;
      });
    });
  }

  /* ==========================================================================
     3) admin.html — ดึง CSV จาก Google Sheets แสดงเป็นตาราง
     ========================================================================== */

  // parse CSV เอง: รองรับ "..." , "" (escaped quote), ขึ้นบรรทัดใหม่ในช่อง, CRLF
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // ตัด BOM

    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;

    for (var i = 0; i < text.length; i++) {
      var c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += c;
      }
    }

    // แถวสุดท้าย (กรณีไฟล์ไม่ลงท้ายด้วยขึ้นบรรทัดใหม่)
    if (field !== '' || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    return rows;
  }

  function initAdmin() {
    var tbody = $('#ordersTable tbody');
    if (!tbody) return;

    var COLS = 6; // วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ

    function showMessage(text) {
      tbody.innerHTML = '';
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = COLS;
      td.textContent = text;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    showMessage('กำลังโหลดข้อมูล...');

    fetch(ORDERS_CSV_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text).filter(function (r) {
          return r.some(function (cell) { return cell.trim() !== ''; });
        });

        rows.shift(); // ตัดแถวหัวตาราง

        if (rows.length === 0) {
          showMessage('ยังไม่มีรายการสั่งซื้อ');
          return;
        }

        // แถวใหม่ถูกต่อท้ายชีตเสมอ จึงกลับลำดับให้รายการล่าสุดขึ้นก่อน
        rows.reverse();

        tbody.innerHTML = '';
        rows.forEach(function (r) {
          var tr = document.createElement('tr');
          for (var i = 0; i < COLS; i++) {
            var td = document.createElement('td');
            td.textContent = r[i] !== undefined ? r[i] : '';
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (error) {
        console.error(error);
        showMessage('โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้านี้อีกครั้ง');
      });
  }

  /* ---------- Init ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    initProducts();
    initOrder();
    initAdmin();
  });
})();
