const $ = (selectors, ancestor = document) => ancestor.querySelector(selectors);
const $$ = (selectors, ancestor = document) => [...ancestor.querySelectorAll(selectors)];
const px = (value) => `${ Math.trunc(value) }px`;

const Util = {
    clampNum(min, num, max) {
        return Math.min(Math.max(num, min), max);
    },

    elementize(html) {
        const template = document.createElement('template');
        template.innerHTML = html;
        $$('[class*="  "]', template.content).forEach(element => {
            element.className = [...element.classList.values()].join(' ');
        });
        return template.content.firstElementChild;
    },

    addStyleRules: (() => {
        const addedStyleRuleSet = new Set();
        return (styleText) => {
            if (addedStyleRuleSet.has(styleText)) {
                return;
            }
            $('style').textContent += styleText;
            addedStyleRuleSet.add(styleText);
        };
    })(),

    grabStart({
        event,
        target = event.target,
        left = event.pageX - target.offsetLeft,
        top = event.pageY - target.offsetTop,
    }) {
        target.grabStartLeft = left;
        target.grabStartTop = top;
        target.isHorizontallyCentered = target.matches('.horizontally-center');

        if (target.isHorizontallyCentered) {
            target.grabStartLeft += (target.offsetParent.offsetWidth - target.offsetWidth) / 2;
        }
    },

    grabMove({
        event,
        target = event.target,
    }) {
        const left = event.pageX - target.grabStartLeft;
        const top = event.pageY - target.grabStartTop;
        Object.assign(target.style, {
            left: px(left),
            top: px(top),
            right: target.isHorizontallyCentered ? px(-left) : null,
        });
    },

    clearChildrenPropsBeforeEmptying(element, isFirstCall = true) {
        if (!isFirstCall) {
            for (const propName of Object.keys(element)) {
                delete element[propName];
            }
        }
        for (const child of element.children) {
            Util.clearChildrenPropsBeforeEmptying(child, false);
        }
    },

    isAnyNodeSelected() {
        return getSelection().rangeCount > 0 && !getSelection().getRangeAt(0).collapsed;
    },

    preventEvent(event) {
        event.preventDefault();
        event.stopPropagation();
    },
};


HTMLCanvasElement.prototype.drawUnblurredImageAsync = async function(src) {
    const context = this.getContext('2d');
    if (!src) {
        context.clearRect(0, 0, this.width, this.height);
        this.__src = '';
        this.hidden = true;
        return;
    }
    if (this.__src === src) {
        return;
    }
    const image = new Image();
    image.src = src;
    await image.decode();

    this.style.width = px(image.width);
    this.style.height = px(image.height);

    const zoomScale = 2 ** 2;
    this.width = image.width * zoomScale;
    this.height = image.height * zoomScale;

    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, this.width, this.height);
    this.__src = src;
    this.hidden = false;
};

{
    const originalStopPropagation = Event.prototype.stopPropagation;
    Event.prototype.stopPropagation = function() {
        this.propagationStopped = true;
        originalStopPropagation.call(this);
    };
}



