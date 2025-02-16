import {
    $,
    $$,
    Util,
    Trigger,
    Create,
} from './components.js';


{
    const snapShotContainer = Util.elementize(/*html*/`
        <snap-shot-container></snap-shot-container>
    `);
    $('main').append(snapShotContainer);

    Util.addStyleRules(/*css*/`
        main:has(>:not(snap-shot-container):hover)>snap-shot-container {
            pointer-events: none;
        }
    `);
    const snapShotSettingsList = {};

    Object.assign(snapShotContainer, {
        onMainJsonLoaded(json) {
            Object.assign(snapShotSettingsList, json.snapShots);

            const snapShot = Create.snapShot(snapShotSettingsList[0]);
            snapShotContainer.append(snapShot);
        },
    });
}


{
    const characterView = Create.UIView('character-view', 'Character');
    $('main').append(characterView);

    Util.addStyleRules(/*css*/`
        #character-view {
            top: 10px;
            height: 150px;
            background-color: var(--view-background-color);
        }
        @media (height < 480px) or (width < 630px) {
            #character-view {
                top: 5px;
                height: 135px;
            }
        }
        character-gears {
            display: flex;
            justify-content: space-around;
            align-items: center;
            margin-inline: 30px;
            height: 100%;
        }
        @media (height < 480px) or (width < 630px) {
            character-gears {
                character-outfit {
                    margin: -20px -10px -10px -5px;
                }
            }
        }
        @media (width < 630px) {
            character-gears {
                display: grid;
                width: 320px;
                max-width: calc(100% - 20px);
                margin: auto;

                character-outfit {
                    grid-row: 1 / 3;
                    margin: -20px;
                }
                item-slot:nth-last-child(-n+4) {
                    grid-row: 2;
                }
            }
        }
    `);

    const characterGears = Util.elementize(/*html*/`
        <character-gears></character-gears>`
    );
    characterView.innerSpace.append(characterGears);

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
        onItemDrop(item) {
            location.hash = item.closest('a')?.getAttribute('href') || location.hash;
        },
    });
    characterView.outfit = Create.characterOutfit();
    characterGears.append(characterView.outfit);

    Object.assign(characterGears, {
        onMainJsonLoaded(json) {
            for (const gearType of Object.keys(characterView.gears)) {
                const icon = Create.itemSlot({
                    gearSlotImageSrc: json.globalImages[gearType],
                });
                icon.id = gearType;
                characterGears.append(icon);
                characterView.gears[gearType] = icon;
            }
        },

        onOutfitJsonLoaded(json) {
            for (const itemSlot of $$('item-slot', characterGears)) {
                const gearName = json.character[itemSlot.id];
                const itemImages = json.items[gearName];
                itemSlot.redrawAsync(itemImages?.icon, itemImages?.popUp);
            }
            characterView.outfit.replace(`/images/character/${ json.filename }.webp`);
            characterView.hidden = false;
        },
    });
}


