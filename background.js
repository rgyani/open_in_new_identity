const _prefix = "_@@@_";

createContextMenu();
chrome.runtime.onMessage.addListener(data => {
    // IF we get a message from Popup UI to update the Identities, we store it
    // and refresh the context  menu items
    if (data.type === 'notification') {
        chrome.storage.sync.set({ identities: data.message });
        createContextMenu();
    }
});

chrome.runtime.onInstalled.addListener(() => {
    // On install, store the default identities and create context menu items
    console.log("on installed, creating context menu");
    createContextMenu();
});

function createContextMenu() {
    // Clear exiting menu items
    chrome.contextMenus.removeAll();
    // And create context menus for "Identities"
    chrome.storage.sync.get(['identities'], (identities) => {
        if (identities === undefined || identities["identities"] === undefined) {
            console.log("nothing found");
            identities = "DEV\nQA\nPROD\nTooling";
            chrome.storage.sync.set({ identities: identities });
        }
        else
            identities = identities["identities"];

        identities.split("\n").forEach((item) => {
            chrome.contextMenus.create({
                id: item,
                title: `Open in ${item} Identity`,
                contexts: ["page", "image", "link"]
            });
        });
    });
}

// The current identity we are working with
var currentIdentity;
// A map of chrome tabID to the identity we are using on that tab
var tabIdToIdentityMap = []
// The current chrome window
var currentWindow;
// The current chrome tab
var currentTabId;

chrome.contextMenus.onClicked.addListener((info, tab) => {
    // When a menu item is clicked,
    // We get the identityID and open a new tab with that identity
    var file = info.pageUrl;
    if (info.linkUrl)
        file = info.linkUrl;


    chrome.tabs.create({
        url: file
    }, function (props) {
        //Store the mapping, update badge
        mapTabIdToIdentity(props.id, info.menuItemId + _prefix)
    });
});


function mapTabIdToIdentity(tabId, identityInfo) {
    if (identityInfo) {
        //Store the mapping, update badge and wait for chrome events
        tabIdToIdentityMap[tabId] = identityInfo;
        setBadgeInfo(tabId, identityInfo);
    }
}


function setBadgeInfo(tabId, identityInfo) {
    // Update badge text
    var data = {
        text: identityInfo == undefined || identityInfo == "" ? "" : identityInfo.substr(0, identityInfo.indexOf(_prefix)),
        tabId: tabId
    };

    chrome.browserAction.setBadgeText(data);
}


function getIdentity(tabId) {
    if (tabId > 0) {
        return !tabIdToIdentityMap[tabId] ? "" : tabIdToIdentityMap[tabId];
    }
}

function getCurrentWindowAndTabId(e) {
    if (e && e > -1) {
        chrome.windows.get(e, {}, function (row) {
            if (row) {
                if ("normal" == row.type) {
                    currentWindow = e;
                    chrome.tabs.query({
                        active: true,
                        windowId: currentWindow
                    }, function (results) {
                        currentTabId = results[0].id;
                    });
                }
            }
        });
    }
}

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
    var identityInfo = getIdentity(removedTabId);
    mapTabIdToIdentity(addedTabId, identityInfo);
    delete mapTabIdProfileName[removedTabId];
    setBadgeInfo(addedTabId, identityInfo);
});

chrome.tabs.onUpdated.addListener((tabId, e, jqXHR) => {
    //When opening a tab, if its loading, we set the badge text
    if ("loading" == jqXHR.status)
        mapTabIdToIdentity(tabId, getIdentity(tabId));
});

chrome.tabs.onCreated.addListener((tab) => {
    // IF we open an new tab from a tab opened by an Identity (using page hyperlinks), 
    // we store the new chrome tabID against the identity, so that the links use the same identity

    //However, the tab could have been opened by the + button on tab bar
    // We dont use identity on those tabs

    if (tab != undefined && tab.id != undefined && tab.id > 0) {
        if (!tab.openerTabId) {
            if (currentWindow && (currentTabId && currentWindow != tab.windowId)) {
                mapTabIdToIdentity(tab.id, getIdentity(currentTabId));
                return;
            }
        }

        var url = tab.pendingUrl ? tab.pendingUrl : tab.url;
        if (tab.openerTabId && url != undefined && !url.startsWith("chrome"))
            mapTabIdToIdentity(tab.id, getIdentity(tab.openerTabId));
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    // delete the mapping when tab is closed
    delete tabIdToIdentityMap[tabId];
});


chrome.tabs.onActiveChanged.addListener((e, existingTab) => {
    getCurrentWindowAndTabId(existingTab.windowId);
});

chrome.windows.getCurrent({}, (e) => {
    getCurrentWindowAndTabId(e.id);
});

chrome.windows.onFocusChanged.addListener((e) => {
    getCurrentWindowAndTabId(e);
});

chrome.webRequest.onBeforeSendHeaders.addListener(function (data) {
    // Alter the cookies such that we add _@@@_{ID} as prefix
    var tabId = data.tabId;
    var identityInfo = getIdentity(tabId);

    var headers = data.requestHeaders;
    if (identityInfo) {
        var newCookie = "";
        for (i in headers) {
            if ("cookie" === headers[i].name.toLowerCase()) {
                if (!identityInfo && -1 == headers[i].value.indexOf(_prefix))
                    return;

                data = headers[i].value.split("; ");
                for (k in data) {
                    tabId = data[k].trim();
                    if (identityInfo) {
                        if (tabId.substring(0, identityInfo.length) != identityInfo)
                            continue;

                    } else {
                        if (-1 < tabId.indexOf(_prefix))
                            continue;

                    }
                    if (0 < newCookie.length)
                        newCookie += "; ";

                    newCookie = identityInfo ? newCookie + tabId.substring(identityInfo.length) : newCookie + tabId;
                }
                headers.splice(i, 1);
            }
        }
        if (0 < newCookie.length) {
            headers.push({
                name: "Cookie",
                value: newCookie
            });
        }
    }
    return {
        requestHeaders: headers
    };

}, {
    urls: ["http://*/*", "https://*/*"]
}, ["blocking", "requestHeaders", "extraHeaders"]);

chrome.webRequest.onHeadersReceived.addListener((data) => {
    // Alter the cookies such that we add _@@@_{ID} as prefix

    var tabId = data.tabId;
    var identityInfo = getIdentity(tabId);
    if (identityInfo) {
        data = data.responseHeaders;
        for (k in data) {
            if ("set-cookie" == data[k].name.toLowerCase())
                data[k].value = identityInfo + data[k].value;
        }
        return {
            responseHeaders: data
        };
    }

}, {
    urls: ["http://*/*", "https://*/*"]
}, ["blocking", "responseHeaders", "extraHeaders"]);

chrome.webNavigation.onDOMContentLoaded.addListener((details) => {
    // Once the DOM content has loaded
    // We signal to the content script that this is an identity tab
    var tabId = details.tabId;
    if (getIdentity(tabId)) {
        try {
            chrome.tabs.sendMessage(tabId, {
                index: 3
            });
        } catch (c) {
        }
    }
}, {
    urls: ["http://*/*", "https://*/*"]
});

//Communication between page injected script and extension to exchange identity info
chrome.runtime.onConnect.addListener((port) => {
    port.onMessage.addListener(function (statement) {
        if (statement.index == 1 && port.sender.tab) {
            identity = getIdentity(port.sender.tab.id);
            if (identity)
                port.postMessage({
                    index: 2,
                    identity: identity
                });
        }
    });
});