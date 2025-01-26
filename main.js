import {
    $,
    $$,
    Util,
    Trigger,
    Create,
} from './components.js';


{
    const characterView = Create.view('character-view', 'Character');
    $('main').append(characterView);

    Util.addStyleRules(/*css*/`
        #character-view {
            top: 10px;
            height: 150px;
            width: var(--main-view-width);
            background-color: var(--view-background-color);
        }
        @media (height < 480px) {
            #character-view {
                top: 5px;
                height: 135px;
            }
        }
        #character-gears {
            display: flex;
            justify-content: space-around;
            align-items: center;
            margin: 0 30px;
            height: 100%;
        }
        @media (height < 480px) {
            #character-gears {
                .outfit {
                    margin: -20px -10px -10px -5px;
                }
            }
        }
        @media (width < 540px) {
            #character-gears {
                display: grid;
                width: 320px;
                max-width: calc(100% - 20px);
                margin: auto;

                .outfit {
                    grid-row: 1 / 3;
                    margin: -20px;
                }
                .item-slot:nth-last-child(-n+4) {
                    grid-row: 2;
                }
            }
        }
    `);

    characterView.innerSpace.innerHTML = /*html*/`
        <div id="character-gears"></div>
    `;
    Object.assign(characterView, {
        outfit: null,
        gears: {
            arms: null,
            shield: null,
            head: null,
            back: null,
            clothes: null,
            neck: null,
            hand: null,
            boots: null,
        },
    });

    const characterGears = $('#character-gears');
    characterView.outfit = Create.outfit('');
    characterGears.append(characterView.outfit);

    Object.assign(characterGears, {
        onMainJsonLoaded(json) {
            const fragment = new DocumentFragment();
            for (const gearType of Object.keys(characterView.gears)) {
                const icon = Create.itemSlot({
                    gearSlotImageSrc: json.globalImages[gearType],
                });
                icon.id = gearType;
                fragment.append(icon);
                characterView.gears[gearType] = icon;
            }
            characterGears.append(fragment);
        },

        onOutfitJsonLoaded(json, name) {
            for (const itemSlot of $$('.item-slot', characterGears)) {
                const gearName = json.character[itemSlot.id];
                const base64Images = json.items[gearName];
                itemSlot.redraw(
                    base64Images?.icon || '',
                    base64Images?.popup || ''
                );
            }
            characterView.outfit.replace(`/images/character/${ name }.webp`);
            characterView.open();
        },

        onItemDrop(item) {
            location.hash = item.dataset.href ?? location.hash;
        },
    });
}


