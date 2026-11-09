// ==UserScript==
// @name         爆サイの荒らしレスをあぼーん
// @namespace    http://tampermonkey.net/
// @author       xigfu
// @version      1.28
// @updateURL    https://xigfu.github.io/bakusai-abon/emoji-abon.user.js
// @downloadURL  https://xigfu.github.io/bakusai-abon/emoji-abon.user.js
// @description  指定したタイトルのスレッドで、絵文字や設定した言葉・顔文字・記号を含む本文を「あぼーん」にします。
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
        words: ['朱なみ', 'アカナミ'],
        faces: ['(*^-^)', '(・・?'],
        symbols: ['♪']
    };
    const storageKey = 'abon-settings-v1';
    const stored = GM_getValue(storageKey, {}) || {};
    const keys = ['titles', 'words', 'faces', 'symbols'];
    const clean = value => Array.isArray(value)
        ? [...new Set(value.filter(x => typeof x === 'string').map(x => x.trim()).filter(Boolean))] : [];
    const normalize = item => ({...Object.fromEntries(keys.map(key => [key, clean(item?.[key])])), emoji: item?.emoji !== false});
    const profiles = Array.isArray(stored.profiles)
        ? stored.profiles.map(normalize)
        : [normalize(defaults)];
    // 半角カタカナだけを全角化する。顔文字や他の互換文字は変換しない。
    const normalizeWord = text => text
        .replace(/[\uFF66-\uFF9F]+/g, part => part.normalize('NFKC'))
        .replace(/[A-Z]/g, letter => letter.toLowerCase());
    const emojiRegex = /\p{Extended_Pictographic}|\p{Emoji_Presentation}/u;
    const categories = [['words', '禁止ワード'], ['faces', '顔文字'], ['symbols', '記号']];
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
        dialog.append(title);
        const info = document.createElement('p');
        info.textContent = '1行に1個ずつ入力します。本文にどれか1個でも含まれると隠します。消したい項目は行ごと削除してください。絵文字の自動判定は下のチェックで切り替えられます。';
        dialog.append(info);
        const drafts = profiles.map(normalize);
        if (!drafts.length) drafts.push(normalize({}));
        let selected = 0;
        const settings = drafts[0];
        const chooserLabel = document.createElement('label');
        chooserLabel.textContent = '編集するスレッド設定';
        const chooser = document.createElement('select');
        chooser.style.cssText = 'box-sizing:border-box !important;display:block !important;width:100% !important;max-width:100% !important;min-width:0 !important;height:54px !important;min-height:54px !important;max-height:none !important;font:18px/1.5 sans-serif !important;padding:8px 32px 8px 10px !important;margin:8px 0 16px !important;border:2px solid #737d8c !important;border-radius:6px !important;color:#222 !important;background-color:#fff !important;appearance:auto !important;text-indent:0 !important;letter-spacing:normal !important;';
        chooserLabel.append(chooser);
        dialog.append(chooserLabel);
        const add = makeButton('別のスレッド設定を追加', 'font:inherit;padding:10px;margin:6px;');
        const drop = makeButton('選択中のスレッド設定を削除', 'font:inherit;padding:10px;margin:6px;');
        dialog.append(add, drop);
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
        const emojiHelp = document.createElement('p');
        emojiHelp.textContent = '選択中の設定に適用します。OFFでも、登録した言葉・顔文字・記号による判定は続きます。複数の設定に一致した場合、1つでもONなら絵文字を隠します。';
        dialog.append(emojiHelp);
        const inputs = {};
        const titleLabel = document.createElement('label');
        titleLabel.textContent = '対象スレッドのタイトル（1行に1つ）';
        titleLabel.style.display = 'block';
        const titleInput = document.createElement('textarea');
        titleInput.rows = 3;
        titleInput.style.cssText = inputStyle;
        titleInput.value = settings.titles.join('\n');
        titleLabel.append(titleInput);
        dialog.append(titleLabel);
        addExpandButton(dialog, titleInput);
        inputs.titles = titleInput;
        const titleHelp = document.createElement('p');
        titleHelp.textContent = 'タイトルまたは見出しに、指定した言葉のどれかを含むスレッドが対象です。この設定を空欄にすると、この設定は適用されません。複数の設定に一致した場合はルールを合わせて使います。対象外のスレッドでも、この設定画面は開けます。';
        dialog.append(titleHelp);
        for (const [key, labelText] of categories) {
            const label = document.createElement('label');
            label.textContent = labelText;
            label.style.display = 'block';
            const input = document.createElement('textarea');
            input.rows = 3;
            input.style.cssText = inputStyle;
            input.value = settings[key].join('\n');
            label.append(input);
            dialog.append(label);
            addExpandButton(dialog, input);
            inputs[key] = input;
        }
        const notice = document.createElement('p');
        notice.textContent = '禁止ワードはカタカナの全角・半角と英字の大文字・小文字を区別しません。ひらがなとカタカナは区別します。顔文字・記号は入力どおりに判定します。';
        dialog.append(notice);
        const check = document.createElement('button');
        check.textContent = '絵文字の自動判定と重複する登録を確認';
        check.type = 'button';
        check.style.cssText = 'font:inherit;padding:12px;margin:6px;';
        const report = document.createElement('div');
        report.setAttribute('aria-live', 'polite');
        function capture() {
            drafts[selected] = Object.fromEntries(keys.map(key => [key,
                parseLines(inputs[key].value)]));
            drafts[selected].emoji = emojiInput.checked;
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
            if (!confirm('選択中のスレッド設定を削除しますか？ 最後に保存すると反映されます。')) return;
            drafts.splice(selected, 1);
            if (!drafts.length) drafts.push(normalize({}));
            selected = Math.min(selected, drafts.length - 1);
            showSelected();
        });
        titleInput.addEventListener('input', () => { capture(); refreshChooser(); });
        refreshChooser();

        function findRedundant() {
            const result = [];
            for (const [key, label] of categories) {
                for (const term of parseLines(inputs[key].value)) {
                    if (emojiRegex.test(term)) result.push({key, label, term});
                }
            }
            return result;
        }
        check.addEventListener('click', () => {
            report.replaceChildren();
            if (!emojiInput.checked) {
                const message = document.createElement('p');
                message.textContent = 'この設定では絵文字の自動判定がOFFのため、登録の削除候補は表示しません。';
                report.append(message);
                return;
            }
            const matches = findRedundant();
            const message = document.createElement('p');
            message.textContent = matches.length
                ? matches.length + '件あります。これらを含む本文は絵文字の自動判定でも隠れるため、登録を削除しても結果は変わりません。'
                : '絵文字の自動判定と重複する登録はありません。';
            report.append(message);
            if (!matches.length) return;
            const list = document.createElement('ul');
            for (const match of matches) {
                const item = document.createElement('li');
                item.textContent = match.label + '：' + match.term;
                item.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;';
                list.append(item);
            }
            report.append(list);
            const remove = makeButton('この一覧の登録を入力欄から削除', 'font:inherit;padding:12px;margin:6px;');
            remove.addEventListener('click', () => {
                const current = findRedundant();
                // 確認後に入力を編集した場合は、一覧を更新してから再確認してもらう。
                if (!emojiInput.checked || JSON.stringify(current) !== JSON.stringify(matches)) {
                    check.click();
                    return;
                }
                if (!confirm('表示された' + matches.length + '件の登録を入力欄から削除しますか？ 設定への反映は最後の保存ボタンで行います。')) return;
                for (const key of ['words', 'faces', 'symbols']) {
                    inputs[key].value = inputs[key].value.split(/\r?\n/)
                        .filter(line => !emojiRegex.test(line.trim())).join('\n');
                }
                report.replaceChildren();
                const done = document.createElement('p');
                done.textContent = '入力欄から削除しました。内容を確認して「保存してページを読み直す」を押してください。キャンセルすれば保存されません。';
                report.append(done);
            });
            report.append(remove);
        });
        emojiInput.addEventListener('change', () => report.replaceChildren());
        dialog.append(check, report);
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
            if (!confirm('すべてのスレッドの保存設定と、保存前の入力内容を破棄して、初期設定に戻しますか？\n絵文字の自動判定：ON\n対象タイトル：大番会館 新宿店\n禁止ワード：朱なみ、アカナミ\n顔文字：(*^-^)、(・・?\n記号：♪\nこの操作は取り消せません。ページを読み直します。')) return;
            GM_deleteValue(storageKey);
            location.reload();
        });
        dialog.append(save, cancel, reset);
        document.body.append(dialog);
        dialog.showModal();
    }
    GM_registerMenuCommand('あぼーんの設定（言葉・顔文字・記号）', openSettings);
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
    const wordTerms = [...new Set(active.flatMap(profile => profile.words).map(normalizeWord))];
    const exactTerms = [...new Set(active.flatMap(profile => [...profile.faces, ...profile.symbols]))];
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
                // 元のノードを保持し、リンクや改行もそのまま一時表示する。
                const originalNodes = [...el.childNodes];
                const toggle = makeButton('あぼーん', 'all:initial !important;display:inline-block !important;color:#777 !important;background:transparent !important;border:0 !important;padding:4px 0 !important;font:inherit !important;text-decoration:underline !important;cursor:pointer !important;');
                let revealed = false;
                toggle.setAttribute('aria-expanded', 'false');
                toggle.title = '押すと本文を一時表示します';
                const remember = () => checked.set(el, JSON.stringify([
                    el.textContent, el.querySelector(imageEmojiSelector) !== null
                ]));
                toggle.addEventListener('click', () => {
                    revealed = !revealed;
                    toggle.textContent = revealed ? '本文を隠す' : 'あぼーん';
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










