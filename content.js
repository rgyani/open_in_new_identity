var connect;
var prefix;
const _prefix = "_@@@_";

// When this script is injected in the page, it communicates with the xtenstion 
// to know the identity to use
try {
    connect = chrome.runtime.connect();
    connect.onMessage.addListener((msg) => {
        if (msg.index == 2) {
            prefix = msg.identity;
        }
    });
    connect.postMessage({
        index: 1
    });
    connect.onDisconnect.addListener( () =>{
    });
} catch (ex) {
}
if (!connect) {
    throw "port not found";
}

inject_cookies_js();

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.index == 3) {
        inject_title_js();
        setTitle(document.title);
    }
});

function inject_title_js() {
    var content = "(" + function () {
        var ____t = document.title;
        var ce = CustomEvent;
        document.__defineSetter__("title", function (t) {
            ____t = t;
            var e = new ce("9", {
                "detail": t
            });
            document.dispatchEvent(e)
        });
        document.__defineGetter__("title", function () {
            return ____t
        });
    } + ")()";

    var script = document.createElement("script");
    script.appendChild(document.createTextNode(content));
    (document.head || document.documentElement).appendChild(script);
    script.parentNode.removeChild(script);
}

function inject_cookies_js() {
    var content = "(" + function () {
        var ce = CustomEvent;
        document.__defineSetter__("cookie", function (c) {
            var event = new ce("7", {
                "detail": c
            });
            document.dispatchEvent(event)
        });
        document.__defineGetter__("cookie", function () {
            var event = new ce("8");
            document.dispatchEvent(event);
            var c;
            try {
                c = localStorage.getItem("@@@cookies");
                localStorage.removeItem("@@@cookies")
            } catch (e) {
                c = document.getElementById("@@@cookies").innerText
            }
            return c
        })
    } + ")();";

    var script = document.createElement("script");
    script.appendChild(document.createTextNode(content));
    (document.head || document.documentElement).appendChild(script);
    script.parentNode.removeChild(script);

}


document.addEventListener(7, function (e) {
    e = e.detail;
    document.cookie = null === prefix ? e : prefix + e.trim();
});
document.addEventListener(8, function () {
    var c = document.cookie;
    var value = "";
    if (c) {
        c = c.split("; ");
        for (d in c) {
            if (prefix) {
                if (c[d].substring(0, prefix.length) != prefix) {
                    continue;
                }
            } else {
                if (c[d].indexOf(_prefix) == 0)
                    continue;
            }
            if (value) {
                value += "; ";
            }
            value += prefix ? c[d].substring(prefix.length) : c[d];
        }
    }
    try {
        localStorage.setItem("@@@cookies", value);
    } catch (v) {
        if (!document.getElementById("@@@cookies")) {
            d = document.createElement("div");
            d.setAttribute("id", "@@@cookies");
            document.documentElement.appendChild(d);
            d.style.display = "none";
        }
        document.getElementById("@@@cookies").a = value;
    }
});
document.addEventListener(9, function (e) {
    setTitle(e.detail);
});

function setTitle(title) {
    if (prefix) {
        identity = prefix.substr(0, prefix.indexOf(_prefix));

        if (title.substr(0, identity.length + 2) != "[" + identity + "]") {
            document.title = "[" + identity + "] " + title + " [" + identity + "]";
        }
    } else {
        document.title = title;
    }
}



window.onunload = function () {
    document.title = document.title.replace(/\s*\[\d*\]\s*/g, "");
};