{
    const messageView = Create.view('message-view', 'Message');
    $('main').append(messageView);

    Util.addStyleRules(/*css*/`
        #message-view {
            top: 180px;
            width: var(--main-view-width);
            height: calc(100% - 200px);

            >section {
                margin: 10px;
            }
        }
        @media (height < 480px) {
            #message-view {
                top: 150px;
                height: calc(100% - 160px);

                >section {
                    margin: 0 10px 5px;
                }
            }
        }

        #message-tab-bar {
            padding: 10px var(--view-radius) 0;
            user-select: none;
            position: relative;

            li:not(:last-child) {
                padding: 2px 10px 0;
                border-radius: var(--view-radius) var(--view-radius) 0 0;
                margin-right: 10px;
                background-color: var(--scrollbar-track-color);
                color: var(--view-background-color);
                font-weight: bold;
                float: left;

                &.selected {
                    background-color: var(--view-border-color);
                }
            }
            #info-mark {
                position: absolute;
                right: 10px;
                bottom: 0;
                width: 30px;
                height: 30px;
                background-image: url("data:image/svg+xml;charset=utf-8,<svg viewBox='-50 -50 100 100' xmlns='http://www.w3.org/2000/svg'><circle fill='white' r='50' cx='0' cy='0'></circle><circle fill='rgb(232,113,53)' r='44' cx='0' cy='0'></circle><circle fill='white' r='35' cx='0' cy='0'></circle><rect fill='rgb(32,43,96)' x='-11' y='-30' width='22' height='58'></rect><rect fill='white' x='-12' y='-18' width='24' height='6'></rect></svg>");

                &.selected {
                    animation: floating .5s infinite linear;
                }
            }
        }
        @keyframes floating {
            0% {
                transform: translateY(-2px);
            }
            100% {
                transform: translateY(0);
            }
        }
        @media (height < 480px) {
            #message-tab-bar {
                padding-top: 7px;
            }
        }

        #message-tab-panels {
            position: relative;

            .scrollable-section:not(.selected) {
                visibility: hidden;
                position: absolute;
            }
            .scrollable {
                border: 3px solid var(--view-border-color);

                >.page {
                    padding: 10px;
                    padding-right: calc(var(--scrollbar-entire-width) + 6px);
                }
            }
        }

        #message-character-tab-panel {
            .page.active {
                display: grid;
                gap: .5em;
            }
            .item-slot:has(.equipped)::before {
                border-style: dashed;
            }
        }
    `);

    messageView.innerSpace.classList.add('fixed-header-container');
    messageView.innerSpace.innerHTML = /*html*/`
        <ul id="message-tab-bar">
            <li>コーデ</li>
            <li>キャラ</li>
            <li id="info-mark"></li>
        </ul>
        <div id="message-tab-panels">
        </div>
    `;

    Object.assign(messageView, {
        tabPanels: {
            outfit: null,
            character: null,
            info: null,
        }
    });

    const tabPanels = Object.keys(messageView.tabPanels).map((tabName) => {
        const tabPanel = Create.scrollableSection();
        tabPanel.id = `message-${ tabName }-tab-panel`;
        messageView.tabPanels[tabName] = tabPanel;
        return tabPanel;
    });
    $('#message-tab-panels').append(...tabPanels);

    Object.assign(messageView.tabPanels.outfit, {
        onMainJsonLoaded(json) {
            const fragment = new DocumentFragment();
            for (const character of json.characters) {
                const details = character.details;
                if (!details.thumbnail) continue;

                details.itemSlots = character.outfitList.map(outfit => {
                    const itemSlot = Create.itemSlot({
                        itemImageSrc: json.globalImages[outfit.thumbnail],
                        isFramed: true,
                    });
                    $('canvas', itemSlot).dataset.href = outfit.json;
                    return itemSlot;
                });
                fragment.append(Create.characterSlot(details));
            }
            messageView.tabPanels.character.replaceChildren(...fragment.children);
        },
        onOutfitJsonLoaded(json) {
            messageView.tabPanels.outfit.overwrite(json.articles.message, json);
        },
    });


    const switchTabPanel = ({ clickedTab = null, index = null } = {}) => {
        const tabs = $$('#message-tab-bar li');
        const tabPanels = Object.values(messageView.tabPanels);
        [...tabs, ...tabPanels].forEach(element => element.classList.remove('selected'));

        index ??= (clickedTab === null)
            ? +localStorage.messageViewTabIndex
            : tabs.findIndex(tab => tab === clickedTab);
        index = tabs[index] ? index : tabs.length - 1;

        tabs[index].classList.add('selected');
        tabPanels[index].classList.add('selected');
        localStorage.messageViewTabIndex = index;
    };

    for (const tab of $$('#message-tab-bar li')) {
        Object.assign(tab, {
            onDragStart() {
                switchTabPanel({ clickedTab: tab });
            },
        });
    }

    Object.assign(messageView.tabPanels.character, {
        onMainJsonLoaded(json) {
            messageView.tabPanels.info.overwrite(json.articles['message-info'], json);
            switchTabPanel();
        },
        onOutfitJsonLoaded(json, name) {
            $('.equipped', messageView.tabPanels.character)?.classList?.remove?.('equipped');
            $(`[data-href="${ name }"]`, messageView.tabPanels.character).classList.add('equipped');
            messageView.open();
        },
        shouldCaptureBubblingDragEvent: true,

        onDragEnd(event, hasDragMoved) {
            if (hasDragMoved) {
                return;
            }
            if (event.target.matches('.equipped')) {
                switchTabPanel({ index: 0 });
            } else if (event.target.matches('[data-href]')) {
                location.hash = event.target.dataset.href;
            }
        },
    });
}


{
    const favicon = document.createElement('link');
    Object.assign(favicon, {
        rel: 'shortcut icon',
        onOutfitJsonLoaded(json) {
            favicon.href = json.items[json.character.clothes].icon;
        },
    });
    $('head').append(favicon);
}


{
    const overlay404 = Create.view('overlay-404', '404 Not Found', true);

    Util.addStyleRules(/*css*/`
        #overlay-404 {
            width: 450px;
            max-width: calc(100% - 30px);
            top: 50%;
            transform: translateY(-50%);

            section {
                margin: 10px;
            }
            div {
                text-align: left;
                display: inline-block;
                margin-bottom: 5px;

                time {
                    padding: 0 0.5em;
                }
            }
            button {
                float: right;
                position: relative;
                width: 70px;
                height: 25px;
                margin-right: 0.5em;
                zoom: 1.2;

                &::before,
                &::after {
                    background-image: url(/images/misc/ok.png);
                    content: '';
                    position: absolute;
                    width: 67px;
                    height: 22px;
                }
                &::before {
                    top: 3px;
                    left: 3px;
                    filter: contrast(0)brightness(1.2);
                    image-rendering: pixelated;
                }
                &::after {
                    top: 1px;
                    left: 1px;
                }
                &:hover:not(:active)::after {
                    top: 0;
                    left: 0;
                }
                &:active::after {
                    background-image: url(/images/misc/ok-active.png);
                }
            }
        }
        @media (width < 540px) {
            #overlay-404 {
                br {
                    display: none;
                }
            }
        }
        body:has(#overlay-404:not(.closed)) main {
            filter: brightness(0.5);
            pointer-events: none;
            user-select: none;
        }
        main {
            transition: filter ease-in-out 0.5s;
        }
    `);

    overlay404.innerSpace.innerHTML = /*html*/`
        <div>
            あと<time>00:09</time>で自動的に閉じます。<br
            >すぐに閉じる場合はＯＫボタンを押してください。
        </div>
        <hr>
        <button type="button">ＯＫ</button>
    `;

    let countdownTimer;
    const hide = () => {
        clearInterval(countdownTimer);
        countdownTimer = null;
        overlay404.close();
    };

    const show = () => {
        if (countdownTimer) {
            hide();
            show();
            return;
        }
        const timeDisplay = $('time', overlay404);
        let countdown = 9;

        overlay404.open();
        timeDisplay.textContent = '00:0' + countdown;

        countdownTimer = setInterval(() => {
            countdown--;
            if (countdown < 1) {
                hide();
                return;
            }
            timeDisplay.textContent = '00:0' + countdown;
        }, 1000);
    };

    Object.assign($('button', overlay404), {
        onDragEnd: hide,
    });

    Object.assign(overlay404, {
        onNotFound: show,
    });
    $('body').append(overlay404);
}