{
    const messageView = Create.UIView('message-view', 'Message');
    $('main').append(messageView);

    Util.addStyleRules(/*css*/`
        #message-view {
            top: 180px;
            height: calc(100% - 200px);

            >article {
                margin: 10px;
            }
        }
        @media (height < 480px) or (width < 630px) {
            #message-view {
                top: 150px;
                height: calc(100% - 160px);

                >article {
                    margin: 0 5px 5px;
                }
            }
        }

        #message-view tab-list {
            padding-inline: var(--view-radius);
            height: 33px;
            display: flex;
            justify-content: flex-start;
            align-items: flex-end;
            -webkit-user-select: none;
            user-select: none;
            position: relative;

            tab-item:not(#message-info-tab) {
                padding: 2px 10px 0;
                border-radius: var(--view-radius) var(--view-radius) 0 0;
                margin-right: 10px;
                background-color: var(--scroll-bar-track-color);
                color: var(--view-background-color);
                font-weight: bold;

                &[aria-selected="true"] {
                    background-color: var(--view-border-color);
                }
            }
            #message-info-tab {
                position: absolute;
                right: 10px;
                bottom: 0;
                width: 30px;
                height: 30px;
                font-size: 0;
                background-image: url("data:image/svg+xml;charset=utf-8,<svg viewBox='-50 -50 100 100' xmlns='http://www.w3.org/2000/svg'><circle fill='white' r='50' cx='0' cy='0'></circle><circle fill='rgb(232,113,53)' r='44' cx='0' cy='0'></circle><circle fill='white' r='35' cx='0' cy='0'></circle><rect fill='rgb(32,43,96)' x='-11' y='-30' width='22' height='58'></rect><rect fill='white' x='-12' y='-18' width='24' height='6'></rect></svg>");

                &[aria-selected="true"] {
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

        #message-view tab-panels {
            position: relative;

            scroll-pages {
                border: 3px solid var(--view-border-color);

                scroll-page {
                    padding: 10px;
                    padding-right: calc(var(--scroll-bar-entire-width) + 6px);
                }
            }

            #message-character-tab-panel {
                scroll-page {
                    display: grid;
                    gap: .5em;
                }
                item-slot:has(.equipped)::before {
                    border-style: dashed;
                }
            }
        }
    `);

    messageView.innerSpace.classList.add('fixed-header-container');
    messageView.innerSpace.innerHTML = /*html*/`
        <tab-list role="tablist"></tab-list>
        <tab-panels></tab-panels>
    `;

    const tabSets = {
        outfit: {
            tabText: 'コーデ',
            tab: null,
            tabPanel: null,
        },
        character: {
            tabText: 'キャラ',
            tab: null,
            tabPanel: null,
        },
        info: {
            tabText: 'インフォ',
            tab: null,
            tabPanel: null,
        },
    };
    Object.assign(messageView, tabSets);

    for (const tabName of Object.keys(tabSets)) {
        const tab = Util.elementize(/*html*/`<tab-item></tab-item>`);
        Object.assign(tab, {
            id: `message-${ tabName }-tab`,
            role: 'tab',
            textContent: messageView[tabName].tabText,
            ariaSelected: false,
        });

        const tabPanel = Create.scrollSection();
        Object.assign(tabPanel, {
            id: `message-${ tabName }-tab-panel`,
            role: 'tabpanel',
            hidden: true,
        });

        tab.setAttribute('aria-controls', tabPanel.id);
        tabPanel.setAttribute('aria-labelledby', tab.id);

        $('tab-list', messageView).append(tab);
        $('tab-panels', messageView).append(tabPanel);
        Object.assign(messageView[tabName], { tab, tabPanel });
    }

    Object.assign(messageView.outfit.tabPanel, {
        onMainJsonLoaded(json) {
            const fragment = new DocumentFragment();
            for (const character of json.characters) {
                const details = character.details;
                if (!details.thumbnail) continue;

                details.itemSlots = character.outfitList.map(outfit => {
                    return Create.itemSlot({
                        itemImageSrc: json.globalImages[outfit.thumbnail],
                        isFramed: true,
                        href: outfit.filename,
                    });
                });
                fragment.append(Create.characterSlot(details));
            }
            messageView.character.tabPanel.replaceChildren(...fragment.children);
        },
        onOutfitJsonLoaded(json) {
            messageView.outfit.tabPanel.overwrite(json.articles.message, json);
        },
    });


    const switchTabPanel = (clickedTab) => {
        const selectedTab = $('[aria-selected="true"]', messageView);
        selectedTab?.setAttribute('aria-selected', 'false');

        const activeTabPanel = $('[role="tabpanel"]:not([hidden])', messageView);
        activeTabPanel?.setAttribute('hidden', '');

        clickedTab ??= $(localStorage.messageTabId) ?? messageView.info.tab;
        clickedTab.setAttribute('aria-selected', 'true');
        localStorage.messageTabId = '#' + clickedTab.id;

        const tabPanelId = '#' + clickedTab.getAttribute('aria-controls');
        $(tabPanelId).removeAttribute('hidden');
    };

    for (const tab of $$('tab-list tab-item', messageView)) {
        Object.assign(tab, {
            onDragStart() {
                switchTabPanel(tab);
            },
        });
    }

    Object.assign(messageView.character.tabPanel, {
        onMainJsonLoaded(json) {
            messageView.info.tabPanel.overwrite(json.articles['message-info'], json);
            switchTabPanel();
        },

        onOutfitJsonLoaded(json) {
            const tab = messageView.character.tabPanel;
            $('.equipped', tab)?.classList.remove('equipped');
            $(`[href="#${ json.filename }"] item-icon`, tab).classList.add('equipped');
            messageView.hidden = false;
        },

        onDragEnd(event, isDragMoved) {
            if (isDragMoved) {
                return;
            }
            if (event.target.matches('.equipped')) {
                switchTabPanel(messageView.outfit.tab);
            } else if (event.target.matches('a item-icon')) {
                location.hash = event.target.closest('a').getAttribute('href');
            }
        },
    });

    Object.assign($('tab-panels', messageView), {
        onSwipeX(swipeDelta) {
            const selectedTab = $('tab-list [aria-selected="true"]', messageView);
            const newTab = swipeDelta > 0
                ? (selectedTab.previousElementSibling ?? selectedTab.parentElement.lastChild)
                : (selectedTab.nextElementSibling ?? selectedTab.parentElement.firstChild);
            switchTabPanel(newTab);
        },
    });
}


