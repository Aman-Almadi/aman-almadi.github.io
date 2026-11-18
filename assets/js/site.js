/* Aman Almadi - Reel Editor Toolkit site.
   Two small jobs: the demo machine on the home page, and the "Copy address" button on the contact page.
   No libraries, no network requests. */
(function () {
  'use strict';

  /* ------------------------------------------------------------ copy address (contact page) */
  var copyButton = document.getElementById('copy-email');
  if (copyButton) {
    var copiedNote = document.getElementById('copied');
    var timer = null;

    var say = function (text) {
      if (!copiedNote) return;
      copiedNote.textContent = text;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () { copiedNote.textContent = ''; }, 2500);
    };

    var fallbackCopy = function (text) {
      var box = document.createElement('textarea');
      box.value = text;
      box.setAttribute('readonly', '');
      box.style.position = 'fixed';
      box.style.opacity = '0';
      document.body.appendChild(box);
      box.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(box);
      return ok;
    };

    copyButton.addEventListener('click', function () {
      var address = copyButton.getAttribute('data-email');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(address).then(
          function () { say('Address copied.'); },
          function () { say(fallbackCopy(address) ? 'Address copied.' : 'Select the address above and copy it.'); }
        );
      } else {
        say(fallbackCopy(address) ? 'Address copied.' : 'Select the address above and copy it.');
      }
    });
  }

  /* ------------------------------------------------------------ the demo machine (home page) */
  var machine = document.getElementById('machine');
  var dataElement = document.getElementById('demo-data');
  if (!machine || !dataElement) return;

  var DATA = JSON.parse(dataElement.textContent);
  var ROWS = 3;
  var reels = Array.prototype.slice.call(machine.querySelectorAll('.reel'));
  var spinButton = document.getElementById('spin');
  var readout = document.getElementById('readout');
  var winLine = document.getElementById('win-line');
  var winLines = document.getElementById('win-lines');
  var what = document.getElementById('what');
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var canAnimate = typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';

  var busy = false;
  var started = false;
  var next = 0;

  what.textContent = what.textContent + ' Press Spin to play the eight planned results, one per spin.';

  function makeCell(name) {
    var cell = document.createElement('div');
    cell.className = 'cell';
    cell.setAttribute('data-sym', name);
    var img = document.createElement('img');
    img.src = DATA.base + name + '.webp';
    img.alt = '';
    img.width = 256;
    img.height = 256;
    cell.appendChild(img);
    return cell;
  }

  function symbolsOf(strip) {
    return Array.prototype.map.call(strip.children, function (cell) { return cell.getAttribute('data-sym'); });
  }

  function fill(strip, list) {
    strip.textContent = '';
    list.forEach(function (name) { strip.appendChild(makeCell(name)); });
  }

  function randomSymbol() {
    return DATA.symbols[Math.floor(Math.random() * DATA.symbols.length)];
  }

  function land(reelIndex, list) {
    var strip = reels[reelIndex].firstElementChild;
    fill(strip, list);
    strip.style.transform = '';
  }

  // One reel: the new symbols sit on top of a strip of random ones, with the old symbols at the bottom.
  // The strip slides down so the new symbols arrive from above, then settles with a small bounce.
  function spinReel(reelIndex, list, duration) {
    return new Promise(function (resolve) {
      var strip = reels[reelIndex].firstElementChild;
      var old = symbolsOf(strip);
      var between = [];
      for (var i = 0; i < 9 + reelIndex * 4; i++) between.push(randomSymbol());
      var all = list.concat(between, old);
      var n = all.length;
      var from = -((n - ROWS) / n) * 100;     // old symbols in view
      var over = (0.16 / n) * 100;            // a little past the end, then back

      fill(strip, all);
      strip.style.transform = 'translateY(' + from + '%)';

      var animation = strip.animate([
        { transform: 'translateY(' + from + '%)', easing: 'cubic-bezier(.45,0,.35,1)' },
        { transform: 'translateY(' + over + '%)', offset: 0.9, easing: 'ease-out' },
        { transform: 'translateY(0%)' }
      ], { duration: duration, fill: 'both' });

      animation.onfinish = function () {
        land(reelIndex, list);
        animation.cancel();
        resolve();
      };
    });
  }

  function clearWins() {
    Array.prototype.forEach.call(machine.querySelectorAll('.cell.win'), function (cell) { cell.classList.remove('win'); });
  }

  // Shows what the demo's PaylineManager shows: the total, then one line per win.
  function showResult(spin, index) {
    spin.cells.forEach(function (position) {
      var strip = reels[position[0]].firstElementChild;
      strip.children[position[1]].classList.add('win');
    });

    if (spin.win > 0) {
      winLine.hidden = false;
      winLine.textContent = 'WIN ' + spin.win;
    } else {
      winLine.hidden = false;
      winLine.textContent = 'No win';
    }

    winLines.textContent = '';
    spin.wins.forEach(function (win) {
      var item = document.createElement('li');
      item.textContent = win.line + ':  ' + win.count + ' x ' + win.symbol + '  =  ' + win.pay;
      winLines.appendChild(item);
    });

    what.textContent = '';
    var count = document.createElement('span');
    count.className = 'count';
    count.textContent = 'Spin ' + (index + 1) + ' of ' + DATA.spins.length + '. ';
    what.appendChild(count);
    what.appendChild(document.createTextNode(spin.text));

    readout.classList.remove('is-spinning');
  }

  function play(index) {
    if (busy) return;
    busy = true;
    spinButton.setAttribute('aria-disabled', 'true');

    var spin = DATA.spins[index];
    var columns = [0, 1, 2, 3, 4].map(function (reel) {
      return [spin.rows[0][reel], spin.rows[1][reel], spin.rows[2][reel]];
    });

    clearWins();
    readout.classList.add('is-spinning');

    var finish = function () {
      showResult(spin, index);
      next = (index + 1) % DATA.spins.length;
      busy = false;
      spinButton.removeAttribute('aria-disabled');
    };

    if (reduceMotion || !canAnimate) {
      columns.forEach(function (list, reel) { land(reel, list); });
      finish();
      return;
    }

    Promise.all(columns.map(function (list, reel) {
      return spinReel(reel, list, 1000 + reel * 300);
    })).then(finish);
  }

  spinButton.addEventListener('click', function () {
    started = true;
    play(next);
  });

  // The page opens with one spin, once the machine is on screen. Nobody has to find the button first.
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !started) {
          started = true;
          observer.disconnect();
          window.setTimeout(function () { play(next); }, 700);
        }
      });
    }, { threshold: 0.6 });
    observer.observe(machine);
  }
})();