{
    const propagateDragEvent = (eventName, event, ...args) => {
        let ancestor = event.target;
        while (ancestor && !event.propagationStopped) {
            ancestor[eventName]?.(event, ...args);
            ancestor = ancestor.parentElement?.closest('.' + eventName);
        }
    };

    const isPrimaryPointer = (event) => {
        return (event.pointerType === 'mouse' && (event.button === 0 || event.buttons === 1))
            || (event.pointerType === 'touch' && event.isPrimary);
    };

    let isDragMoved = false;
    let isDragCancelled = false;
    let primaryPointerEvent = null;
    const activePointerIds = new Set();


    const pointerDown = (event) => {
        activePointerIds.add(event.pointerId);

        if (isDragCancelled || !isPrimaryPointer(event)) {
            cancelDrag();
            return;
        }
        if (event.target.onDragMove) {
            event.target.setPointerCapture(event.pointerId);
        }
        primaryPointerEvent = event;
        isDragMoved = false;

        getSelection().removeAllRanges();
        $('body').classList.add('animation-playing');
        propagateDragEvent('onDragStart', event);
    };


    const pointerMove = (event) => {
        if (isDragCancelled || primaryPointerEvent?.target !== event.target) {
            return;
        }
        if (!isPrimaryPointer(event)) {
            cancelDrag();
            return;
        }
        const minDragMoveDelta = 3;
        if (
            !isDragMoved
            && Math.abs(primaryPointerEvent.pageX - event.pageX) < minDragMoveDelta
            && Math.abs(primaryPointerEvent.pageY - event.pageY) < minDragMoveDelta
        ) {
            return;
        }

        event.target.onDragMove?.(event, isDragMoved);
        isDragMoved = true;
    };


    const canDragEnd = (event) => {
        $('body').addEventListener('animationiteration', () => {
            $('body').classList.remove('animation-playing');
        }, { once: true });

        if (event.pointerType === 'touch') {
            for (const eventName of ['mousedown', 'mouseup']) {
                document.addEventListener(eventName, Util.preventEvent, { once: true });
            }
        }
        if (Util.isAnyNodeSelected() || primaryPointerEvent.target !== event.target) {
            return false;
        }
        return true;
    };


    const pointerUp = (event) => {
        if (
            !activePointerIds.delete(event.pointerId)
            || isDragCancelled
            || !canDragEnd(event)
        ) {
            isDragCancelled = activePointerIds.size > 0;
            return;
        }
        propagateDragEvent('onDragEnd', event, isDragMoved);
        primaryPointerEvent = null;
    };


    const cancelDrag = () => {
        if (primaryPointerEvent && canDragEnd(primaryPointerEvent)) {
            propagateDragEvent('onDragCancel', primaryPointerEvent);
        }
        primaryPointerEvent = null;
        isDragCancelled = true;
    };


    document.addEventListener('pointerdown', pointerDown, { passive: true });
    document.addEventListener('pointermove', pointerMove, { passive: true });
    document.addEventListener('pointerup', pointerUp, { passive: true });
    document.addEventListener('pointercancel', pointerUp, { passive: true });
    document.addEventListener('dragstart', Util.preventEvent);
    document.addEventListener('click', (event) => {
        if (event.target.closest('a[href^="#"]')) {
            Util.preventEvent(event);
        }
    });
}


{
    Util.addStyleRules(/*css*/`
        .onDragMove,
        .onSwipeX,
        .onSwipeY {
            touch-action: pinch-zoom;
        }
    `);
    for (const customPropName of [
        'onDragStart',
        'onDragMove',
        'onDragEnd',
        'onSwipeX',
        'onSwipeY',
        'onWheelEnd',
        'onResizeEnd',
        'onItemDrop',
        'onMainJsonLoaded',
        'onOutfitJsonLoaded',
        'onNotFound',
    ]) {
        Object.defineProperty(HTMLElement.prototype, customPropName, {
            get() {
                return this[`__${ customPropName }`];
            },
            set(value) {
                if (!Object.hasOwn(this, `__${ customPropName }`)) {
                    this.classList.add(customPropName);

                    switch (customPropName) {
                    case 'onSwipeX':
                    case 'onSwipeY':
                        enableSwipe(this);
                        break;
                    case 'onResizeEnd':
                        resizeObserver.observe(this);
                        break;
                    }
                }
                this[`__${ customPropName }`] = value;
            },
        });
    }

    const enableSwipe = (swipeableElement) => {
        if (swipeableElement.onDragStart) {
            return;
        }
        let dragStartEvent = null;

        Object.assign(swipeableElement, {
            onDragStart(event) {
                dragStartEvent = event.pointerType === 'touch' ? event : null;
            },
            onDragEnd(event) {
                if (dragStartEvent === null) {
                    return;
                }
                const swipeDeltaX = event.pageX - dragStartEvent.pageX;
                const swipeDeltaY = event.pageY - dragStartEvent.pageY;
                dragStartEvent = null;

                if (Math.abs(swipeDeltaX) > Math.abs(swipeDeltaY)) {
                    const minSwipeDeltaX = 40;
                    if (Math.abs(swipeDeltaX) > minSwipeDeltaX) {
                        swipeableElement.onSwipeX?.(swipeDeltaX);
                    }
                    return;
                }
                const minSwipeDeltaY = 40;
                if (Math.abs(swipeDeltaY) > minSwipeDeltaY) {
                    swipeableElement.onSwipeY?.(swipeDeltaY);
                }
            },
        });
    };


    const waitForEnd = (callback, delayMs = 100) => {
        let debounceTimer = 0;
        return function() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => callback.apply(this, arguments), delayMs);
        };
    };

    const resizeObserver = new ResizeObserver(
        waitForEnd((entries) => {
            for (const entry of entries) {
                if (entry.target.matches('.resize-observer-initialized')) {
                    entry.target.onResizeEnd(entry);
                } else {
                    entry.target.classList.add('resize-observer-initialized');
                }
            }
        })
    );

    document.addEventListener('wheel',
        waitForEnd((event) => {
            const wheelDeltaThreshold = 10;
            if (Math.abs(event.deltaY) > wheelDeltaThreshold) {
                event.target.closest('.onWheelEnd')?.onWheelEnd(event);
            }
        }),
        { passive: true }
    );
}


