//features for nodes, nodes lists and objects
Element.prototype.remove = function () {
    this.parentElement.removeChild(this);
};
NodeList.prototype.remove = HTMLCollection.prototype.remove = function () {
    for (let i = this.length - 1; i >= 0; i--)
        this[i].parentElement.removeChild(this[i]);
};
Array.prototype.equals = function (array) {
    // if the other array is a falsy value, return,  compare lengths - can save a lot of time 
    if (!array || this.length != array.length)
        return false;

    for (var i = 0, l = this.length; i < l; i++) {
        // Check if we have nested arrays
        if (this[i] instanceof Array && array[i] instanceof Array) {
            // recurse into the nested arrays
            if (!this[i].equals(array[i]))
                return false;
        }
        else if (this[i] != array[i]) {
            // Warning - two different object instances will never be equal: {x:20} != {x:20}
            return false;
        }
    }
    return true;
}

//item class declaration
let Item = function (id, aliases = [], isItemLinkToWeb = false, folder = "/" + id, title, tileImage, tileContent, createDate, modifyDate, groups = [], arg = {}) {
    return {
        id,
        aliases,
        title,
        tile: {
            image: tileImage,
            content: tileContent
        },
        createDate,
        modifyDate,
        groups,
        isItemLinkToWeb,
        folder,
        arg,
        type: GLOBAL.item
    }
}

//resource map class declaration
let ResourceMap = function (resource, hash, firstGroupIndex, lastGroupIndex) {
    return {
        resource,
        hash,
        firstGroupIndex,
        lastGroupIndex
    }
}

//item date class declaration
let ItemDate = function (day, month, year) {
    this.toHTMLString = function (months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
    ]) {
        return (this.day + "&nbsp;" + months[this.month - 1] + ",&nbsp;" + this.year)
    }
    let _today = new Date();
    this.day = day || _today.getDate();
    this.month = month || _today.getMonth() + 1;
    this.year = year || _today.getFullYear();
};

//group class declaration
let Group = function (id, aliases = [], title, createDate, modifyDate, groups = [], arg = {}, isDefault = false) {
    return {
        id,
        aliases,
        arg,
        title,
        groups,
        isDefault,
        createDate,
        modifyDate,
        type: GLOBAL.group
    }
}

//view class declaration
let View = function (id, url, data = {}, event = {}, rootNode = null, isRegisterDelayed = false, loadingMode = ViewController.loadingModes.single) {
    return {
        id,
        url,
        data,
        event,
        rootNode,
        isRegisterDelayed,
        loadingMode
    }
}

//history item class declaration
let HistoryItem = function (id, index, arg) {
    return {
        id,
        index,
        arg
    }
}

//error class declaration
let ErrorClass = function (id, title, message, triggerErrorsList = [], refreshRequire = true) {
    return {
        id,
        title,
        message,
        triggerErrorsList,
        refreshRequire
    }
}

//hashing algorythm
const createHash = function (str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    let _s = 4294967296 * (2097151 & h2) + (h1 >>> 0);
    return _s;
};

