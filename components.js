const $ = (selectors, ancestor = document) => ancestor.querySelector(selectors);
const $$ = (selectors, ancestor = document) => [...ancestor.querySelectorAll(selectors)];
const px = (value) => `${ value }px`;

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
    },

    grabMove({
        event,
        target = event.target,
    }) {
        target.style.left = px(event.pageX - target.grabStartLeft);
        target.style.top = px(event.pageY - target.grabStartTop);
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

    async hashize(message) {
        return [...new Uint8Array(await crypto.subtle.digest('SHA-1',new TextEncoder().encode(message)))].map(b=>b.toString(16).padStart(2,'0')).join('');
    },
};


HTMLCanvasElement.prototype.drawAsync = async function(src) {
    const context = this.getContext('2d');
    if (!src) {
        context.clearRect(0, 0, this.width, this.height);
        delete this.dataset.hashedSrc;
        return;
    }
    const hashedSrc = await Util.hashize(src);
    if (this.dataset.hashedSrc === hashedSrc) {
        return;
    }
    const image = new Image();
    image.src = src;
    await image.decode();

    this.style.width = px(image.width);
    this.style.height = px(image.height);

    const zoomScale = 4;
    this.width = image.width * zoomScale;
    this.height = image.height * zoomScale;

    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, this.width, this.height);
    this.dataset.hashedSrc = hashedSrc;
};

{
    const originalStopPropagation = Event.prototype.stopPropagation;
    Event.prototype.stopPropagation = function() {
        this.propagationStopped = true;
        originalStopPropagation.call(this);
    };
}