const Trigger = {
    onItemDrop(pointerEvent) {
        const { pageX, pageY } = pointerEvent;
        const dropTarget = document.elementFromPoint(pageX, pageY);
        dropTarget.closest('.onItemDrop')?.onItemDrop(pointerEvent.target, dropTarget);
    },

    onMainJsonLoaded(json) {
        for (const element of $$('.onMainJsonLoaded')) {
            element.onMainJsonLoaded(json);
        }
    },

    onOutfitJsonLoaded(json, name) {
        for (const element of $$('.onOutfitJsonLoaded')) {
            element.onOutfitJsonLoaded(json, name);
        }
    },

    onNotFound() {
        for (const element of $$('.onNotFound')) {
            element.onNotFound();
        }
    },
};





const popUp = Util.elementize(/*html*/`
    <pop-up class="horizontally-center">
        <canvas hidden></canvas>
    </pop-up>
`);
$('main').append(popUp);

{
    Util.addStyleRules(/*css*/`
        pop-up {
            z-index: 9999999;
            position: absolute;

            canvas {
                display: block;
                pointer-events: none;
            }
        }
    `);

    const canvas = $('canvas', popUp);

    Object.assign(popUp, {
        onDragStart(event) {
            Util.grabStart({ event });
        },
        onDragMove(event) {
            Util.grabMove({ event });
        },

        onDragEnd(event, isDragMoved) {
            if (isDragMoved) {
                return;
            }
            if (event.offsetY <= 12 && popUp.offsetWidth - event.offsetX <= 16) {
                setTimeout(() => {
                    popUp.hidden = true;
                }, 50);
            }
        },

        onOutfitJsonLoaded() {
            popUp.hidden = true;
        },

        positionWithinViewport(pointerEvent) {
            const { pageX, pageY } = pointerEvent;
            const offsetParent = popUp.offsetParent;

            const relativeX = pageX - offsetParent.offsetLeft;
            const relativeY = pageY - offsetParent.offsetTop;

            const maxLeft = offsetParent.offsetWidth - canvas.offsetWidth;
            const maxTop = offsetParent.offsetHeight - canvas.offsetHeight;

            const marginLeftWidth = maxLeft / 2;
            const left = Util.clampNum(0, relativeX, maxLeft) - marginLeftWidth;
            const top = Util.clampNum(0, relativeY, maxTop);

            Object.assign(popUp.style, {
                left: px(left),
                right: px(-left),
                top: px(top),
                width: px(canvas.offsetWidth),
            });
            popUp.hidden = false;
        },

        async redrawAsync(src) {
            return await canvas.drawUnblurredImageAsync(src);
        },
    });
}


const Create = {};

