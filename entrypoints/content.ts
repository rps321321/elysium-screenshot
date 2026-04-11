export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    let overlay: HTMLDivElement | null = null;
    let selectionBox: HTMLDivElement | null = null;
    let highlightBox: HTMLDivElement | null = null;
    let tagLabel: HTMLDivElement | null = null;
    let startX = 0;
    let startY = 0;

    // Cleanup handlers
    let abortController: AbortController | null = null;

    // Track active countdown intervals for cleanup
    let activeCountdownInterval: ReturnType<typeof setInterval> | null = null;
    let activeCountdownEl: HTMLElement | null = null;

    browser.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {
      try {
        switch (message.type) {
          case 'START_REGION_SELECT':
            cleanupAll();
            startRegionSelect();
            sendResponse({ status: 'ok' });
            break;
          case 'START_ELEMENT_SELECT':
            cleanupAll();
            startElementSelect();
            sendResponse({ status: 'ok' });
            break;
          case 'GET_PAGE_DIMENSIONS':
            sendResponse({
              scrollHeight: Math.max(
                document.body.scrollHeight,
                document.documentElement.scrollHeight,
              ),
              scrollWidth: Math.max(
                document.body.scrollWidth,
                document.documentElement.scrollWidth,
              ),
              viewportHeight: window.innerHeight,
              viewportWidth: window.innerWidth,
              devicePixelRatio: window.devicePixelRatio,
            });
            break;
          case 'SCROLL_CAPTURE_STEP':
            window.scrollTo({ top: message.scrollY, behavior: 'instant' });
            // Return actual scroll position (browser clamps to max)
            sendResponse({ status: 'ok', actualScrollY: window.scrollY });
            break;
          case 'HIDE_SCROLLBAR': {
            document.documentElement.style.setProperty('scrollbar-width', 'none', 'important');
            document.body.style.setProperty('scrollbar-width', 'none', 'important');
            let styleEl = document.getElementById('elysium-hide-scrollbar');
            if (!styleEl) {
              styleEl = document.createElement('style');
              styleEl.id = 'elysium-hide-scrollbar';
              styleEl.textContent = '::-webkit-scrollbar { display: none !important; }';
              document.head.appendChild(styleEl);
            }
            // Hide sticky and fixed elements
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
            let node = walker.nextNode();
            while (node) {
              const el = node as HTMLElement;
              const computed = window.getComputedStyle(el);
              if (computed.position === 'fixed' || computed.position === 'sticky') {
                // Check if position was set via inline style or via CSS class/sheet
                const inlinePos = el.style.position;
                if (inlinePos) {
                  // The element had an explicit inline style — preserve its exact value
                  el.dataset.elysiumPosBackup = inlinePos;
                  el.dataset.elysiumHadInline = 'true';
                } else {
                  // Position came from CSS — we just need to remove our override later
                  el.dataset.elysiumPosBackup = computed.position;
                  el.dataset.elysiumHadInline = 'false';
                }
                el.style.setProperty('position', 'absolute', 'important');
              }
              node = walker.nextNode();
            }
            sendResponse({ status: 'ok' });
            break;
          }
          case 'SHOW_SCROLLBAR': {
            document.documentElement.style.removeProperty('scrollbar-width');
            document.body.style.removeProperty('scrollbar-width');
            const styleEl = document.getElementById('elysium-hide-scrollbar');
            if (styleEl) styleEl.remove();
            
            // Restore sticky/fixed elements
            document.querySelectorAll('[data-elysium-pos-backup]').forEach(rawEl => {
              const el = rawEl as HTMLElement;
              if (el.dataset.elysiumHadInline === 'true') {
                // Restore the original inline style value exactly as it was
                el.style.setProperty('position', el.dataset.elysiumPosBackup!);
              } else {
                // Position came from CSS — remove our inline override so CSS resumes
                el.style.removeProperty('position');
              }
              delete el.dataset.elysiumPosBackup;
              delete el.dataset.elysiumHadInline;
            });
            
            sendResponse({ status: 'ok' });
            break;
          }
          case 'SHOW_COUNTDOWN':
            cleanupCountdown(); // Clean up any previous countdown first
            showCountdown(message.seconds);
            sendResponse({ status: 'ok' });
            break;
          case 'PING':
            sendResponse({ status: 'alive' });
            break;
          default:
            sendResponse(null);
        }
      } catch (err) {
        console.error('Elysium content script error:', err);
        sendResponse({ error: String(err) });
      }
      return true;
    });

    function cleanupCountdown() {
      if (activeCountdownInterval) {
        clearInterval(activeCountdownInterval);
        activeCountdownInterval = null;
      }
      if (activeCountdownEl) {
        activeCountdownEl.remove();
        activeCountdownEl = null;
      }
    }

    function cleanupAll() {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      overlay?.remove();
      overlay = null;
      selectionBox?.remove();
      selectionBox = null;
      highlightBox?.remove();
      highlightBox = null;
      tagLabel?.remove();
      tagLabel = null;
      cleanupCountdown();
    }

    // ─── Region Select ───
    function startRegionSelect() {
      overlay = document.createElement('div');
      overlay.id = 'elysium-overlay';
      Object.assign(overlay.style, {
        position: 'fixed', top: '0', left: '0',
        width: '100vw', height: '100vh',
        zIndex: '2147483647', cursor: 'crosshair',
        background: 'rgba(0,0,0,0.25)',
      });
      document.documentElement.appendChild(overlay);

      // Instructions
      const tip = document.createElement('div');
      Object.assign(tip.style, {
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(0,0,0,0.8)', color: 'white',
        padding: '14px 22px', borderRadius: '10px',
        fontSize: '15px', fontFamily: 'system-ui, sans-serif',
        pointerEvents: 'none', zIndex: '2147483647',
      });
      tip.textContent = 'Click and drag to select a region. Press Escape to cancel.';
      overlay.appendChild(tip);

      abortController = new AbortController();
      let isDragging = false;

      const onMouseDown = (e: MouseEvent) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        tip.remove();

        selectionBox = document.createElement('div');
        Object.assign(selectionBox.style, {
          position: 'fixed',
          border: '2px dashed #4f46e5',
          background: 'rgba(79, 70, 229, 0.1)',
          zIndex: '2147483647',
          pointerEvents: 'none',
        });
        if (overlay) {
          overlay.appendChild(selectionBox);
        }
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!isDragging || !selectionBox) return;
        const x = Math.min(e.clientX, startX);
        const y = Math.min(e.clientY, startY);
        Object.assign(selectionBox.style, {
          left: `${x}px`, top: `${y}px`,
          width: `${Math.abs(e.clientX - startX)}px`,
          height: `${Math.abs(e.clientY - startY)}px`,
        });
      };

      const onMouseUp = (e: MouseEvent) => {
        if (!isDragging) return;
        isDragging = false;
        const x = Math.min(e.clientX, startX);
        const y = Math.min(e.clientY, startY);
        const width = Math.abs(e.clientX - startX);
        const height = Math.abs(e.clientY - startY);

        cleanupAll();

        if (width > 5 && height > 5) {
          // Small delay to ensure overlay is gone before background captures
          setTimeout(() => {
            browser.runtime.sendMessage({
              type: 'REGION_SELECTED',
              rect: { x, y, width, height },
            });
          }, 50);
        }
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') cleanupAll();
      };

      const listenerOptions = { signal: abortController.signal, capture: true };
      overlay.addEventListener('mousedown', onMouseDown, listenerOptions);
      overlay.addEventListener('mousemove', onMouseMove, listenerOptions);
      overlay.addEventListener('mouseup', onMouseUp, listenerOptions);
      document.addEventListener('keydown', onKeyDown, listenerOptions);
    }

    // ─── Element Select ───
    function startElementSelect() {
      // Transparent overlay to capture events
      overlay = document.createElement('div');
      overlay.id = 'elysium-overlay';
      Object.assign(overlay.style, {
        position: 'fixed', top: '0', left: '0',
        width: '100vw', height: '100vh',
        zIndex: '2147483646', cursor: 'crosshair',
        background: 'transparent',
        // Let mouse events through so we can detect elements below
        pointerEvents: 'none',
      });
      document.documentElement.appendChild(overlay);

      highlightBox = document.createElement('div');
      Object.assign(highlightBox.style, {
        position: 'fixed', border: '2px solid #4f46e5',
        background: 'rgba(79, 70, 229, 0.15)',
        zIndex: '2147483645', pointerEvents: 'none',
        borderRadius: '3px', transition: 'all 0.06s ease',
      });
      document.documentElement.appendChild(highlightBox);

      tagLabel = document.createElement('div');
      Object.assign(tagLabel.style, {
        position: 'fixed', background: '#4f46e5', color: 'white',
        padding: '2px 8px', borderRadius: '0 0 4px 4px',
        fontSize: '11px', fontFamily: 'monospace',
        zIndex: '2147483647', pointerEvents: 'none',
      });
      document.documentElement.appendChild(tagLabel);

      // Tip
      const tip = document.createElement('div');
      Object.assign(tip.style, {
        position: 'fixed', top: '12px', left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.8)', color: 'white',
        padding: '8px 16px', borderRadius: '8px',
        fontSize: '13px', fontFamily: 'system-ui, sans-serif',
        zIndex: '2147483647', pointerEvents: 'none',
      });
      tip.textContent = 'Hover over an element and click to capture it. Press Escape to cancel.';
      document.documentElement.appendChild(tip);
      const tipTimeout = setTimeout(() => { if (tip.parentNode) tip.remove(); }, 3000);

      const onMouseMove = (e: MouseEvent) => {
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
        if (!el || el === overlay || el === highlightBox || el === tagLabel) return;

        const rect = el.getBoundingClientRect();
        if (highlightBox) {
          Object.assign(highlightBox.style, {
            left: `${rect.x}px`, top: `${rect.y}px`,
            width: `${rect.width}px`, height: `${rect.height}px`,
          });
        }

        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : '';
        const cls = el.className && typeof el.className === 'string'
          ? '.' + el.className.split(' ').filter(Boolean).slice(0, 2).join('.')
          : '';
        if (tagLabel) {
          tagLabel.textContent = `${tag}${id}${cls}`;
          Object.assign(tagLabel.style, {
            left: `${rect.x}px`,
            top: `${Math.max(0, rect.y - 22)}px`,
          });
        }
      };

      const onClick = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
        if (!el || el === overlay || el === highlightBox || el === tagLabel) return;

        const rect = el.getBoundingClientRect();
        cleanupAll();
        clearTimeout(tipTimeout);
        if (tip.parentNode) tip.remove();

        setTimeout(() => {
          browser.runtime.sendMessage({
            type: 'ELEMENT_SELECTED',
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          });
        }, 50);
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          cleanupAll();
          clearTimeout(tipTimeout);
          if (tip.parentNode) tip.remove();
        }
      };



      abortController = new AbortController();
      const listenerOptions = { signal: abortController.signal, capture: true };
      document.addEventListener('mousemove', onMouseMove, listenerOptions);
      document.addEventListener('click', onClick, listenerOptions);
      document.addEventListener('keydown', onKeyDown, listenerOptions);
    }

    // ─── Countdown ───
    function showCountdown(seconds: number) {
      const el = document.createElement('div');
      Object.assign(el.style, {
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(0,0,0,0.85)', color: 'white',
        width: '100px', height: '100px', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '42px', fontWeight: 'bold',
        fontFamily: 'system-ui, sans-serif',
        zIndex: '2147483647',
        transition: 'transform 0.25s ease, opacity 0.25s ease',
      });
      document.documentElement.appendChild(el);
      activeCountdownEl = el;

      let remaining = seconds;
      el.textContent = String(remaining);

      activeCountdownInterval = setInterval(() => {
        remaining--;
        if (remaining > 0) {
          el.textContent = String(remaining);
        } else {
          cleanupCountdown();
        }
      }, 1000);
    }
  },
});