//controllers declarations
let ViewController = (function () {
    let _controller = {};
    let _views = [];
    let _currentHistoryIndex = -1;
    let _defaultViewHistoryIndex = -1;
    let _defaultView;
    let _currentView;
    let _previousView;
    EventController.call(_controller, ["navigateToView", "navigationRequest", "navigateFromView", "navigateDefault", "historyEdit"]);

    //integrated error controller
    let _errors = [];
    let _errorHistory = [];
    let _currentGlobalError;

    _controller.addError = function (error) {
        if (_errors.findIndex((_error) => error.id == _error.id) == -1)
            _errors.push(error);
    }
    _controller.invokeError = function (errorId, globalInvoke = false) {
        let __error = _errors.find((_error) => (errorId == _error.id) || (errorId.id == _error.id));
        let _errorCanBeInvoked = true;
        __error.triggerErrorsList.forEach((err) => {
            if (_errorHistory.includes(err))
                _errorCanBeInvoked = false;
        });
        if (_errorCanBeInvoked) {
            if (globalInvoke) {
                _views.forEach((view) => view.registered ? view.event?.onError.call(view, __error) : "");
                _currentGlobalError = __error;
            }
            else
                _currentView.event?.onError.call(_currentView, __error);
            _errorHistory.push(__error.id);
        }
    }
    //view controller methods
    let _getViewById = (id) => _views.find((view) => view.id == id) || _defaultView;
    let _registerDelayedView = function (view) {
        if (view.isRegisterDelayed && !view.registered) {
            if (_currentGlobalError)
                view.event?.onError.call(view, _currentGlobalError);
            view.event.onRegister?.call(view);
            view.registered = true;
        }
    }
    let _generateRootNode = function (view) {
        if (typeof (view.rootNode) == "string")
            view.rootNode = getById(view.rootNode);
    }
    let _unLoadView = function (view) {
        if (view.loadingMode == _controller.loadingModes.always)
            view.isLoaded = false;
    }
    let _invokeLoadEvent = async function (view, arg) {
        if (!view.isLoading && !view.isLoaded) {
            view.isLoading = true;
            await view.event.onLoad?.call(view, arg);
        }
        return view;
    }
    let _invokeLoadFinishEvent = async function (view) {
        if (view.isLoading && !view.isLoaded) {
            view.isLoading = false;
            view.isLoaded = true;
            await view.event.onLoadFinish?.call(view);
        }
    }
    _controller.navigate = async function (id, arg = {}) {

        _controller.invokeEvent("navigationRequest", [id, _currentView]);
        let _lastRouteArg = _currentView?.lastNavigationArguments?.routeArg || [];
        if (id == _currentView?.id && (_lastRouteArg.equals(arg.routeArg || [])))
            return;
        //getting view
        let _target = _getViewById(id);

        //unloading old view if exist
        if (_currentView) {
            //finishing loading view if needed, unloading and generating node if needed
            _invokeLoadFinishEvent(_currentView);
            _unLoadView(_currentView);
            _generateRootNode(_currentView);

            //navigating
            _currentView.event.onNavigateFrom?.call(_currentView, arg);
            _controller.invokeEvent("navigateFromView", [_currentView, arg]);
            _previousView = _currentView;
        }

        //changing url and adding history state
        if (!arg.noHistoryPush) {
            _currentHistoryIndex++;
            if (_target == _defaultView)
                _defaultViewHistoryIndex = _currentHistoryIndex;

            //invoking history edit event
            _controller.invokeEvent("historyEdit", [
                Object.assign(new HistoryItem(_target.id, _currentHistoryIndex, {
                    routeArg: arg.routeArg,
                    historyArg: arg.historyArg
                }), {
                    defaultViewHistoryIndex: _defaultViewHistoryIndex
                }), _target]
            );
        }

        //setting current view
        _currentView = _target;
        _currentView.lastNavigationArguments = arg;
        _generateRootNode(_currentView);

        //registering and invoking navigate event
        await _registerDelayedView(_currentView);
        _controller.invokeEvent("navigateToView", [_currentView, _previousView, arg]);
        await _currentView.event.onNavigate?.call(_currentView, arg);

        //loading view if needed
        if (_currentView.loadingMode != _controller.loadingModes.never)
            await _invokeLoadEvent(_currentView, arg).then((view) => _invokeLoadFinishEvent(view))
    }
    _controller.register = async function (view, isDefault = false) {
        _views.push(view);
        if (!view.isRegisterDelayed)
            view.event.onRegister?.call(view);
        if (isDefault) _defaultView = view;
    }
    _controller.navigateToDefaultView = function (arg) {
        if (_currentView != _defaultView)
            _controller.invokeEvent("navigateDefault", [arg]);
    }
    _controller.back = function () {
        if (history.state.index == 0)
            _controller.navigateToDefaultView();
        else
            history.back();
    }
    _controller.moveModes = {
        forward: 1,
        back: 0
    }
    _controller.loadingModes = {
        single: "single",
        always: "always",
        never: "never"
    }
    _controller.navigateFromHistory = function (historyItem) {
        _currentHistoryIndex = historyItem.index;
        _defaultViewHistoryIndex = historyItem.defaultViewHistoryIndex;
        _controller.navigate(historyItem.id, Object.assign({
            noHistoryPush: true
        }, historyItem.arg));
    }
    Object.defineProperties(_controller, {
        currentHistoryIndex: {
            get: () => _currentHistoryIndex
        }
    });
    return _controller;
}());
let ItemController = (function () {
    let _routes = [];
    let _storage = [];
    let _itemsLoaded = false;
    let _groupRoutes = [];
    let _groupsLoaded = false;
    let _defaultGroup;
    let _controller = {};
    EventController.call(_controller, ["fetchGroup", "fetchGroupFinish", "fetchItem", "fetchItemFinish"]);

    //adding error types for item and group not errors
    ViewController.addError(new ErrorClass("item_not_found", "Item don't exist", "We don't have what you're looking for", [
        "item_outdated",
        "item_load_error",
        "group_not_found"
    ]));
    ViewController.addError(new ErrorClass("group_not_found", "Group don't exist", "We don't have what you're looking for", [
        "item_outdated",
        "item_load_error"
    ]));
    ViewController.addError(new ErrorClass("item_not_fetched", "Item cannot be loaded", "Check your internet connection"));
    let _getResourceGroupByHash = function (item, hash) {
        let target = item.resources.find((resMap) => resMap.hash == hash);
        return target ? {
            resource: target,
            group: item.resources.slice(target.firstGroupIndex, target.lastGroupIndex + 1)
        } : null;
    }
    let _downloadViaAJAX = async function (item) {
        return new Promise((resolve, reject) => {
            let xmlhttp = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");

            //loading item content
            xmlhttp.onreadystatechange = function () {
                if (this.readyState == 4) {
                    if (this.status == 200)
                        resolve(JSON.parse(this.responseText));
                    else {
                        ViewController.invokeError("item_not_fetched", false);
                        reject("Error in AJAX request");
                    }
                }
            };

            //sending
            xmlhttp.open("GET", APP.itemFolder + item.folder + APP.resourceFolder + APP.itemContentFileName, true);
            xmlhttp.send();
        });
    }
    //loading full item content
    let _loadFullItem = async function (item) {
        if (!item) {
            ViewController.invokeError("item_not_found");
            return;
        }

        //TODO: check is components.js and components.css are downloaded id not -> download
        if (!item.isItemLinkToWeb && !item.isContentCached) {
            //getting item content
            let _content = await _downloadViaAJAX(item, item.folder);

            //TODO: check content component version if newer -> download new version of components.css and js

            //merging item with item
            Object.assign(item, _content, { resources: [] });

            //pushing resources to resourcesList of item
            item.resources.push(new ResourceMap({
                src: APP.itemContentFileName
            }, "", 0, 0));
            item.content.forEach((component, componentIndex) => {
                if (component.resource) {
                    component.resIndex = item.resources.length;
                    component.resLastIndex = item.resources.length + component.resource.length - 1;

                    component.resource.forEach(res => item.resources.push(new ResourceMap(res, createHash(componentIndex + component.resIndex + item.folder + res.src), component.resIndex, component.resLastIndex)))
                }
            });

            //adding method for finding resources by hash code
            item.findResourceByHash = (hash) => _getResourceGroupByHash(item, hash);
            if (_content?.version == APP.version)
                item.isContentCached = true;
        }
        return item;
    }
    let _generateId = (id) => encodeURIComponent(id.toLowerCase().replaceAll(" ", "-"));
    let _generateGroup = function (group) {
        group.content = [];
        group.id = group.id || _generateId(group.title);
        _groupRoutes.push(new Route(group.id, group));
        return group;
    }
    let _getGroupByRoute = (id) => _groupRoutes.find((route) => route.source == id)?.target;
    let _getItemByRoute = (id) => _routes.find((route) => route.source == id)?.target;
    _controller.fetchGroups = async function (groups) {
        await Promise.all(groups.map(async (group) => {
            _generateGroup(group);
            _storage.push(group);
            group.aliases.forEach((source) => _groupRoutes.push(new Route(source, group)));
            if (group.isDefault)
                _defaultGroup = group;
            await _controller.invokeEvent("fetchGroup", [group]);
        }));
        _storage.forEach((group) => group.groups?.forEach((_group) => _getGroupByRoute(_group)?.content.push(group)));
        await _controller.invokeEvent("fetchGroupFinish");
        _groupsLoaded = true;
    }
    _controller.fetchItems = async function (items) {
        await Promise.all(items.map(async (item) => {
            item.id = item.id || _generateId(item.title);
            _routes.push(new Route(item.id, item));
            _defaultGroup.content.push(item);
            item.aliases.forEach((source) => _routes.push(new Route(source, item)));
            item.groups?.forEach((group) => _getGroupByRoute(group)?.content.push(item));
            await _controller.invokeEvent("fetchItem", [item]);
        }));
        await _controller.invokeEvent("fetchItemFinish", []);
        _itemsLoaded = true;
    }
    _controller.loadModes = {
        group: "group",
        item: "item",
        allItems: "allitems",
        all: "all"
    }
    Object.defineProperties(_controller, {
        storage: {
            get: () => _storage
        },
        isItemsLoaded: {
            get: () => _itemsLoaded
        },
        isGroupsLoaded: {
            get: () => _groupsLoaded
        },
        getItemSnapshotById: {
            value: _getItemByRoute
        },
        getGroupById: {
            value: _getGroupByRoute
        },
        getItemById: {
            value: async (id) => await _loadFullItem(_getItemByRoute(id))
        }
    });
    return _controller;
}());