Create.itemSlot = ({
    itemImageSrc = null,
    popUpImageSrc = null,
    gearSlotImageSrc = null,
    href = null,
    isDraggable = true,
    isShadowed = true,
    isFramed = false,
    isFukidashi = false,
}) => {
    Util.addStyleRules(/*css*/`
        item-slot {
            position: relative;
            width: 32px;
            height: 32px;
            background-color: var(--view-bg-color);

            &::before ,
            item-icon {
                position: absolute;
                top: 0;
                left: 0;
                width: 32px;
                height: 32px;
            }
            &.shadowed::before {
                background-image: url("data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><ellipse cx='16' cy='24' rx='14' ry='8' fill='rgb(212,188,177)'></ellipse></svg>");
                background-repeat: no-repeat;
                background-color: var(--view-bg-color);
                content: "";
            }
            item-icon {
                z-index: 2;

                canvas {
                    pointer-events: none;
                }
            }
            [href] {
                -webkit-tap-highlight-color: transparent;
                cursor: inherit;
            }

            &.framed {
                width: 40px;
                height: 40px;

                &::before {
                    border-radius: 6px;
                    background-origin: content-box;
                    padding: 2px;
                    border: var(--scroll-bar-track-color) 2px solid;
                }
                item-icon {
                    top: 4px;
                    left: 4px;
                }
            }

            &:has(.gear-slot-image) {
                width: 40px;
                height: 51px;

                .gear-slot-image {
                    width: 100%;
                    height: 100%;
                }
                &::before,
                item-icon {
                    top: 15px;
                    left: 4px;
                }
                &:has([hidden])::before {
                    content: none;
                }
            }
        }
    `);

    const rootElement = Util.elementize(/*html*/`
        <item-slot class="
            ${ isFramed ? 'framed' : '' }
            ${ isShadowed ? 'shadowed' : '' }
        ">
        </item-slot>
    `);
    const itemIcon = Util.elementize(/*html*/`
        <item-icon class="${ isFukidashi ? 'fukidashi' : '' }">
            <canvas></canvas>
        </item-icon>
    `);

    if (href) {
        const anchor = document.createElement('a');
        anchor.href = '#' + href;
        rootElement.append(anchor);
        anchor.append(itemIcon);
    } else {
        rootElement.append(itemIcon);
    }

    if (gearSlotImageSrc) {
        const gearSlotImage = Util.elementize(/*html*/`
            <canvas class="gear-slot-image"></canvas>
        `);
        gearSlotImage.drawUnblurredImageAsync(gearSlotImageSrc);
        rootElement.prepend(gearSlotImage);
    }

    const redrawAsync = async (newItemImageSrc = null, newPopUpImageSrc = null) => {
        popUpImageSrc = newPopUpImageSrc ?? '';
        return await $('canvas', itemIcon).drawUnblurredImageAsync(newItemImageSrc ?? '');
    };
    redrawAsync(itemImageSrc, popUpImageSrc);

    const resetPos = () => {
        Object.assign(itemIcon.style, {
            left: '',
            top: '',
            zIndex: '',
        });
    };

    Object.assign(itemIcon, {
        onDragStart(event) {
            if (!isDraggable) {
                return;
            }
            const rect = itemIcon.offsetParent.getBoundingClientRect();
            Util.grabStart({
                event,
                target: itemIcon,
                left: rect.x + 17,
                top: rect.y + 17,
            });
            itemIcon.style.zIndex = 9999999;
        },
        onDragMove(event, isDragMoved) {
            if (!isDraggable) {
                return;
            }
            if (!isDragMoved) {
                popUp.hidden = true;
            }
            Util.grabMove({
                event,
                target: itemIcon,
            });
        },

        onDragCancel: resetPos,

        onDragEnd(event, isDragMoved) {
            resetPos();
            if (isDragMoved && isDraggable) {
                event.stopPropagation();
                Trigger.onItemDrop(event);
                return;
            }
            if (!isDragMoved && popUpImageSrc) {
                popUp.redrawAsync(popUpImageSrc).then(() => {
                    popUp.positionWithinViewport(event);
                });
            }
        },
    });

    Object.assign(rootElement, {
        redrawAsync,
    });
    return rootElement;
};




