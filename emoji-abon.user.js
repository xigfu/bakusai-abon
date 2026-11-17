// ==UserScript==
// @name         爆サイの荒らしレスをあぼーん
// @namespace    http://tampermonkey.net/
// @author       xigfu
// @version      1.37.6
// @homepageURL  https://xigfu.github.io/bakusai-abon/
// @source       https://github.com/xigfu/bakusai-abon
// @supportURL   https://xigfu.github.io/bakusai-abon/#help
// @updateURL    https://xigfu.github.io/bakusai-abon/emoji-abon.user.js
// @downloadURL  https://xigfu.github.io/bakusai-abon/emoji-abon.user.js
// @description  指定したタイトルのスレッドで、絵文字や設定したワード・顔文字・記号を含む本文を「あぼーん」にします。
// @match        https://bakusai.com/thr_res/*
// @match        https://sp.bakusai.com/thr_res/*
// @run-at       document-end
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==
(function () {
    'use strict';
    const defaults = {
        titles: ['大番会館 新宿店'],
        words: ['朱なみ', 'アカナミ', '戌'],
        faces: ['(*^-^)', '(・・?'],
        symbols: ['♪']
    };
    const storageKey = 'abon-settings-v1';
    const stored = GM_getValue(storageKey, {}) || {};
    const categories = [['words', 'ワード'], ['faces', '顔文字'], ['symbols', '記号']];
    const keys = ['titles', ...categories.map(([key]) => key)];
    const clean = value => Array.isArray(value)
        ? [...new Set(value.filter(x => typeof x === 'string').map(x => x.trim()).filter(Boolean))] : [];
    const normalize = item => ({...Object.fromEntries(keys.map(key => [key, clean(item?.[key])])), emoji: item?.emoji !== false, blank: item?.blank === true,
        enabled: Object.fromEntries(categories.map(([key]) => [key, item?.enabled?.[key] !== false]))
    });
    const profiles = Array.isArray(stored.profiles)
        ? stored.profiles.map(normalize)
        : [normalize(defaults)];
    // 半角カタカナだけを全角化する。顔文字や他の互換文字は変換しない。
    const normalizeWord = text => text
        .replace(/[\uFF66-\uFF9F]+/g, part => part.normalize('NFKC'))
        .replace(/[A-Z]/g, letter => letter.toLowerCase());
    const emojiRegex = /\p{Extended_Pictographic}|\p{Emoji_Presentation}/u;
    const inputStyle = 'box-sizing:border-box !important;display:block !important;width:100% !important;min-height:110px !important;height:auto !important;font:18px/1.5 sans-serif !important;margin:8px 0 16px !important;padding:10px !important;color:#222 !important;background:#fff !important;border:2px solid #737d8c !important;border-radius:6px !important;opacity:1 !important;visibility:visible !important;overflow:auto !important;resize:vertical !important;';
    function makeButton(text, style = 'font:inherit;padding:12px;margin:6px;') {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = text;
        button.style.cssText = style;
        return button;
    }
    const parseLines = text => clean(text.split(/\r?\n/));
    function addExpandButton(container, input) {
        const button = makeButton('入力欄を広げる');
        button.setAttribute('aria-expanded', 'false');
        let expanded = false;
        button.addEventListener('click', () => {
            expanded = !expanded;
            input.style.setProperty('height', expanded ? '50vh' : 'auto', 'important');
            button.textContent = expanded ? '元の大きさに戻す' : '入力欄を広げる';
            button.setAttribute('aria-expanded', String(expanded));
        });
        container.append(button);
    }
    function openSettings() {
        if (document.getElementById('abon-settings-dialog')) return;
        const dialog = document.createElement('dialog');
        dialog.id = 'abon-settings-dialog';
        dialog.style.cssText = 'box-sizing:border-box;width:94%;max-width:540px;max-height:85vh;overflow:auto;padding:20px;border:2px solid #555;border-radius:12px;background:#fff;color:#222;font:18px/1.6 sans-serif;';
        const title = document.createElement('h2');
        title.textContent = 'あぼーんの設定';
        const settingsGuide = document.createElement('a');
        settingsGuide.href = 'https://xigfu.github.io/bakusai-abon/#settings-reference';
        settingsGuide.target = '_blank';
        settingsGuide.rel = 'noopener';
        settingsGuide.textContent = '設定項目の説明を見る';
        settingsGuide.style.cssText = 'display:block;margin:0 0 16px;color:#1259a8;text-decoration:underline;';
        dialog.append(title, settingsGuide);
        const drafts = profiles.map(normalize);
        if (!drafts.length) drafts.push(normalize({}));
        let selected = 0;
        const settings = drafts[0];
        const chooserLabel = document.createElement('label');
        chooserLabel.textContent = '編集するルール';
        const chooser = document.createElement('select');
        chooser.style.cssText = 'box-sizing:border-box !important;display:block !important;width:100% !important;max-width:100% !important;min-width:0 !important;height:54px !important;min-height:54px !important;max-height:none !important;font:18px/1.5 sans-serif !important;padding:8px 32px 8px 10px !important;margin:8px 0 16px !important;border:2px solid #737d8c !important;border-radius:6px !important;color:#222 !important;background-color:#fff !important;appearance:auto !important;text-indent:0 !important;letter-spacing:normal !important;';
        chooserLabel.append(chooser);
        dialog.append(chooserLabel);
        const add = makeButton('新しいルールを追加', 'font:inherit;padding:10px;margin:6px;');
        const drop = makeButton('このルールを削除', 'font:inherit;padding:10px;margin:6px;');
        const ruleActions = document.createElement('div');
        ruleActions.style.display = 'block';
        ruleActions.style.marginBottom = '16px';
        ruleActions.append(drop, add);
        dialog.append(ruleActions);
        const inputs = {};
        const categoryInputs = {};
        const titleLabel = document.createElement('label');
        titleLabel.textContent = 'このルールの対象とするスレッドまたはワード（1行に1つ）';
        titleLabel.style.display = 'block';
        const titleInput = document.createElement('textarea');
        titleInput.rows = 3;
        titleInput.style.cssText = inputStyle;
        titleInput.value = settings.titles.join('\n');
        titleLabel.append(titleInput);
        dialog.append(titleLabel);
        addExpandButton(dialog, titleInput);
        inputs.titles = titleInput;
        const displayLabel = document.createElement('label');
        displayLabel.textContent = '非表示にした投稿内容の表示方法';
        const displayInput = document.createElement('select');
        displayInput.style.cssText = chooser.style.cssText;
        for (const [value, text] of [['label', 'あぼーん（初期設定）'], ['blank', '空白（文字を表示しない）']]) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = text;
            displayInput.append(option);
        }
        displayInput.value = settings.blank ? 'blank' : 'label';
        displayLabel.append(displayInput);
        dialog.append(displayLabel);
        const rulesHeading = document.createElement('h3');
        if (globalThis.matchMedia?.('(max-width: 600px)').matches) rulesHeading.style.setProperty('margin-top', '24px', 'important');
        rulesHeading.textContent = 'ルールの設定';
        const entryHint = document.createElement('p');
        entryHint.textContent = 'ワード・顔文字・記号は1行に1つ';
        dialog.append(rulesHeading, entryHint);
        const emojiLabel = document.createElement('label');
        emojiLabel.style.cssText = 'display:block;margin:16px 0;';
        const emojiInput = document.createElement('input');
        emojiInput.type = 'checkbox';
        emojiInput.checked = settings.emoji;
        emojiInput.style.cssText = 'all:initial !important;appearance:auto !important;-webkit-appearance:checkbox !important;display:inline-block !important;position:static !important;visibility:visible !important;opacity:1 !important;width:24px !important;height:24px !important;margin:0 10px 0 0 !important;vertical-align:middle !important;clip:auto !important;clip-path:none !important;transform:none !important;pointer-events:auto !important;accent-color:#1159b5 !important;';
        const emojiText = document.createElement('span');
        emojiText.textContent = '絵文字を自動であぼーんする';
        emojiLabel.append(emojiInput, emojiText);
        dialog.append(emojiLabel);
        for (const [key, labelText] of categories) {
            const toggleLabel = emojiLabel.cloneNode(true);
            const toggle = toggleLabel.querySelector('input');
            toggle.checked = settings.enabled[key];
            const caption = toggleLabel.querySelector('span');
            caption.textContent = labelText;
            caption.id = 'abon-category-' + key;
            toggle.setAttribute('aria-label', labelText + 'の判定');
            dialog.append(toggleLabel);
            categoryInputs[key] = toggle;
            const input = document.createElement('textarea');
            input.rows = 3;
            input.style.cssText = inputStyle;
            input.value = settings[key].join('\n');
            input.setAttribute('aria-labelledby', caption.id);
            dialog.append(input);
            addExpandButton(dialog, input);
            inputs[key] = input;
        }
        const checkHeading = document.createElement('h3');
        if (globalThis.matchMedia?.('(max-width: 600px)').matches) checkHeading.style.setProperty('margin-top', '24px', 'important');
        checkHeading.textContent = '設定したルールのチェック';
        const check = makeButton('ルールのチェック');
        const checkHelp = document.createElement('p');
        checkHelp.textContent = '「ワード」「顔文字」「記号」に絵文字が含まれている行と、同じ欄の中で重複している入力を確認します。';
        dialog.append(checkHeading, checkHelp);
        const report = document.createElement('div');
        report.setAttribute('aria-live', 'polite');
        function capture() {
            drafts[selected] = Object.fromEntries(keys.map(key => [key,
                parseLines(inputs[key].value)]));
            drafts[selected].emoji = emojiInput.checked;
            drafts[selected].enabled = Object.fromEntries(categories.map(([key]) => [key, categoryInputs[key].checked]));
            drafts[selected].blank = displayInput.value === 'blank';
        }
        function refreshChooser() {
            chooser.replaceChildren();
            drafts.forEach((profile, index) => {
                const option = document.createElement('option');
                option.value = String(index);
                option.textContent = (index + 1) + '：' + (profile.titles.join(' / ') || 'タイトル未設定');
                chooser.append(option);
            });
            chooser.value = String(selected);
        }
        function showSelected() {
            emojiInput.checked = drafts[selected].emoji;
            for (const [key] of categories) categoryInputs[key].checked = drafts[selected].enabled[key];
            displayInput.value = drafts[selected].blank ? 'blank' : 'label';
            for (const key of keys) inputs[key].value = drafts[selected][key].join('\n');
            report.replaceChildren();
            refreshChooser();
        }
        chooser.addEventListener('change', () => {
            const index = Number(chooser.value);
            capture();
            selected = index;
            showSelected();
        });
        add.addEventListener('click', () => {
            capture();
            drafts.push(normalize({}));
            selected = drafts.length - 1;
            showSelected();
        });
        drop.addEventListener('click', () => {
            if (!confirm('このルールを削除しますか？ 最後に保存すると反映されます。')) return;
            drafts.splice(selected, 1);
            if (!drafts.length) drafts.push(normalize({}));
            selected = Math.min(selected, drafts.length - 1);
            showSelected();
        });
        titleInput.addEventListener('input', () => { capture(); refreshChooser(); });
        refreshChooser();

        check.addEventListener('click', () => {
            report.replaceChildren();
            const findings = [];
            for (const [key, label] of categories) {
                const seen = new Map();
                inputs[key].value.split(/\r?\n/).forEach((line, index) => {
                    const term = line.trim();
                    if (!term) return;
                    const lineNumber = index + 1;
                    const normalized = key === 'words' ? normalizeWord(term) : term;
                    if (emojiRegex.test(term)) findings.push(label + ' ' + lineNumber + '行目（絵文字）：' + term);
                    if (seen.has(normalized)) {
                        findings.push(label + ' ' + lineNumber + '行目（' + seen.get(normalized) + '行目と重複）：' + term);
                    } else {
                        seen.set(normalized, lineNumber);
                    }
                });
            }
            const message = document.createElement('p');
            message.textContent = findings.length
                ? '確認結果 ' + findings.length + '件。' + (emojiInput.checked ? '絵文字を含む本文は自動判定でも非表示になります。' : '')
                : '絵文字を含む行や重複した入力はありません。';
            report.append(message);
            if (!findings.length) return;
            const list = document.createElement('ul');
            for (const finding of findings) {
                const item = document.createElement('li');
                item.textContent = finding;
                item.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;';
                list.append(item);
            }
            report.append(list);
        });
        for (const [key] of categories) {
            inputs[key].addEventListener('input', () => report.replaceChildren());
        }
        emojiInput.addEventListener('change', () => report.replaceChildren());
        dialog.append(check, report);
        const formActions = document.createElement('div');
        formActions.style.cssText = 'display:block;margin-top:20px;';
        const save = makeButton('保存してページを読み直す', 'font:inherit;padding:12px;margin:6px;');
        save.addEventListener('click', () => {
            capture();
            GM_setValue(storageKey, {profiles: drafts.map(normalize)});
            location.reload();
        });
        const cancel = makeButton('キャンセル', 'font:inherit;padding:12px;margin:6px;');
        cancel.addEventListener('click', () => dialog.close());
        dialog.addEventListener('close', () => dialog.remove());
        const reset = makeButton('保存設定を削除して初期状態に戻す', 'display:block;font:inherit;padding:12px;margin:18px 6px 6px;');
        reset.addEventListener('click', () => {
            if (!confirm('すべてのスレッドの保存設定と、保存前の入力内容を破棄して、初期設定に戻しますか？\n絵文字の自動判定：ON\n対象タイトル：大番会館 新宿店\nワード・顔文字・記号の判定：すべてON\nワード：朱なみ、アカナミ、戌\n顔文字：(*^-^)、(・・?\n記号：♪\nこの操作は取り消せません。ページを読み直します。')) return;
            GM_deleteValue(storageKey);
            location.reload();
        });
        formActions.append(save, cancel, reset);
        dialog.append(formActions);
        document.body.append(dialog);
        dialog.showModal();
    }
    GM_registerMenuCommand('あぼーんの設定（ワード・顔文字・記号）', openSettings);
    // 拡張機能メニューに項目が出ない端末でも、ページから設定を開けるようにする。
    if (document.body && !document.getElementById('abon-open-settings')) {
        const settingsButton = document.createElement('button');
        settingsButton.id = 'abon-open-settings';
        settingsButton.type = 'button';
        settingsButton.textContent = 'あぼーん設定';
        settingsButton.setAttribute('aria-label', 'あぼーんの設定を開く');
        settingsButton.style.cssText = 'all:initial !important;display:block !important;position:fixed !important;right:10px !important;left:auto !important;top:calc(env(safe-area-inset-top, 0px) + 12px) !important;bottom:auto !important;z-index:2147483647 !important;visibility:visible !important;opacity:1 !important;background:#1159b5 !important;color:#fff !important;border:2px solid #fff !important;border-radius:10px !important;padding:12px 14px !important;font:16px/1.5 sans-serif !important;cursor:pointer !important;pointer-events:auto !important;';
        settingsButton.addEventListener('click', openSettings);
        document.body.append(settingsButton);
    }
    const heading = document.querySelector('h1')?.textContent || '';
    const active = profiles.filter(profile => profile.titles.some(title =>
        document.title.includes(title) || heading.includes(title)));
    if (!active.length) return;
    const hideEmoji = active.some(profile => profile.emoji);
    const blankDisplay = active.every(profile => profile.blank);
    const wordTerms = [...new Set(active.filter(profile => profile.enabled.words).flatMap(profile => profile.words).map(normalizeWord))];
    const exactTerms = [...new Set(active.flatMap(profile => ['faces', 'symbols'].flatMap(key => profile.enabled[key] ? profile[key] : [])))];
    const checked = new WeakMap();
    // 実際のレス本文だけを対象にする。スレッド説明・前スレ案内・操作欄は含めない。
    const bodySelector = '.res_list_article[id^="res"] .resbody[itemprop="commentText"], li.res_block[id^="res"] article .res_body[itemprop="commentText"]';
    const imageEmojiSelector = 'img[src*="/i/"], img[src*="emoji"], img[alt*="絵文字"]';
    function hideEmojiPosts() {
        const candidates = document.querySelectorAll(bodySelector);
        candidates.forEach(el => {
            if (el.closest('#abon-settings-dialog')) return;
            if (el.querySelector(bodySelector)) return;
            const text = el.textContent;
            const hasImageEmoji = el.querySelector(imageEmojiSelector) !== null;
            const signature = JSON.stringify([text, hasImageEmoji]);
            if (checked.get(el) === signature) return;
            const normalizedText = wordTerms.length ? normalizeWord(text) : '';
            if ((hideEmoji && (hasImageEmoji || emojiRegex.test(text))) ||
                exactTerms.some(term => text.includes(term)) ||
                wordTerms.some(term => normalizedText.includes(term))) {
                if (blankDisplay) {
                    el.replaceChildren();
                    checked.set(el, JSON.stringify(['', false]));
                    return;
                }
                // 元のノードを保持し、リンクや改行もそのまま一時表示する。
                const originalNodes = [...el.childNodes];
                const toggle = makeButton('あぼーん', 'all:initial !important;display:inline-block !important;color:#777 !important;background:transparent !important;border:0 !important;padding:4px 0 !important;font:inherit !important;text-decoration:underline !important;cursor:pointer !important;');
                toggle.setAttribute('aria-label', '隠した本文を一時表示');
                let revealed = false;
                toggle.setAttribute('aria-expanded', 'false');
                toggle.title = '押すと本文を一時表示します';
                const remember = () => checked.set(el, JSON.stringify([
                    el.textContent, el.querySelector(imageEmojiSelector) !== null
                ]));
                toggle.addEventListener('click', () => {
                    revealed = !revealed;
                    toggle.textContent = revealed ? '本文を隠す' : 'あぼーん';
                    toggle.setAttribute('aria-label', revealed ? '本文を隠す' : '隠した本文を一時表示');
                    toggle.setAttribute('aria-expanded', String(revealed));
                    toggle.title = revealed ? '押すと本文を隠します' : '押すと本文を一時表示します';
                    el.replaceChildren(toggle, ...(revealed ? originalNodes : []));
                    if (revealed) toggle.after(document.createElement('br'));
                    // 自分で表示した本文を監視処理が再び隠さないようにする。
                    remember();
                });
                el.replaceChildren(toggle);
                remember();
            } else {
                checked.set(el, signature);
            }
        });
    }
    let scheduled = false;
    const observer = new MutationObserver(records => {
        // 設定画面の入力や表示更新では、掲示板の本文を再走査しない。
        const pageChanged = records.some(record => {
            const element = record.target.nodeType === 1 ? record.target : record.target.parentElement;
            return !element?.closest('#abon-settings-dialog, #abon-open-settings');
        });
        if (!pageChanged || scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            // 自分で「あぼーん」に置き換えた変更を、再検査の原因にしない。
            observer.disconnect();
            try { hideEmojiPosts(); }
            finally { observer.observe(document.body, observeOptions); }
        });
    });
    const observeOptions = { childList: true, subtree: true, characterData: true };
    hideEmojiPosts();
    if (document.body) observer.observe(document.body, observeOptions);
})();