const landingView = new View(VIEW.landing, APP.url.landing, { scrollY: -1, itemsLoaded: false }, {
    onNavigate: function () {
        if (this.data.scrollY >= 0)
            window.scroll(0, this.data.scrollY)
        document.title = APP.name;
    },
    onRegister: function () {
        let _pButton = getById("profile-link-button");
        _pButton.href = APP.url.profile;
        _pButton.addEventListener("click", () => {
            event.preventDefault();
            ViewController.navigate(VIEW.profile);
        });
        this.data.iList = getById("main-list");
    },
    onNavigateFrom: function () {
        this.data.scrollY = window.scrollY;
        this.rootNode.classList.remove(GLOBAL.error);
    },
    onLoadFinish: function () {
        this.rootNode.classList.remove(GLOBAL.loading);
        this.data.iList.getElementsByClassName(GLOBAL.dataNode + " no-data").remove();
    },
    onLoad: async function () {
        this.rootNode.classList.add(GLOBAL.loading);
        if (ItemController.isItemsLoaded && ItemController.isGroupsLoaded)
            StorageResponseBuilder(await ItemController.getGroupById("landing"), this.data.iList, 1, -1)
    },
    onError: function (err) {
        this.rootNode.classList.add(GLOBAL.error);
        createErrorMsg(err, getById("landing-error-node"));
    }
}, VIEW.landing, true, ViewController.loadingModes.single);

