const $ = (selectors, ancestor = document) => ancestor.querySelector(selectors);
const $$ = (selectors, ancestor = document) => [...ancestor.querySelectorAll(selectors)];

const Util = {
    clampNum(min, num, max) {
        return Math.min(Math.max(num, min), max);
    },

    elementize(html) {
        const template = document.createElement('template');
        template.innerHTML = html;
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

    moveElementToCursor(pointerEvent, element = pointerEvent.target) {
        element.style.left = `${ element.offsetLeft + pointerEvent.movementX }px`;
        element.style.top = `${ element.offsetTop + pointerEvent.movementY }px`;
    },

    clearReferencesBeforeRemoval(element, isFirstCall = true) {
        if (!isFirstCall) {
            for (const propertyName of Object.keys(element)) {
                delete element[propertyName];
            }
        }
        for (const child of element.children) {
            Util.clearReferencesBeforeRemoval(child, false);
        }
    },
};



{
    for (const customPropertyName of [
        'onWheelEnd',
        'onResizeEnd',
        'onWindowResizeEnd',
        'onItemDrop',
        'onMainJsonLoaded',
        'onOutfitJsonLoaded',
        'onNotFound',
        'shouldCaptureBubblingDragEvent',
    ]) {
        Object.defineProperty(HTMLElement.prototype, customPropertyName, {
            get() {
                return this[`__${ customPropertyName }`];
            },
            set(value) {
                if (!Object.prototype.hasOwnProperty.call(this, `__${ customPropertyName }`)) {
                    this.classList.add(customPropertyName);

                    if (customPropertyName === 'onResizeEnd') {
                        resizeObserver.observe(this);
                    }
                }
                this[`__${ customPropertyName }`] = value;
            },
        });
    }


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
                event.target.closest('.onWheelEnd')?.onWheelEnd?.(event);
            }
        }),
        { passive: true }
    );
}