{
    const favicon = document.createElement('link');
    Object.assign(favicon, {
        rel: 'shortcut icon',
        onOutfitJsonLoaded(json) {
            favicon.href = json.items[json.thumbnail].icon;
        },
    });
    $('head').append(favicon);
}


{
    const overlay404 = Create.UIView('overlay-404', '404 Not Found', true);

    Util.addStyleRules(/*css*/`
        #overlay-404 {
            width: 450px;
            max-width: calc(100% - 30px);
            top: 50%;
            transform: translateY(-50%);

            article {
                margin: 10px;
            }
            div {
                text-align: left;
                display: inline-block;
                margin-bottom: 5px;

                time {
                    padding-inline: 0.5em;
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
        @media (width < 630px) {
            #overlay-404 {
                br {
                    display: none;
                }
            }
        }
        body:has(#overlay-404:not([hidden])) main {
            filter: brightness(0.5);
            pointer-events: none;
            -webkit-user-select: none;
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
    const close = () => {
        clearInterval(countdownTimer);
        countdownTimer = null;
        overlay404.hidden = true;
    };

    const open = () => {
        if (countdownTimer) {
            close();
            open();
            return;
        }
        const timeDisplay = $('time', overlay404);
        let countdown = 9;

        overlay404.hidden = false;
        timeDisplay.textContent = '00:0' + countdown;

        countdownTimer = setInterval(() => {
            countdown--;
            if (countdown < 1) {
                close();
                return;
            }
            timeDisplay.textContent = '00:0' + countdown;
        }, 1000);
    };

    Object.assign($('button', overlay404), {
        onDragEnd: close,
    });

    Object.assign(overlay404, {
        onNotFound: open,
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

        const outfitJson = await fetchJsonOrNullAsync(newName);
        if (outfitJson === null) {
            console.error(`Failed to fetch ${ newName }.json due to previous error.`);
            Trigger.onNotFound();
            return null;
        }

        outfitJsonName = newName;
        localStorage.lastViewedOutfit = outfitJsonName;
        return outfitJson;
    };


    const [mainJson, outfitJson] = await Promise.all([
        fetchJsonOrNullAsync('main'),
        (async () => await fetchOutfitJsonOrNullAsync() ?? await fetchOutfitJsonOrNullAsync(true))(),
    ]);
    if (!mainJson || !outfitJson) {
        throw new Error('Failed to fetch the default JSON file.');
    }

    Trigger.onMainJsonLoaded(mainJson);
    Trigger.onOutfitJsonLoaded(outfitJson);

    window.addEventListener('hashchange', async () => {
        history.replaceState(null, '', '/' + location.hash);
        const outfitJson = await fetchOutfitJsonOrNullAsync();
        if (outfitJson) {
            Trigger.onOutfitJsonLoaded(outfitJson);
        }
    });
}