const profileView = new View(VIEW.profile, APP.url.profile, {}, {
    onNavigate: () => {
        window.scroll(0, 0);
        document.title = "About me - " + APP.name
    }
}, VIEW.profile, false, ViewController.loadingModes.never);

const itemView = new View(VIEW.item, APP.url.item, { currentItem: null }, {
    onNavigate: () => window.scroll(0, 0),
    onNavigateFrom: function () {
        this.rootNode.classList.remove(GLOBAL.error);
    },
    onRegister: function () {
        //getting nodes
        this.data.iTitle = getById("item-title");
        this.data.iContent = getById("item-content");
        this.data.iInfo = getById("item-info");
    },
    onLoad: async function (arg) {
        this.rootNode.classList.add(GLOBAL.loading);
        if (ItemController.isItemsLoaded) {
            //getting item
            let item = await ItemController.getItemById(arg.routeArg[0]);
            if (!item || this.data.currentItem == item)
                return;
            if (item.isItemLinkToWeb) {
                window.open(item.isItemLinkToWeb, '_blank').focus();
                ViewController.navigateToDefaultView();
                return;
            }
            this.data.currentItem = item;

            //preparing item info
            document.title = item.title + " - " + APP.name;
            this.data.iTitle.innerHTML = item.title;
            this.data.iInfo.innerHTML = item.createDate.toHTMLString() + ((item.modifyDate) ? " <u class='dotted-separator'></u> Updated " + item.modifyDate.toHTMLString() : "");

            //preparing content
            this.data.iContent.innerHTML = "";
            item.content.forEach((content) =>
                this.data.iContent.append(new ItemComponentBuilder(content, item.folder, item)));
            incrementVisitors(APP.itemFolder + "/" + item.id, true);
        }
    },
    onLoadFinish: function () {
        this.rootNode.classList.remove(GLOBAL.loading);
    },
    onError: function (err) {
        this.rootNode.classList.add(GLOBAL.error);
        createErrorMsg(err, getById("item-error-node"));
    }
}, VIEW.item, true, ViewController.loadingModes.always);