Create.charaOutfit = ({
    imageSrc = null,
    isReverse = false,
    isSitting = false,
    isAttacking = false,
    alt = '',
} = {}) => {
    Util.addStyleRules(/*css*/`
        chara-outfit {
            --outfit-basic-width: 130px;
            --outfit-max-width: 150px;
            --outfit-height: 125px;
            width: var(--outfit-basic-width);
            height: var(--outfit-height);
            margin: -10px -10px -5px -5px;
            position: relative;

            &::before,
            &::after {
                content: "";
                width: 100%;
                height: 100%;
                display: block;
                background-image: url("data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='-21 -10 42 20'><ellipse cx='0' cy='0' rx='21' ry='10' fill='rgb(59,59,59)'></ellipse></svg>");
                background-repeat: no-repeat;
                background-size: 42px 20px;
                background-position:
                    calc(35px + var(--shadow-offset-x, 0px) * var(--reverse-factor, 1))
                    calc(95px + var(--shadow-offset-y, 0px));
            }
            &.reverse {
                --reverse-factor: -1;
            }
            &.sitting {
                --shadow-offset-x: 2px;
                --shadow-offset-y: -1px;
            }
            &.attacking {
                --shadow-offset-x: 5px;
                --shadow-offset-y: -2px;
            }
            &::before {
                mix-blend-mode: lighten;
            }
            &::after {
                mix-blend-mode: difference;
                margin-top: calc(var(--outfit-height) * -1);
            }

            img {
                --outfit-offset-x: calc((var(--outfit-max-width) - var(--outfit-basic-width)) / 2);
                position: absolute;
                top: 0;
                left: calc(var(--outfit-offset-x) * -1);
                width: var(--outfit-max-width);
                height: 100%;
                object-fit: contain;
                z-index: 1;
            }
            &.reverse img {
                transform: scaleX(-1);
                transform-origin: calc(56px + var(--outfit-offset-x));
            }
        }
    `);


    const rootElement = Util.elementize(/*html*/`
        <chara-outfit class="
            ${ isReverse ? 'reverse': '' }
            ${ isSitting ? 'sitting' : '' }
            ${ isAttacking ? 'attacking' : '' }
        ">
            <img src="${ imageSrc ?? '' }" alt="${ alt }">
        </chara-outfit>
    `);

    Object.assign(rootElement, {
        replace(newImage) {
            $('img', rootElement).src = newImage;
        },
    });
    return rootElement;
};