{
    const preventEvent = (event) => {
        event.preventDefault();
        event.stopPropagation();
    };

    const propagateDragEvent = (eventName, event, ...args) => {
        let ancestor = event.target;
        while (ancestor?.parentNode?.closest && !event.propagationStopped) {
            ancestor[eventName]?.(event, ...args);
            ancestor = ancestor.parentNode.closest('.shouldCaptureBubblingDragEvent');
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
        $('body').classList.add('pointer-pressing');
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
        $('body').classList.remove('pointer-pressing');

        if (event.pointerType === 'touch') {
            for (const eventName of ['mousedown', 'mouseup']) {
                document.addEventListener(eventName, preventEvent, { once: true });
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
    document.addEventListener('dragstart', preventEvent);
}


{
    for (const customPropName of [
        'onSwipeX',
        'onSwipeY',
        'onWheelEnd',
        'onResizeEnd',
        'onWindowResizeEnd',
        'onItemDrop',
        'onMainJsonLoaded',
        'onOutfitJsonLoaded',
        'onNotFound',
        'shouldCaptureBubblingDragEvent',
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
        if (Object.hasOwn(swipeableElement, 'onDragStart')) {
            return;
        }
        let dragStartEvent = null;

        Object.assign(swipeableElement, {
            shouldCaptureBubblingDragEvent: true,

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
        let isFirstTime = true;

        return function() {
            if (isFirstTime) {
                isFirstTime = false;
                callback.apply(this, arguments);
                return;
            }
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => callback.apply(this, arguments), delayMs);
        };
    };

    const resizeObserver = new ResizeObserver(
        waitForEnd((entries) => {
            for (const entry of entries) {
                entry.target.onResizeEnd?.(entry);
            }
        })
    );

    window.addEventListener('resize',
        waitForEnd(() => {
            for (const element of $$('.onWindowResizeEnd')) {
                element.onWindowResizeEnd();
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





const popup = Util.elementize(/*html*/`
    <canvas id="popup" hidden></canvas>
`);
{
    Util.addStyleRules(/*css*/`
        #popup {
            z-index: 9999999;
            position: absolute;
            touch-action: pinch-zoom;

            &[hidden] {
                visibility: hidden;
            }
        }
    `);

    Object.assign(popup, {
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
            if (event.offsetY <= 12 && popup.offsetWidth - event.offsetX <= 16) {
                setTimeout(() => {
                    popup.hidden = true;
                }, 50);
            }
        },

        moveToCursor(pointerEvent) {
            const { pageX, pageY } = pointerEvent;
            const maxLeft = $('main').clientWidth - popup.offsetWidth;
            const maxTop = $('main').clientHeight - popup.offsetHeight;

            popup.style.left = px(Util.clampNum(0, pageX - $('main').offsetLeft, maxLeft));
            popup.style.top = px(Util.clampNum(0, pageY - $('main').offsetTop, maxTop));
            popup.hidden = false;
        },

        onWindowResizeEnd() {
            popup.hidden = true;
        },
    });
    $('main').append(popup);
}


const Create = {};

Create.itemSlot = ({
    itemImageSrc = null,
    popupImageSrc = null,
    gearSlotImageSrc = null,
    isDraggable = true,
    isShadowed = true,
    isFramed = false,
    isFukidashi = false,
}) => {
    Util.addStyleRules(/*css*/`
        .item-slot {
            position: relative;
            width: 32px;
            height: 32px;
            background-color: var(--view-background-color);
            vertical-align: top;

            &:has(.fukidashi) {
                vertical-align: text-bottom;
            }
            &:is(p *) {
                display: inline-block;
                margin: 0 3px;
            }

            &::before ,
            .item-icon {
                position: absolute;
                top: 0;
                left: 0;
                width: 32px;
                height: 32px;
            }
            &::before {
                background-image: url("data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><ellipse cx='16' cy='24' rx='14' ry='8' fill='rgb(212,188,177)'></ellipse></svg>");
                background-repeat: no-repeat;
                background-color: var(--view-background-color);
            }
            &.shadowed::before {
                content: "";
            }
            .item-icon {
                z-index: 2;
                touch-action: pinch-zoom;
            }
        }

        .item-slot.framed {
            width: 40px;
            height: 40px;

            &::before {
                border-radius: 6px;
                background-origin: content-box;
                padding: 2px;
                border: var(--scrollbar-track-color) 2px solid;
            }
            .item-icon {
                top: 4px;
                left: 4px;
            }
        }

        .item-slot:has(.gear-slot-image):not(#dummy-selector-for-specificity) {
            width: 40px;
            height: 51px;

            .gear-slot-image {
                width: 100%;
                height: 100%;
            }
            &::before,
            .item-icon {
                top: 15px;
                left: 4px;
            }
            &:has(>.item-icon:not([data-hashed-src]))::before {
                content: none;
            }
        }
    `);

    const rootElement = Util.elementize(/*html*/`
        <span class="
            item-slot
            ${ isFramed ? 'framed' : '' }
            ${ isShadowed ? 'shadowed' : '' }
        ">
            <canvas class="
                item-icon
                ${ isFukidashi ? 'fukidashi' : '' }
            "></canvas>
        </span>
    `);
    const dragThumb = $('.item-icon', rootElement);

    if (gearSlotImageSrc !== null) {
        const gearSlotImage = Util.elementize(/*html*/`
            <canvas class="gear-slot-image"></canvas>
        `);
        gearSlotImage.drawAsync(gearSlotImageSrc);
        rootElement.prepend(gearSlotImage);
    }

    const redraw = (newItemImageSrc, newPopupImageSrc) => {
        dragThumb.drawAsync(newItemImageSrc);
        dragThumb.__popupImageSrc = newPopupImageSrc;
    };
    redraw(itemImageSrc, popupImageSrc);

    const resetPos = () => {
        Object.assign(dragThumb.style, {
            left: '',
            top: '',
            zIndex: '',
        });
    };

    Object.assign(dragThumb, {
        onDragStart(event) {
            if (!isDraggable) {
                return;
            }
            const rect = dragThumb.offsetParent.getBoundingClientRect();
            Util.grabStart({
                event,
                left: rect.x + 17,
                top: rect.y + 17,
            });
            dragThumb.style.zIndex = 9999999;
        },
        onDragMove(event, isDragMoved) {
            if (!isDraggable) {
                return;
            }
            if (!isDragMoved) {
                popup.hidden = true;
            }
            Util.grabMove({ event });
        },

        onDragCancel: resetPos,

        onDragEnd(event, isDragMoved) {
            resetPos();
            if (isDragMoved && isDraggable) {
                event.stopPropagation();
                Trigger.onItemDrop(event);
                return;
            }
            if (!isDragMoved && dragThumb.__popupImageSrc) {
                popup.drawAsync(dragThumb.__popupImageSrc).then(() => {
                    popup.moveToCursor(event);
                });
            }
        },
    });

    Object.assign(rootElement, {
        redraw,
    });
    return rootElement;
};




Create.outfit = ({
    imageSrc = null,
    isReverse = false,
    isSitting = false,
    isAttacking = false,
    alt = '',
} = {}) => {
    Util.addStyleRules(/*css*/`
        .outfit {
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
        <figure class="outfit
            ${ isReverse ? 'reverse': '' }
            ${ isSitting ? 'sitting' : '' }
            ${ isAttacking ? 'attacking' : '' }
        ">
            <img src="${ imageSrc ?? '' }" alt="${ alt }">
        </figure>
    `);

    Object.assign(rootElement, {
        replace(newImage) {
            $('img', rootElement).src = newImage;
        },
    });
    return rootElement;
};




Create.scrollableSection = (isThumbPosDiscrete = false) => {
    Util.addStyleRules(/*css*/`
        .scrollable-section {
            position: relative;
            width: 100%;
            height: 100%;
        }

        .scrollable,
        .scrollbar {
            position: absolute;
            top: 0;
            height: 100%;
            box-sizing: border-box;
            --scrollbar-radius: 10px;
            border-top-right-radius: var(--scrollbar-radius);
            border-bottom-right-radius: var(--scrollbar-radius);
        }

        .scrollable {
            width: 100%;
            border-top-left-radius: var(--view-radius);
            border-bottom-left-radius: var(--view-radius);
            touch-action: pinch-zoom;

            &:not(.completed) .page {
                visibility: hidden;
            }
            &.completed .page:not(.active) {
                display: none;
            }
            .emoji {
                text-shadow: 1px 1px var(--view-border-color);
            }
            .compact-punctuation {
                margin-right: -6px;
            }
            hr[hidden] {
                display: none;
            }
        }

        .scrollbar {
            right: 0;
            width: var(--scrollbar-entire-width);
            background-color: var(--scrollbar-track-color);
            border-width: 20px 3px 17px 2px;
            border-style: solid;
            border-color: var(--view-border-color);
            box-shadow:
                -1px 0 var(--view-background-color) inset,
                1px 0 var(--view-background-color) inset;

            &::before,
            &::after {
                content: "";
                position: absolute;
                left: -1px;
                border-radius: 2px / 6px;
                border-style: solid;
                border-width: 8px;
                border-color: var(--view-background-color) transparent;
            }
            &::before {
                top: -14px;
                border-top: none;
            }
            &::after {
                bottom: -12px;
                border-bottom: none;
            }
            .scrollbar-thumb {
                position: absolute;
                top: 0;
                left: 0;
                width: 12px;
                height: 16px;
                border: 1px solid rgb(58, 188, 203);
                background-color: rgb(95, 255, 234);
                border-radius: 3px;
                touch-action: pinch-zoom;
            }
            &.disabled .scrollbar-thumb {
                visibility: hidden;
            }
        }
    `);


    const rootElement = Util.elementize(/*html*/`
        <div class="scrollable-section">
            <div class="scrollable"></div>
            <div class="scrollbar disabled">
                <div class="scrollbar-thumb"></div>
            </div>
        </div>
    `);
    const scrollable = $('.scrollable', rootElement);
    const scrollbar = $('.scrollbar', rootElement);
    const scrollbarThumb = $('.scrollbar-thumb', rootElement);


    let maxThumbTop;
    const onResizeEnd = async () => {
        maxThumbTop = scrollbar.clientHeight - scrollbarThumb.offsetHeight;

        const fragment = new DocumentFragment();
        for (const page of $$('.page', scrollable)) {
            fragment.append(...page.children);
        }
        if (fragment.children.length) {
            replaceChildren(...fragment.children);
        }
    };

    let pages;
    const replaceChildren = (...staticElementList) => {
        const createPage = (firstChild) => {
            const page = document.createElement('div');
            page.className = 'page';
            page.append(firstChild);
            return page;
        };

        const pageMaxHeight = scrollable.clientHeight;
        scrollable.classList.remove('completed');
        Util.clearChildrenPropsBeforeEmptying(scrollable);
        scrollable.innerHTML = '';

        let page = createPage(staticElementList.shift());
        page.classList.add('active');
        scrollable.append(page);

        for (const element of staticElementList) {
            page.append(element);
            element.hidden = false;
            if (page.scrollHeight > pageMaxHeight) {
                if (element.localName === 'hr') {
                    element.hidden = true;
                    continue;
                }
                page = createPage(element);
                scrollable.append(page);
            }
        }
        scrollable.classList.add('completed');
        pages = [...scrollable.children];
        scrollbar.classList[pages.length < 2 ? 'add' : 'remove']('disabled');

        updateThumbPosAndPage();
    };


    const updateThumbPosAndPage = (() => {
        let currentPageIndex;
        return ({ pageDelta = 0, thumbTop = null } = {}) => {
            const indexRatio = (pages.length - 1) / maxThumbTop;
            if (indexRatio <= 0) {
                return;
            }
            const newIndex = (() => {
                if (pageDelta === 0 && thumbTop === null) {
                    currentPageIndex = null;
                    return 0;
                }
                const _newIndex = (thumbTop === null)
                    ? currentPageIndex + pageDelta
                    : Math.round(thumbTop * indexRatio);
                return Util.clampNum(0, _newIndex, pages.length - 1);
            })();

            if (currentPageIndex !== newIndex) {
                pages[currentPageIndex]?.classList.remove('active');
                pages[newIndex].classList.add('active');
                currentPageIndex = newIndex;
            }

            const newThumbTop = (thumbTop === null || isThumbPosDiscrete)
                ? currentPageIndex / indexRatio
                : thumbTop;
            scrollbarThumb.style.top = px(Util.clampNum(0, newThumbTop, maxThumbTop));
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
            .replace(emojiRegex, '<span class="emoji">$&</span>')
            .replace(/(、)(\[|「)/g, ($0, $1, $2) => {
                return `<span class="compact-punctuation">${ $1 }</span>${ $2 }`;
            })
            .replace(/\[(.+?)\]/g, ($0, $1) => {
                const itemNames = $1.split('|');
                const shortName = itemNames[0];
                const fullName = itemNames[1] || shortName;
                return `<temp-item-slot>${ fullName }</temp-item-slot>${ shortName }`;
            })
            + '</div>');

        for (const tempItemSlot of $$('temp-item-slot', articleElement)) {
            const item = json.items[tempItemSlot.textContent];
            const isFukidashi = item.type === 'fukidashi';
            const itemSlot = Create.itemSlot({
                itemImageSrc: item.icon,
                popupImageSrc: item.popup,
                isDraggable: false,
                isFukidashi,
                isShadowed: !isFukidashi,
            });
            tempItemSlot.replaceWith(itemSlot);
        }
        replaceChildren(...articleElement.children);
    };

    Object.assign(scrollable, {
        onResizeEnd,
        onSwipeY(swipeDelta) {
            updateThumbPosAndPage({ pageDelta: Math.sign(-swipeDelta) });
        },
    });

    Object.assign(scrollbar, {
        onDragEnd(event) {
            const clickedBarTop = event.offsetY;
            if (0 <= clickedBarTop && clickedBarTop <= maxThumbTop) {
                updateThumbPosAndPage({ thumbTop: clickedBarTop });
            } else {
                updateThumbPosAndPage({ pageDelta: Math.sign(clickedBarTop) });
            }
        },
    });

    Object.assign(scrollbarThumb, {
        onDragStart(event) {
            Util.grabStart({ event });
        },
        onDragMove(event) {
            updateThumbPosAndPage({ thumbTop: event.pageY - scrollbarThumb.grabStartTop });
        },
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



Create.characterSlot = ({
    name,
    hair,
    makeup,
    element,
    thumbnail,
    itemSlots,
}) => {
    Util.addStyleRules(/*css*/`
        .character-slot {
            display: grid;
            border-width: 0 0 2px 2px;
            border-style: solid;
            border-color: var(--scrollbar-track-color);
            border-bottom-left-radius: 8px;
            row-gap: .5em;
            grid-template-columns: auto 1fr;
            grid-template-areas:
                "outfit details"
                "outfit slots";

            .outfit {
                grid-area: outfit;
                align-self: center;
            }

            .chatacter-details {
                grid-area: details;

                [data-field-name] {
                    display: flex;
                    align-items: center;

                    &::before {
                        content: attr(data-field-name);
                        border-radius: 6px;
                        background-color: var(--scrollbar-track-color);
                        color: var(--view-background-color);
                        font-weight: bold;
                        font-size: smaller;
                        width: 4em;
                        text-align: center;
                        margin-right: .5em;
                        flex-shrink: 0;
                    }
                }
            }
            .item-slots {
                grid-area: slots;
                width: calc(100% - mod(100%, 42px));
                height: calc(100% - mod(100%, 42px));
                margin-bottom: 7px;
                background-image: url("data:image/svg+xml;charset=utf-8,<svg viewBox='0 0 42 42' xmlns='http://www.w3.org/2000/svg'><path stroke='rgb(177, 162, 166)' stroke-width='2' d='M1,5 v30 a6,6 0 0 0 4,4 h30 a6,6 0 0 0 4,-4 v-30 a6,6 0 0 0 -4,-4 h-30 a6,6 0 0 0 -4,4' fill='none'></path><ellipse transform='translate(4 4)' cx='16' cy='24' rx='14' ry='8' fill='rgb(212,188,177)'></ellipse></svg>");
                background-size: 42px 42px;

                .item-slot {
                    float: left;
                    margin: 0 2px 2px 0;
                    box-sizing: border-box;
                }
            }
        }
        @media (width < 450px) {
            .character-slot {
                .outfit {
                    margin-left: -15px;
                    margin-right: -30px;
                }
            }
        }
        @media (height < 480px) {
            .character-slot {
                grid-template-columns: auto 13em 1fr;
                grid-template-areas: "outfit details slots";
                row-gap: .3em;
                border-style: none;

                .outfit {
                    margin: -25px -20px -10px -10px;
                }
            }
        }
    `);

    const rootElement = Util.elementize(/*html*/`
        <div class="character-slot" data-element="${ element }">
            <div class="chatacter-details">
                <div data-field-name="なまえ">${ name }</div>
                <div data-field-name="髪型">${ hair }</div>
                <div data-field-name="メイク">${ makeup }</div>
            </div>
            <div class="item-slots"></div>
        </div>
    `);

    const outfit = Create.outfit({ imageSrc: `/images/character/${ thumbnail }.webp` });
    rootElement.prepend(outfit);

    $('.item-slots', rootElement).append(...itemSlots);
    return rootElement;
};




Create.view = (() => {
    let topMostZIndex = 3;

    return (id, title, isHorizontallyCentered = true) => {
        Util.addStyleRules(/*css*/`
            .view {
                display: flex;
                width: 600px;
                flex-direction: column;
                background-color: var(--view-background-color);
                border: 3px solid var(--view-border-color);
                border-radius: var(--view-radius);
                color: var(--view-border-color);
                z-index: ${ topMostZIndex };

                &[hidden] {
                    visibility: hidden;
                }
                &.horizontally-center {
                    position: absolute;
                    margin: 0 auto;
                    left: 0;
                    right: 0;
                }
                >h2 {
                    flex-shrink: 0;
                    width: 100%;
                    background-color: var(--view-border-color);
                    color: var(--view-background-color);
                    line-height: 1.5;
                    font-size: smaller;
                    padding: 1px 1px 0;
                    margin: -1px -1px 0;
                    text-indent: 0.25em;
                    user-select: none;
                    touch-action: pinch-zoom;
                }
                >section {
                    margin: 5px;
                    flex-grow: 1;
                }
            }
            @media (width < 630px) {
                .view {
                    width: calc(100vw - 20px);
                }
            }
        `);

        const rootElement = Util.elementize(/*html*/`
            <article id="${ id }" class="view" hidden>
                <h2>${ title }</h2>
                <section></section>
            </article>
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
                rootElement.style.margin = 0;
            },
        });

        Object.assign(rootElement, {
            shouldCaptureBubblingDragEvent: true,

            onDragStart() {
                rootElement.style.zIndex = ++topMostZIndex;
            },

            onWindowResizeEnd() {
                Object.assign(rootElement.style, {
                    left: '',
                    top: '',
                    margin: '',
                });
            },
            innerSpace: $('section', rootElement),
        });
        return rootElement;
    };
})();


export {
    $,
    $$,
    Util,
    Trigger,
    popup,
    Create,
};