const groupView = new View(VIEW.group, APP.url.group, { scrollY: -1 }, {
    onRegister: function () {
        let _data = this.data;
        _data.groupData = getById("group-data")
        _data.groupList = getById("group-list");
        _data.groupTitle = getById("group-title");
        _data.groupInfo = getById("group-info");
    },
    onNavigate: () => window.scroll(0, 0),
    onNavigateFrom: function () {
        Array.prototype.forEach.call(this.data.groupList.getElementsByClassName(GLOBAL.dataNode), (node) =>
            node.classList.add("loading", "no-data"));
        this.rootNode.classList.remove(GLOBAL.error);
    },
    onLoad: async function (arg) {
        this.rootNode.classList.add(GLOBAL.loading);
        this.data.groupData.classList.add(GLOBAL.loading);

        //getting group
        let group = await ItemController.getGroupById(arg.routeArg[0]);
        if (!group) {
            ViewController.invokeError("group_not_found");
            return;
        }

        //preparing group info
        this.data.currentGroup = group;
        this.data.groupTitle.innerHTML = group.title;
        document.title = group.title + " - " + APP.name;
        this.data.groupInfo.innerHTML = group.createDate.toHTMLString() + " <u class='dotted-separator'></u> " + group.content.length + "&nbsp;" + (group.content.length != 1 ? "items" : "item");
        this.data.groupData.classList.remove(GLOBAL.loading);

        //loading items of group
        await StorageResponseBuilder(group, this.data.groupList, 1, -1);
    },
    onLoadFinish: function () {
        this.rootNode.classList.remove(GLOBAL.loading);
        this.data.groupList.getElementsByClassName("no-data").remove();
    },
    onError: function (err) {
        this.rootNode.classList.add(GLOBAL.error);
        createErrorMsg(err, getById("group-error-node"));
    }
}, VIEW.group, true, ViewController.loadingModes.always);

const resourceView = new View(VIEW.resource, APP.url.resource, {},
    {
        onNavigate: function () {
            document.title = "Gallery - " + APP.name
        },
        onRegister: function () {
            //adding image errors
            ViewController.addError(new ErrorClass("image_not_found", "Image not found", "Try refresh page", [
                "item_not_found",
                "item_outdated",
                "item_load_error"
            ], true));
            let _sender = this;

            //creating slider
            this.data.resSlider = new ResourceSlider();

            //getting nodes
            let _resList = this.data.resList = getById("image-viewer-list");
            let _prevBtn = getById("image-viewer-prev");
            let _nextBtn = getById("image-viewer-next");
            _nextBtn.addEventListener("click", this.data.resSlider.next);
            _prevBtn.addEventListener("click", this.data.resSlider.previous);

            //adding close button
            getById("image-viewer-close").addEventListener("click", ViewController.back);

            //adding event to slider
            this.data.resSlider.addEventListener("render", function (res, index, oldres, old) {
                _resList.children[index].classList.add(GLOBAL.activeView);
                _resList.children[old]?.classList.remove(GLOBAL.activeView);
                history.replaceState(history.state, '', "/" + _sender.url + "/" + _sender.data.currentItem.id + "/" + res.hash);
            });
            this.data.resSlider.addEventListener("load", async function (res) {
                await new Promise((resolve) => {
                    let _img = document.createElement("IMG");
                    _img.src = APP.itemFolder + _sender.data.currentItem.folder + APP.resourceFolder + res.resource.src;
                    _resList.appendChild(_img);
                    _img.onload = resolve;
                    _img.onerror = function () {
                        _img.src = "/img/image_error.webp";
                    };
                });
            });
            this.data.resSlider.addEventListener("loadFinish", function (res) {
                _nextBtn.classList.toggle(GLOBAL.disabled, res.length < 2);
                _prevBtn.classList.toggle(GLOBAL.disabled, res.length < 2);
            })
            this.data.resSlider.addEventListener("close", () => _resList.innerHTML = "");

            GestureBuilder(this.rootNode, {
                right: this.data.resSlider.next,
                left: this.data.resSlider.previous
            });
        },
        onLoad: async function (arg) {

            //setting timeout for loading animation
            setTimeout(function (_sender) {
                if (!_sender.isLoaded)
                    _sender.rootNode.classList.add(GLOBAL.loading);
            }, 300, this);

            //loading item and resource group
            this.data.currentItem = arg.currentItem || await ItemController.getItemById(arg.routeArg[0]);
            let resourceGroup = this.data.currentItem.findResourceByHash(arg.routeArg[1]);
            if (!resourceGroup) {
                ViewController.invokeError("image_not_found", false);
                return;
            }

            //loading resources to slider
            await this.data.resSlider.loadResources(resourceGroup.group, resourceGroup.resource);
        },
        onLoadFinish: function () {
            this.rootNode.classList.remove(GLOBAL.loading);
        },
        onNavigateFrom: function () {
            this.rootNode.classList.remove(GLOBAL.error);
            this.data.resSlider.close();
        },
        onError: function (err) {
            this.rootNode.classList.add(GLOBAL.error);
            createErrorMsg(err, getById("resources-error-node"));
        }
    }, VIEW.resource, true, ViewController.loadingModes.always);