const fetchJsonOrNullAsync = async (jsonFileName) => {
    try {
        const response = await fetch(`/json/${ jsonFileName }.json`);
        if (response.ok) {
            return await response.json();
        }
        throw new Error(response.statusText + ': ' + response.url);
    } catch (error) {
        console.error('Failed to fetch JSON:', error);
    }
    return null;
};


if (location.hash.startsWith('#404')) {
    const urlParams = new URLSearchParams(location.hash.split('?')[1]);
    const originalPath = urlParams.get('path');

    if (originalPath) {
        history.replaceState(null, '', originalPath);
        Trigger.onNotFound();
    }
}

{
    let outfitJsonName = null;
    const fetchOutfitJsonOrNullAsync = async (forceDefault = false) => {
        const defaultName = 'hapinesuwanpi';
        const newName = forceDefault
            ? defaultName
            : (location.hash.slice(1) || localStorage.lastViewedOutfit || defaultName);

        if (outfitJsonName === newName) {
            return null;
        }
        const outfitJsonOrNull = await fetchJsonOrNullAsync(newName);
        if (outfitJsonOrNull === null) {
            console.error(`Failed to fetch ${ newName }.json due to previous error.`);
            Trigger.onNotFound();
            return null;
        }
        outfitJsonName = newName;
        localStorage.lastViewedOutfit = outfitJsonName;
        return outfitJsonOrNull;
    };

    const [mainJsonOrNull, outfitJsonOrNull] = await Promise.all([
        fetchJsonOrNullAsync('main'),
        (async () => await fetchOutfitJsonOrNullAsync() ?? await fetchOutfitJsonOrNullAsync(true))(),
    ]);
    if (!mainJsonOrNull || !outfitJsonOrNull) {
        throw new Error('Failed to fetch the default JSON file.');
    }
    Trigger.onMainJsonLoaded(mainJsonOrNull);
    Trigger.onOutfitJsonLoaded(outfitJsonOrNull, outfitJsonName);

    window.addEventListener('hashchange', async () => {
        history.replaceState(null, '', '/' + location.hash);
        const jsonOrNull = await fetchOutfitJsonOrNullAsync();
        if (jsonOrNull) {
            Trigger.onOutfitJsonLoaded(jsonOrNull, outfitJsonName);
        }
    });
}



{
    const background = $('#background');
    const images = {
        '/images/background/hapinesuwanpi-sitting.webp': {
            left: 345,
            top: -150,
            sitting: true,
        },
        '/images/character/yuruusapa-ka-momo.webp': {
            left: -360,
            top: 50,
            reverse: true,
        },
        '/images/background/tsukiyononaitoweashiro-fainting.webp': {
            left: -450,
            top: -100,
            reverse: true,
            sitting: true,
        },
        '/images/background/wabijinnadeshiko-preparing.webp': {
            left: 410,
            top: -10,
            reverse: true,
            attacking: true,
        },
        '/images/background/training-barrel.webp': {
            left: 460,
            top: -4,
            visible: true,
        },
    };

    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            entry.target.style.visibility = entry.isIntersecting ? '' : 'hidden';
        }
    }, {
        root: background,
        rootMargin: '20px 20px 20px 0px',
        threshold: 0.6,
    });

    for (const [path, option] of Object.entries(images)) {
        const outfit = Create.outfit(path, !!option.reverse, !!option.sitting, !!option.attacking);

        if (!option.visible) {
            observer.observe(outfit);
        }
        outfit.style.inset = `
            ${ option.top }px
            ${ -option.left }px
            ${ -option.top }px
            ${ option.left }px
        `;
        background.append(outfit);
    }
}