const Trigger = {
    onItemDrop(pointerEvent) {
        const {pageX, pageY} = pointerEvent;
        const dropTarget = document.elementFromPoint(pageX, pageY);
        dropTarget.closest('.onItemDrop')?.onItemDrop?.(pointerEvent.target, dropTarget);
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


{
    const isPrimaryPointer = (event) => {
        return (event.pointerType === 'mouse' && (event.button === 0 || event.buttons === 1))
            || (event.pointerType === 'touch' && event.isPrimary);
    };

    const preventEvent = (event) => {
        event.preventDefault();
        event.stopPropagation();
    };

    const propagateDragEvent = (eventType, event, ...args) => {
        let ancestor = event.target;
        while (ancestor?.parentNode?.closest) {
            ancestor[eventType]?.(event, ...args);
            ancestor = ancestor.parentNode.closest('.shouldCaptureBubblingDragEvent');
        }
    };

    let draggingElement = null;
    let primaryPointerId = null;
    let hasDragMoved = false;

    const pointerDown = (event) => {
        if (!isPrimaryPointer(event) || draggingElement) {
            return;
        }
        getSelection().removeAllRanges();
        $('body').classList.add('pointer-pressing');
        hasDragMoved = false;

        draggingElement = event.target;
        if (draggingElement.onDragMove) {
            draggingElement.setPointerCapture(event.pointerId);
            primaryPointerId = event.pointerId;
        }
        propagateDragEvent('onDragStart', event);
    };

    const pointerMove = (event) => {
        if (draggingElement !== event.target) {
            return;
        }
        if (!isPrimaryPointer(event)) {
            if (primaryPointerId) {
                draggingElement.releasePointerCapture(primaryPointerId);
            }
            return;
        }
        // propagateDragEvent('onDragMove', event, hasDragMoved);
        event.target.onDragMove?.(event, hasDragMoved);
        hasDragMoved = true;
    };

    const pointerUp = (event) => {
        if (!isPrimaryPointer(event) || !draggingElement) {
            return;
        }
        draggingElement = null;
        primaryPointerId = null;
        $('body').classList.remove('pointer-pressing');

        const isAnyNodeSelected = () => getSelection().rangeCount > 0 && !getSelection().getRangeAt(0).collapsed;
        if (isAnyNodeSelected()) {
            return;
        }
        if (event.pointerType === 'touch') {
            for (const eventType of 'mousedown,mouseup'.split(',')) {
                document.addEventListener(eventType, preventEvent, { once: true });
            }
        }
        propagateDragEvent('onDragEnd', event, hasDragMoved);
    };

    document.addEventListener('pointerdown', pointerDown, { passive: true });
    document.addEventListener('pointermove', pointerMove, { passive: true });
    document.addEventListener('pointerup', pointerUp, { passive: true });
    document.addEventListener('pointercancel', pointerUp, { passive: true });
    document.addEventListener('lostpointercapture', pointerUp, { passive: true });

    document.addEventListener('dragstart', preventEvent);
    document.addEventListener('selectstart', (event) => {
        if (primaryPointerId !== null) {
            preventEvent(event);
        }
    });
}


HTMLCanvasElement.prototype.drawAsync = async function(src) {
    const context = this.getContext('2d');
    if (!src) {
        context.clearRect(0, 0, this.width, this.height);
        delete this.dataset.hashedSrc;
        return;
    }
    const hashize = async (message)=>[...new Uint8Array(await crypto.subtle.digest('SHA-1',new TextEncoder().encode(message)))].map(b=>b.toString(16).padStart(2,'0')).join('');
    const hashedSrc = await hashize(src);
    if (this.dataset.hashedSrc === hashedSrc) {
        return;
    }
    const image = new Image();
    image.src = src;
    await image.decode();

    this.style.width = `${ image.width }px`;
    this.style.height = `${ image.height }px`;

    const zoomScale = 4;
    this.width = image.width * zoomScale;
    this.height = image.height * zoomScale;

    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, this.width, this.height);
    this.dataset.hashedSrc = hashedSrc;
};



const popup = Util.elementize(/*html*/`
    <canvas id="popup" class="closed"></canvas>
`);
{
    Util.addStyleRules(/*css*/`
        #popup {
            z-index: 9999999;
            position: absolute;

            &.closed {
                visibility: hidden;
            }
        }
    `);

    Object.assign(popup, {
        onDragMove(event) {
            Util.moveElementToCursor(event);
        },

        onDragEnd(event, hasDragMoved) {
            if (hasDragMoved) {
                return;
            }
            if (event.offsetY <= 12 && popup.offsetWidth - event.offsetX <= 16) {
                setTimeout(() => popup.hide(), 50);
            }
        },

        moveToCursor(pointerEvent) {
            const { pageX, pageY } = pointerEvent;
            const maxLeft = $('html').clientWidth - popup.offsetWidth;
            const maxTop = $('html').clientHeight - popup.offsetHeight;

            popup.style.left = `${ Util.clampNum(0, pageX, maxLeft) }px`;
            popup.style.top = `${ Util.clampNum(0, pageY, maxTop) }px`;
            popup.show();
        },

        show() {
            popup.classList.remove('closed');
        },

        hide() {
            popup.classList.add('closed');
        },

        onWindowResizeEnd() {
            popup.hide();
        },
    });
    $('body').append(popup);
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
                touch-action: none;
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
        <span class="item-slot${ isFramed ? ' framed' : '' }${ isShadowed ? ' shadowed' : '' }">
            <canvas class="item-icon${ isFukidashi ? ' fukidashi' : '' }"></canvas>
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

    Object.assign(dragThumb, {
        onDragMove(event, hasDragMoved) {
            if (!isDraggable) {
                return;
            }
            if (!hasDragMoved) {
                popup.hide();
                const rect = dragThumb.getBoundingClientRect();
                Object.assign(dragThumb.style, {
                    left: `${ dragThumb.offsetLeft + event.pageX - rect.left - 17 }px`,
                    top: `${ dragThumb.offsetTop + event.pageY - rect.top - 17 }px`,
                    zIndex: 9999999,
                });
            }
            Util.moveElementToCursor(event);
        },

        onDragEnd(event, hasDragMoved) {
            Object.assign(dragThumb.style, {
                left: '',
                top: '',
                zIndex: '',
            });
            if (hasDragMoved && isDraggable) {
                Trigger.onItemDrop(event);
                return;
            }
            if (!hasDragMoved && dragThumb.__popupImageSrc) {
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




Create.outfit = (image, isReverse = false, isSitting = false, isAttacking = false, alt = '') => {
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
        <figure class="outfit${
            isReverse ? ' reverse': ''}${
            isSitting ? ' sitting' : ''}${
            isAttacking ? ' attacking' : ''
        }">
            <img src="${ image }" alt="${ alt }">
        </figure>
    `);

    Object.assign(rootElement, {
        replace(newImage) {
            $('img', rootElement).src = newImage;
        },
    });
    return rootElement;
};




Create.scrollableSection = (isDiscretely = false) => {
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

            &:not(.completed) .page {
                visibility: hidden;
            }
            &.completed .page:not(.active) {
                display: none;
            }
            .emoji {
                text-shadow: 1px 1px var(--view-border-color);
            }
            .comma-before-item-icon {
                margin-right: -6px;
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
    let currentPageIndex;

    const replaceChildren = (...staticElementList) => {
        const createPage = (firstChild) => {
            const page = document.createElement('div');
            page.className = 'page';
            page.append(firstChild);
            return page;
        };

        const pageMaxHeight = scrollable.clientHeight;
        scrollable.classList.remove('completed');
        Util.clearReferencesBeforeRemoval(scrollable);
        scrollable.innerHTML = '';

        let page = createPage(staticElementList.shift());
        page.classList.add('active');
        scrollable.append(page);

        for (const element of staticElementList) {
            page.append(element);
            if (page.scrollHeight > pageMaxHeight) {
                if (element.localName === 'hr') {
                    element.remove();
                    continue;
                }
                page = createPage(element);
                scrollable.append(page);
            }
        }
        scrollable.classList.add('completed');
        pages = [...scrollable.children];
        scrollbar.classList[pages.length < 2 ? 'add' : 'remove']('disabled');

        currentPageIndex = -1;
        moveThumb();
    };


    const moveThumb = (pageDelta = 0, thumbTop = null) => {
        const factor = (pages.length - 1) / maxThumbTop;
        if (factor <= 0) {
            return;
        }
        const _newIndex = (thumbTop === null)
            ? currentPageIndex + pageDelta
            : Math.round(thumbTop * factor);
        const newIndex = Util.clampNum(0, _newIndex, pages.length - 1);

        if (currentPageIndex !== newIndex) {
            currentPageIndex = newIndex;
            pages.forEach((page) => page.classList.remove('active'));
            pages[currentPageIndex].classList.add('active');
        }

        const newTop = (thumbTop === null || isDiscretely)
            ? currentPageIndex / factor
            : thumbTop;
        scrollbarThumb.style.top = `${ Util.clampNum(0, newTop, maxThumbTop) }px`;
    };


    const overwrite = (text, json) => {
        const emojiRegex = /\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu;

        const articleElement = Util.elementize('<div>' + text
            .split('\n')
            .map(line => {
                if (line) {
                    if (line.trim().startsWith('!')) {
                        return line.slice(1);
                    }
                    return `<p>${ line }</p>`;
                }
                return '<hr>';
            })
            .join('')
            .replace(emojiRegex, '<span class="emoji">$&</span>')
            .replace(/\[(.+?)\]/g, ($0, $1) => {
                const itemNames = $1.split('|');
                const shortName = itemNames[0];
                const fullName = itemNames[1] || shortName;
                return `[${ fullName }]${ shortName }`;
            })
            .replace(/(、)\[/g, ($0, $1) => {
                return `<span class="comma-before-item-icon">${ $1 }</span>[`;
            })
            + '</div>');


        const createIconFromItemName = (fullName) => {
            const item = json.items[fullName];
            const isFukidashi = item.type === 'fukidashi';
            return Create.itemSlot({
                itemImageSrc: item.icon,
                isDraggable: false,
                isFukidashi,
                isShadowed: !isFukidashi,
                popupImageSrc: item.popup,
            });
        };

        const iconizeBracketedItemName = (node) => {
            let child = node.firstChild;
            while (child) {
                const nextSibling = child.nextSibling;

                if (child.nodeType === Node.TEXT_NODE) {
                    const splitText = child.nodeValue.split(/\[(.+?)\]/g);

                    const fragment = new DocumentFragment();
                    splitText.forEach((partOfText, index) => {
                        fragment.append(index % 2 === 1
                            ? createIconFromItemName(partOfText)
                            : document.createTextNode(partOfText)
                        );
                    });
                    child.replaceWith(fragment);
                } else {
                    iconizeBracketedItemName(child);
                }
                child = nextSibling;
            }
        };
        iconizeBracketedItemName(articleElement);
        replaceChildren(...articleElement.children);
    };


    let swipeStartY = null;

    Object.assign(scrollable, {
        onResizeEnd,
        shouldCaptureBubblingDragEvent: true,

        onDragStart(event) {
            swipeStartY = (event.pointerType === 'touch' && !event.target.matches('.item-icon'))
                ? event.pageY
                : null;
        },
        onDragEnd(event) {
            if (swipeStartY === null) {
                return;
            }
            const swipeDeltaY = swipeStartY - event.pageY;
            swipeStartY = null;

            const minSwipeDeltaY = 40;
            if (Math.abs(swipeDeltaY) > minSwipeDeltaY) {
                moveThumb(Math.sign(swipeDeltaY));
            }
        },
    });

    Object.assign(scrollbar, {
        onDragEnd(event) {
            const clickedBarTop = event.offsetY;
            if (0 <= clickedBarTop && clickedBarTop <= maxThumbTop) {
                moveThumb(0, clickedBarTop);
            } else {
                moveThumb(Math.sign(clickedBarTop));
            }
        },
    });

    Object.assign(scrollbarThumb, {
        onDragMove(event) {
            moveThumb(0, scrollbarThumb.offsetTop + event.movementY);
        },
    });

    Object.assign(rootElement, {
        onWheelEnd(event) {
            moveThumb(Math.sign(event.deltaY));
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
        @media (width < 540px) {
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

    const outfit = Create.outfit(`/images/character/${ thumbnail }.webp`);
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
                flex-direction: column;
                background-color: var(--view-background-color);
                border: 3px solid var(--view-border-color);
                border-radius: var(--view-radius);
                color: var(--view-border-color);

                &.closed {
                    display: none;
                }
                &.horizontally-center {
                    position: absolute;
                    margin: 0 auto;
                    left: -999%;
                    right: -999%;
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
                }
                >section {
                    margin: 5px;
                    flex-grow: 1;
                }
            }
        `);

        const rootElement = Util.elementize(/*html*/`
            <article id="${ id }" class="view closed">
                <h2>${ title }</h2>
                <section></section>
            </article>
        `);
        if (isHorizontallyCentered) {
            rootElement.classList.add('horizontally-center');
        }


        Object.assign($('h2', rootElement), {
            onDragMove(event) {
                Util.moveElementToCursor(event, rootElement);
            },
        });

        Object.assign(rootElement, {
            shouldCaptureBubblingDragEvent: true,

            onDragStart() {
                rootElement.style.zIndex = topMostZIndex++;
            },

            onWindowResizeEnd() {
                Object.assign(rootElement.style, {
                    left: '',
                    top: '',
                });
            },

            open() {
                rootElement.classList.remove('closed');
            },
            close() {
                rootElement.classList.add('closed');
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