//registering views
ViewController.register(landingView, true);
ViewController.register(profileView);
ViewController.register(itemView);
ViewController.register(groupView);
ViewController.register(resourceView);

//view controller events
ViewController.addEventListener("historyEdit", (historyItem, view) => {
    //url params are getted from navigation controller from navigate() arg
    let _url = "/" + view.url + ((historyItem.arg.routeArg?.length > 0) ? ("/" + (historyItem.arg.routeArg?.join('/') || '')) : "");
    if (historyItem.index == 0)
        history.replaceState(historyItem, '', _url)
    else
        history.pushState(historyItem, '', _url);
});
ViewController.addEventListener("navigationRequest", hideNavigation);
ViewController.addEventListener("navigateDefault", (arg) =>
    (history.state.defaultViewHistoryIndex != -1 && (history.state.defaultViewHistoryIndex - history.state.index) != 0) ? history.go(history.state.defaultViewHistoryIndex - history.state.index) : ViewController.navigate(null, arg));
ViewController.addEventListener("navigateToView", (view, lastView) => {
    view.rootNode.classList.add(GLOBAL.activeView);
    APP_NODE.classList.replace(lastView?.id, view.id);
    document.body.classList.toggle("scroll-fix", !isScrollbarVisible());
    setNavigationState(false);
});
ViewController.addEventListener("navigateFromView", (lastView) => lastView.rootNode.classList.remove(GLOBAL.activeView));

//DOM events
window.addEventListener("load", async function () {
    //adding errors
    ViewController.addError(new ErrorClass("item_load_error", "Items cannot be loaded", "Try refreshing the page"));
    ViewController.addError(new ErrorClass("item_outdated", "Items are outdated", "Try refreshing the page"));

    //adding home button event, removing first-start DOM indicator
    getById("home-button").addEventListener("click", () => ViewController.navigateToDefaultView());
    getById("main-header-about-button").addEventListener("click", (e) => {
        e.preventDefault();
        ViewController.navigate(VIEW.profile);
    });
    getById("main-header-work-button").addEventListener("click", (e) => {
        e.preventDefault();
        ViewController.navigate(VIEW.group, { routeArg: ["work"] });
    });

    //loading items and groups
    try {
        if (APP.version != ITEM_VERSION)
            ViewController.invokeError("item_outdated", true);
        else
            await ItemController.fetchGroups(getGroups()).then(() => ItemController.fetchItems(getItems()));
    } catch {
        ViewController.invokeError("item_load_error", true);
    }

    //navigating to view based by url or by history state
    if (history.state)
        ViewController.navigateFromHistory(history.state);
    else
        await ViewController.navigate(START_ROUTE.target, {
            routeArg: START_URL.slice(1, START_URL.length - 1)
        });
});
window.addEventListener("popstate", (event) =>
    ViewController.navigateFromHistory(event.state));