Create.scrollSection = () => {
    Util.addStyleRules(/*css*/`
        scroll-section {
            display: block;
            width: 100%;
            height: 100%;

            &:not([hidden]) {
                position: relative;
            }
        }

        scroll-pages,
        scroll-bar {
            position: absolute;
            top: 0;
            height: 100%;
            box-sizing: border-box;
            --scroll-bar-radius: 10px;
            border-top-right-radius: var(--scroll-bar-radius);
            border-bottom-right-radius: var(--scroll-bar-radius);
        }

        scroll-pages {
            width: 100%;
            border-top-left-radius: var(--view-radius);
            border-bottom-left-radius: var(--view-radius);

            scroll-page {
                display: block;
            }
            shadowed-emoji {
                text-shadow: 1px 1px var(--view-border-color);
            }
            compact-punctuation {
                margin-right: -4px;
            }
            p item-slot {
                display: inline-block;
                border-inline: 4px solid transparent;
                vertical-align: top;

                &:has(.fukidashi) {
                    vertical-align: text-bottom;
                }
            }
            br.fix-left-edge {
                +item-slot {
                    border-left: none;
                }
                &[hidden] {
                    display: none;
                }
            }
        }

        scroll-bar {
            right: 0;
            width: var(--scroll-bar-entire-width);
            background-color: var(--scroll-bar-track-color);
            border-width: 20px 3px 17px 2px;
            border-style: solid;
            border-color: var(--view-border-color);
            box-shadow:
                -1px 0 var(--view-bg-color) inset,
                1px 0 var(--view-bg-color) inset;

            &::before,
            &::after {
                content: "";
                position: absolute;
                left: -1px;
                border-radius: 2px / 6px;
                border-style: solid;
                border-width: 8px;
                border-color: var(--view-bg-color) transparent;
            }
            &::before {
                top: -14px;
                border-top: none;
            }
            &::after {
                bottom: -12px;
                border-bottom: none;
            }
            scroll-thumb {
                position: absolute;
                top: 0;
                left: 0;
                width: 12px;
                height: 16px;
                border: 1px solid rgb(58, 188, 203);
                background-color: rgb(95, 255, 234);
                border-radius: 3px;
            }
        }
    `);


    const rootElement = Util.elementize(/*html*/`
        <scroll-section>
            <scroll-pages></scroll-pages>
            <scroll-bar>
                <scroll-thumb hidden></scroll-thumb>
            </scroll-bar>
        </scroll-section>
    `);
    const scrollPages = $('scroll-pages', rootElement);
    const scrollBar = $('scroll-bar', rootElement);
    const scrollThumb = $('scroll-thumb', rootElement);


    const onResizeEnd = async () => {
        const fragment = new DocumentFragment();
        for (const page of $$('scroll-page', scrollPages)) {
            fragment.append(...page.children);
        }
        if (fragment.children.length) {
            replaceChildren(...fragment.children);
        }
    };


    let pages;
    let maxThumbTop;

    const replaceChildren = (...staticElementList) => {
        maxThumbTop = scrollBar.clientHeight - scrollThumb.offsetHeight;

        const createPage = (firstChild) => {
            const page = document.createElement('scroll-page');
            page.hidden = true;
            page.append(firstChild);
            return page;
        };

        const adjustItemSlotSpaces = (p) => {
            if (!p.matches?.('p')) {
                return;
            }
            for (const fixLeftEdge of $$('.fix-left-edge', p)) {
                fixLeftEdge.remove();
            }
            for (const itemSlot of $$('item-slot', p)) {
                if (itemSlot.offsetLeft !== p.offsetLeft) {
                    continue;
                }
                const fixLeftEdge = Util.elementize(/*html*/`
                    <br class="fix-left-edge">
                `);
                fixLeftEdge.hidden = itemSlot === p.firstChild;
                itemSlot.insertAdjacentElement('beforebegin', fixLeftEdge);
            }
        };

        const pageMaxHeight = scrollPages.clientHeight;
        Util.clearChildrenPropsBeforeEmptying(scrollPages);
        scrollPages.innerHTML = '';
        scrollPages.hidden = true;

        let page = createPage(staticElementList.shift());
        page.hidden = false;
        scrollPages.append(page);
        adjustItemSlotSpaces(page.firstChild);

        for (const element of staticElementList) {
            page.append(element);
            adjustItemSlotSpaces(element);

            if (page.clientHeight > pageMaxHeight) {
                page = createPage(element);
                scrollPages.append(page);
            }
        }
        scrollPages.hidden = false;
        pages = [...scrollPages.children];
        scrollThumb.hidden = (pages.length < 2);

        updateThumbPosAndPage();
    };


    const updateThumbPosAndPage = (() => {
        let currentPageIndex;
        return ({ pageDelta = null, thumbTop = null } = {}) => {

            const indexRatio = (pages.length - 1) / maxThumbTop;
            if (indexRatio <= 0) {
                return;
            }
            if (pageDelta === null && thumbTop === null) {
                currentPageIndex = 0;
            } else {
                const _newIndex = pageDelta
                    ? currentPageIndex + pageDelta
                    : Math.round(thumbTop * indexRatio);
                const newIndex = Util.clampNum(0, _newIndex, pages.length - 1);

                if (currentPageIndex !== newIndex) {
                    pages[currentPageIndex].hidden = true;
                    currentPageIndex = newIndex;
                }
            }
            pages[currentPageIndex].hidden = false;
            thumbTop ??= currentPageIndex / indexRatio;

            const newThumbTop = Util.clampNum(0, thumbTop, maxThumbTop);
            scrollThumb.style.top = px(newThumbTop);
        };
    })();


    const overwrite = (text, json) => {
        const emojiRegex = /\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu;

        const articleElement = Util.elementize('<div>' + text
            .split('\n')
            .map(line => {
                if (!line) {
                    return '<hr>';
                }
                if (line.trim().startsWith('!')) {
                    return line.slice(1);
                }
                return `<p>${ line }</p>`;
            })
            .join('')
            .replace(
                emojiRegex,
                /*html*/`<shadowed-emoji translate="no">$&</shadowed-emoji>`
            )
            .replace(
                /(、)(\$\[|「)/g,
                ($0, $1, $2) => /*html*/`<compact-punctuation>${ $1 }</compact-punctuation>${ $2 }`
            )
            .replace(
                /\$\[(.+?)\]/g,
                ($0, $1) => {
                    const [shortName, fullName] = $1.split('|');
                    return /*html*/`
                        <temp-item-slot>${ fullName || shortName }</temp-item-slot>${ shortName }
                    `.trim();
                }
            ) + '</div>');

        for (const tempItemSlot of $$('temp-item-slot', articleElement)) {
            const item = json.items[tempItemSlot.textContent];
            const isFukidashi = item.type === 'fukidashi';
            const itemSlot = Create.itemSlot({
                itemImageSrc: item.icon,
                popUpImageSrc: item.popUp,
                isDraggable: false,
                isFukidashi,
                isShadowed: !isFukidashi,
            });
            tempItemSlot.replaceWith(itemSlot);
        }
        replaceChildren(...articleElement.children);
    };

    Object.assign(scrollPages, {
        onResizeEnd,
        onSwipeY(swipeDelta) {
            updateThumbPosAndPage({ pageDelta: Math.sign(-swipeDelta) });
        },
    });

    Object.assign(scrollBar, {
        onDragEnd(event) {
            const clickedBarTop = event.offsetY;
            if (0 <= clickedBarTop && clickedBarTop <= maxThumbTop) {
                updateThumbPosAndPage({ thumbTop: clickedBarTop });
            } else {
                updateThumbPosAndPage({ pageDelta: Math.sign(clickedBarTop) });
            }
        },
    });

    Object.assign(scrollThumb, {
        onDragStart(event) {
            Util.grabStart({ event });
        },
        onDragMove(event) {
            updateThumbPosAndPage({ thumbTop: event.pageY - scrollThumb.grabStartTop });
        },
        onDragEnd(event) {
            event.stopPropagation();
        }
    });

    Object.assign(rootElement, {
        onWheelEnd(event) {
            updateThumbPosAndPage({ pageDelta: Math.sign(event.deltaY) });
        },
        replaceChildren,
        overwrite,
    });
    return rootElement;
};



Create.charaSlot = ({
    name,
    hair,
    makeup,
    element,
    thumbnail,
    itemSlots,
}) => {
    Util.addStyleRules(/*css*/`
        chara-slot {
            display: grid;
            border-width: 0 0 2px 2px;
            border-style: solid;
            border-color: var(--scroll-bar-track-color);
            border-bottom-left-radius: 8px;
            row-gap: .5em;
            grid-template-columns: auto 1fr;
            grid-template-areas:
                "outfit details"
                "outfit slots";

            chara-outfit {
                grid-area: outfit;
                align-self: center;
            }
            chara-profile {
                grid-area: details;

                chara-attr {
                    display: flex;
                    align-items: center;

                    &::before {
                        content: attr(data-attr-name);
                        border-radius: 6px;
                        background-color: var(--scroll-bar-track-color);
                        color: var(--view-bg-color);
                        font-weight: bold;
                        font-size: smaller;
                        width: 4em;
                        text-align: center;
                        margin-right: .5em;
                        flex-shrink: 0;
                    }
                }
            }
            item-slots {
                grid-area: slots;
                width: calc(100% - mod(100%, 42px));
                height: calc(100% - mod(100%, 42px));
                margin-bottom: 7px;
                background-image: url("data:image/svg+xml;charset=utf-8,<svg viewBox='0 0 42 42' xmlns='http://www.w3.org/2000/svg'><path stroke='rgb(177, 162, 166)' stroke-width='2' d='M1,5 v30 a6,6 0 0 0 4,4 h30 a6,6 0 0 0 4,-4 v-30 a6,6 0 0 0 -4,-4 h-30 a6,6 0 0 0 -4,4' fill='none'></path><ellipse transform='translate(4 4)' cx='16' cy='24' rx='14' ry='8' fill='rgb(212,188,177)'></ellipse></svg>");
                background-size: 42px 42px;

                item-slot {
                    float: left;
                    margin: 0 2px 2px 0;
                    box-sizing: border-box;
                }
            }
        }
        @media (width < 450px) {
            chara-slot chara-outfit {
                margin-inline: -15px -30px;
            }
        }
        @media (height < 480px) {
            chara-slot {
                grid-template-columns: auto 13em 1fr;
                grid-template-areas: "outfit details slots";
                row-gap: .3em;
                border-style: none;

                chara-outfit {
                    margin: -25px -20px -10px -10px;
                }
            }
        }
    `);

    const rootElement = Util.elementize(/*html*/`
        <chara-slot data-element="${ element }">
            <chara-profile>
                <chara-attr data-attr-name="なまえ">${ name }</chara-attr>
                <chara-attr data-attr-name="ヘア">${ hair }</chara-attr>
                <chara-attr data-attr-name="メイク">${ makeup }</chara-attr>
            </chara-profile>
            <item-slots></item-slots>
        </chara-slot>
    `);

    const outfit = Create.charaOutfit({ imageSrc: `/images/outfits/${ thumbnail }/standing.webp` });
    rootElement.prepend(outfit);

    $('item-slots', rootElement).append(...itemSlots);
    return rootElement;
};



{
    let topMostZIndex = 10;
    Create.UIView = (id, title, isHorizontallyCentered = true) => {
        Util.addStyleRules(/*css*/`
            ui-view {
                display: flex;
                width: 600px;
                flex-direction: column;
                background-color: var(--view-bg-color);
                border: 3px solid var(--view-border-color);
                border-radius: var(--view-radius);
                color: var(--view-border-color);
                z-index: ${ topMostZIndex };

                &.horizontally-center {
                    left: 0;
                    right: 0;
                }
                >h2 {
                    width: 100%;
                    background-color: var(--view-border-color);
                    color: var(--view-bg-color);
                    line-height: 1.5;
                    font-size: smaller;
                    padding: 1px 1px 0;
                    margin: -1px -1px 0;
                    text-indent: 0.25em;
                    -webkit-user-select: none;
                    user-select: none;
                }
                >article {
                    margin: 5px;
                    flex-grow: 1;
                }
            }
            @media (width < 630px) {
                ui-view {
                    width: calc(100vw - 20px);
                }
            }
        `);

        const rootElement = Util.elementize(/*html*/`
            <ui-view id="${ id }" hidden>
                <h2>${ title }</h2>
                <article></article>
            </ui-view>
        `);
        if (isHorizontallyCentered) {
            rootElement.classList.add('horizontally-center');
        }


        Object.assign($('h2', rootElement), {
            onDragStart(event) {
                Util.grabStart({
                    event,
                    target: rootElement,
                });
            },
            onDragMove(event) {
                Util.grabMove({
                    event,
                    target: rootElement,
                });
            },
        });

        Object.assign(rootElement, {
            onDragStart() {
                rootElement.style.zIndex = topMostZIndex++;
            },

            onResizeEnd() {
                rootElement.removeAttribute('style');
            },
            innerSpace: $('article', rootElement),
        });
        return rootElement;
    };
}


{
    const intersectionObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            entry.target.style.visibility = entry.isIntersecting ? '' : 'hidden';
        }
    }, {
        root: $('main'),
        rootMargin: '20px 20px 20px 0px',
        threshold: 0.6,
    });

    Create.snapShot = ({
        areaImageName,
        areaImageAlt,
        sprites,
    }) => {
        Util.addStyleRules(/*css*/`
            snap-shot {
                picture img,
                chara-outfit {
                    position: absolute;
                    margin: auto;
                }
                picture img {
                    inset: -999%;
                }
            }
        `);
        const rootElement = Util.elementize(/*html*/`
            <snap-shot data-bg-image-name="${ areaImageName }">
                <picture>
                    <source
                        type="image/avif"
                        srcset="/images/areas/${ areaImageName }.avif"
                    >
                    <img
                        src="/images/areas/${ areaImageName }.webp"
                        alt="${ areaImageAlt }"
                        width="1920"
                        height="1080"
                    >
                </picture>
            </snap-shot>
        `);

        for (const [imageSrc, option] of Object.entries(sprites)) {
            const outfit = Create.charaOutfit({
                imageSrc,
                isReverse: option.isReverse,
                isSitting: option.isSitting,
                isAttacking: option.isAttacking,
            });

            if (!option.isAlwaysVisible) {
                intersectionObserver.observe(outfit);
            }
            outfit.style.inset = `
                ${ option.top }px
                ${ -option.left }px
                ${ -option.top }px
                ${ option.left }px
            `;
            rootElement.append(outfit);
        }
        return rootElement;
    };
}


export {
    $,
    $$,
    px,
    Util,
    Trigger,
    popUp,
    Create,
};