window.onresize = () =>
    document.body.classList.toggle("scroll-fix", !isScrollbarVisible());

//check if scrollbar is visible
let isScrollbarVisible = (element = document.body) => element.scrollHeight > element.clientHeight;

//item tile creating method
let createItemTile = async function (node, item) {
    if (node.nodeName != "A") {
        let oldNode = node;
        node = document.createElement("A");
        oldNode.parentElement.replaceChild(node, oldNode);
    }
    node.className = "item " + GLOBAL.dataNode + " " + GLOBAL.loading;
    node.innerHTML = "<div class='img'><img src='" + APP.itemFolder + item.folder + item.tile.image + "' alt='" + item.title + "'/></div><b class='font-subtitle'>" + item.title + "</b><span class='font-base'>" + item.tile.content + "</span><div class='labels'><div class='button'>" + (item.isItemLinkToWeb ? "Open link <i class='mi mi-OpenInNewWindow'></i>" : "Read more <i class='mi mi-BackMirrored'></i>") + "</div>" + (item.modifyDate ? "<div class='label font-caption'><i class='mi mi-Update'></i> &nbsp;&nbsp;" + item.modifyDate.toHTMLString() + "</div>" : "") + "</div>";

    //loading image of tile
    let _iImage = node.children[0].children[0],
        imageLoaded = function () {
            if (!item.isTileImageNotLoaded) {
                if (item.arg.tileImageStyle)
                    _iImage.style = item.arg.tileImageStyle;
                cacheResource(APP.itemFolder + item.folder + item.tile.image);
            }
        }, imageIsNotLoaded = function () {
            item.isTileImageNotLoaded = true;
            _iImage.src = "/img/image_error.webp";
            _iImage.onload = function () { }
        }
    await new Promise((resolve) => {
        _iImage.onload = () => resolve(imageLoaded());
        _iImage.onerror = () => resolve(imageIsNotLoaded());
    });

    //settings up events
    node.classList.replace(GLOBAL.loading, GLOBAL.loaded);
    node.onclick = function () {
        event.preventDefault();
        item.isItemLinkToWeb ?
            window.open(item.isItemLinkToWeb, '_blank').focus()
            :
            ViewController.navigate(VIEW.item, { routeArg: [item.id] });
    };
    node.href = item.isItemLinkToWeb || APP.url.item + item.id;

    //loading item
    setTimeout(() => node.classList.remove(GLOBAL.loaded), 300);
    return node;
}

//group tile creating method
let createGroupTile = function (node, group) {
    if (node.nodeName != "DIV") {
        let oldNode = node;
        node = document.createElement("DIV");
        oldNode.parentElement.replaceChild(node, oldNode);
    }
    node.className = "group " + GLOBAL.dataNode;
    node.innerHTML = "<span class='font-title'></span><a class='button'><i class='mi mi-ShowAll'></i> <span>Show all</span></a>";
    node.children[0].innerHTML = group.title;

    //settings up tile events
    node.children[1].onclick = function () {
        event.preventDefault();
        ViewController.navigate(VIEW.group, { routeArg: [group.id] });
    };
    node.children[1].href = APP.url.group + group.id;
    return node;
}

//universal slider class for resourceMap objects
let ResourceSlider = function () {
    let _res = [];
    let _currentIndex;
    let _oldIndex;
    EventController.call(this, ["load", "loadFinish", "next", "previous", "render", "remove", "close"]);
    let _sender = this;
    let _renderIndex = async function (index) {
        _oldIndex = _currentIndex;
        _currentIndex = index;
        await _sender.invokeEvent("render", [_res[_currentIndex], _currentIndex, _res[_oldIndex], _oldIndex]);
    }
    this.loadResources = async function (resourcesList, current) {
        _res = resourcesList;
        await Promise.all(_res.map(async (res, index) => await _sender.invokeEvent("load", [res, index])));
        _renderIndex(current ? _res.findIndex((res) => res == current) : 0);
        await this.invokeEvent("loadFinish", [_res]);
    }
    this.close = async () => {
        _oldIndex = -1;
        _currentIndex = -1;
        await _sender.invokeEvent("close", [_res[_currentIndex], _currentIndex])
    };
    this.next = async function () {
        let _index = _currentIndex + 1;
        if (_index >= _res.length)
            _index = 0;
        if (_currentIndex == _index)
            return;
        await _renderIndex(_index);
        await _sender.invokeEvent("next", [_res[_currentIndex], _index])
    }
    this.previous = async function () {
        let _index = _currentIndex - 1;
        if (_index < 0)
            _index = _res.length - 1;
        if (_currentIndex == _index)
            return;
        await _renderIndex(_index);
        await _sender.invokeEvent("previous", [_res[_currentIndex], _index])
    }
    Object.defineProperties(this,
        {
            currentIndex:
            {
                get: () => _currentIndex
            }
        }
    )
}

//gesture support for element
let GestureBuilder = function (node, event = {}) {

    const _directions = {
        up: "up",
        down: "down",
        left: "left",
        right: "right"
    };

    let _startPos = {};
    let _endPos = {};

    let _directionSolver = function (startX, startY, endX, endY) {
        let _isVertical = (Math.abs(endX - startX) < Math.abs(endY - startY))
        if (startX < endX && !_isVertical)
            return _directions.left;
        if (endX < startX && !_isVertical)
            return _directions.right;
        if (startY < endY && _isVertical)
            return _directions.up;
        if (endY < startY && _isVertical)
            return _directions.down;
    }
    node.addEventListener("touchstart", (e) => {
        _startPos.x = e.touches[0].clientX;
        _startPos.y = e.touches[0].clientY;
    });

    node.addEventListener("touchend", (e) => {
        _endPos.x = e.changedTouches[0].clientX;
        _endPos.y = e.changedTouches[0].clientY;
        let _direction = _directionSolver(_startPos.x, _startPos.y, _endPos.x, _endPos.y);
        event[_direction]?.call(node);
    });

}

//storage response indexer for group and landing views
let StorageResponseIndexer = function (response, depth = 1, limit = 3, startIndex = 0, limitOfDepth = 3) {
    let _indexedItems = [];
    response.content?.forEach((entry, index) => {
        if (entry.type == GLOBAL.group) {
            if (depth > 0) {
                _indexedItems.push({ index: startIndex, entry: entry });
                _indexedItems = _indexedItems.concat(StorageResponseIndexer(entry, depth - 1, limitOfDepth, startIndex + 1));
                startIndex = _indexedItems[_indexedItems.length - 1].index + 1;
            }
        } else {
            if (((limit > 0) && (!entry.isIndexed || (response.content.length - index) <= limit)) || limit == -1) {
                entry.isIndexed = true;
                _indexedItems.push({ index: startIndex, entry: entry });
                if (limit > 0)
                    limit -= 1;
                startIndex += 1;
            }
        }
    });
    return _indexedItems;
}

//storage response nodes builder for landing and group views
let StorageResponseBuilder = async function (response, targetNode = document.createElement("DIV"), depth = 1, limit = 3) {
    let _items = [...targetNode.getElementsByClassName(GLOBAL.dataNode)];
    let _indexedItems = StorageResponseIndexer(response, depth, limit, 0);
    await Promise.all(_indexedItems.map(async (entry) => {
        entry.entry.isIndexed = false;
        entry.entry.type == GLOBAL.group ?
            await createGroupTile(_items[entry.index] || targetNode.appendChild(document.createElement("div")), entry.entry)
            :
            await createItemTile(_items[entry.index] || targetNode.appendChild(document.createElement("a")), entry.entry);
    }));
}

//error message node builder
let createErrorMsg = function (err, node) {
    node.innerHTML = `<i class='mi mi-Error font-header'></i><div class='font-title'>` + err.title + `</div><span class='font-base'>` + err.message + `</span>`;
    if (err.refreshRequire) {
        let _but = document.createElement("A");
        _but.classList.add("button")
        _but.innerHTML = "<i class='mi mi-Refresh'></i><span>Refresh page</span>";
        _but.addEventListener("click", () => window.location.reload(true));
        node.appendChild(_but);
    }
}