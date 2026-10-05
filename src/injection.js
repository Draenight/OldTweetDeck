let extId;
let isFirefox = navigator.userAgent.indexOf('Firefox') > -1;
let cookie = null;
let otdtoken = null;

if(!window.chrome) window.chrome = {};
if(!window.chrome.runtime) window.chrome.runtime = {};
window.chrome.runtime.getURL = url => {
    if(!url.startsWith('/')) url = `/${url}`;
    return `${isFirefox ? 'moz-extension://' : 'chrome-extension://'}${extId}${url}`;   
}
window.addEventListener('message', e => {
    if(e.data.extensionId) {
        console.log("got extensionId", e.data.extensionId);
        extId = e.data.extensionId;
        main();
    } else if(e.data.cookie) {
        cookie = e.data.cookie;
    } else if(e.data.token) {
        console.log("got otdtoken");
        otdtoken = e.data.token;
    }
});
window.postMessage('extensionId', '*');
window.postMessage('cookie', '*');
window.postMessage('getotdtoken', '*');

async function main() {
    let html = await fetch(chrome.runtime.getURL('/files/index.html')).then(r => r.text());
    document.documentElement.innerHTML = html;

    let [challenge_js, interception_js, vendor_js, bundle_js, bundle_css, twitter_text] =
        await Promise.allSettled([
            fetch(chrome.runtime.getURL("/src/challenge.js")).then(r => r.text()),
            fetch(chrome.runtime.getURL("/src/interception.js")).then(r => r.text()),
            fetch(chrome.runtime.getURL("/files/vendor.js")).then(r => r.text()),
            fetch(chrome.runtime.getURL("/files/bundle.js")).then(r => r.text()),
            fetch(chrome.runtime.getURL("/files/bundle.css")).then(r => r.text()),
            fetch(chrome.runtime.getURL("/files/twitter-text.js")).then(r => r.text()),
        ]);
    // This dev build runs the scripts packed in the extension (the fork, including
    // For you columns and Reload columns). Opt back into remote copies with
    // localStorage.OTDuseRemoteFiles = "1". OTDalwaysUseLocalFiles still forces local.
    if (
        localStorage.getItem("OTDuseRemoteFiles") === "1" &&
        localStorage.getItem("OTDalwaysUseLocalFiles") !== "1"
    ) {
        const [
            remote_challenge_js_req,
            remote_interception_js_req,
            remote_vendor_js_req,
            remote_bundle_js_req,
            remote_bundle_css_req,
            remote_twitter_text_req,
        ] = await Promise.allSettled([
            fetch("https://raw.githubusercontent.com/Draenight/OldTweetDeck/main/src/challenge.js"),
            fetch("https://raw.githubusercontent.com/Draenight/OldTweetDeck/main/src/interception.js"),
            fetch("https://raw.githubusercontent.com/Draenight/OldTweetDeck/main/files/vendor.js"),
            fetch("https://raw.githubusercontent.com/Draenight/OldTweetDeck/main/files/bundle.js"),
            fetch("https://raw.githubusercontent.com/Draenight/OldTweetDeck/main/files/bundle.css"),
            fetch("https://raw.githubusercontent.com/Draenight/OldTweetDeck/main/files/twitter-text.js"),
        ]);
        
        if(
            (remote_challenge_js_req.value && remote_challenge_js_req.value.ok) ||
            (remote_interception_js_req.value && remote_interception_js_req.value.ok) || 
            (remote_vendor_js_req.value && remote_vendor_js_req.value.ok) ||
            (remote_bundle_js_req.value && remote_bundle_js_req.value.ok) ||
            (remote_bundle_css_req.value && remote_bundle_css_req.value.ok) ||
            (remote_twitter_text_req.value && remote_twitter_text_req.value.ok)
        ) {
            const [
                remote_challenge_js,
                remote_interception_js,
                remote_vendor_js,
                remote_bundle_js,
                remote_bundle_css,
                remote_twitter_text,
            ] = await Promise.allSettled([
                remote_challenge_js_req.value.text(),
                remote_interception_js_req.value.text(),
                remote_vendor_js_req.value.text(),
                remote_bundle_js_req.value.text(),
                remote_bundle_css_req.value.text(),
                remote_twitter_text_req.value.text(),
            ]);

            if (
                remote_challenge_js_req.value &&
                remote_challenge_js_req.value.ok &&
                remote_challenge_js.status === "fulfilled" &&
                remote_challenge_js.value.length > 30
            ) {
                challenge_js = remote_challenge_js;
                console.log("Using remote challenge.js");
            }

            if (
                remote_interception_js_req.value &&
                remote_interception_js_req.value.ok &&
                remote_interception_js.status === "fulfilled" &&
                remote_interception_js.value.length > 30
            ) {
                interception_js = remote_interception_js;
                console.log("Using remote interception.js");
            }
            if (
                remote_vendor_js_req.value &&
                remote_vendor_js_req.value.ok &&
                remote_vendor_js.status === "fulfilled" &&
                remote_vendor_js.value.length > 30
            ) {
                vendor_js = remote_vendor_js;
                console.log("Using remote vendor.js");
            }
            if (
                remote_bundle_js_req.value &&
                remote_bundle_js_req.value.ok &&
                remote_bundle_js.status === "fulfilled" &&
                remote_bundle_js.value.length > 30
            ) {
                bundle_js = remote_bundle_js;
                console.log("Using remote bundle.js");
            }
            if (
                remote_bundle_css_req.value &&
                remote_bundle_css_req.value.ok &&
                remote_bundle_css.status === "fulfilled" &&
                remote_bundle_css.value.length > 30
            ) {
                bundle_css = remote_bundle_css;
                console.log("Using remote bundle.css");
            }
            if (
                remote_twitter_text_req.value &&
                remote_twitter_text_req.value.ok &&
                remote_twitter_text.status === "fulfilled" &&
                remote_twitter_text.value.length > 30
            ) {
                twitter_text = remote_twitter_text;
                console.log("Using remote twitter-text.js");
            }
        }
    }

    let challenge_js_script = document.createElement("script");
    challenge_js_script.innerHTML = challenge_js.value.replaceAll('SOLVER_URL', chrome.runtime.getURL("solver.html"));
    document.head.appendChild(challenge_js_script);

    let interception_js_script = document.createElement("script");
    interception_js_script.innerHTML = interception_js.value;
    document.head.appendChild(interception_js_script);

    let bundle_css_style = document.createElement("style");
    bundle_css_style.innerHTML = bundle_css.value;
    document.head.appendChild(bundle_css_style);

    let xTheme = document.createElement("style");
    xTheme.id = "otd-x-theme";
    // Current X palette: lights-out on the dark theme, the light theme on the
    // light one. Quote tweets and link cards use X's 16px card chrome.
    xTheme.textContent = `
html, html.dark {
    font-family: "TwitterChirp", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
html.dark body,
html.dark .application,
html.dark .app-content,
html.dark .app-columns,
html.dark .column,
html.dark .column-panel,
html.dark .column-header,
html.dark .tweet-detail-wrapper,
html.dark .app-header,
html.dark .app-navigator,
html.dark .app-nav {
    background-color: #000 !important;
    background: #000 !important;
    color: #e7e9ea;
}
html.dark .column-header,
html.dark .column-nav:after,
html.dark .stream-item,
html.dark .tweet-detail-wrapper .stream-item {
    border-color: #2f3336 !important;
}
html.dark .stream-item {
    border-bottom: 1px solid #2f3336;
}
html.dark .tweet-text a,
html.dark .js-quoted-tweet-text a,
html:not(.dark) .tweet-text a,
html:not(.dark) .js-quoted-tweet-text a,
html.dark .column-nav .nav-item button.active,
html.dark .column-nav .nav-item button:hover {
    color: #1d9bf0;
}
html.dark .txt-mute,
html.dark .tweet-context,
html.dark .username {
    color: #71767b !important;
}
html:not(.dark) .column,
html:not(.dark) .column-panel,
html:not(.dark) .column-header {
    background: #fff !important;
    color: #0f1419;
}
html:not(.dark) .stream-item {
    border-bottom: 1px solid #eff3f4;
}
html:not(.dark) .txt-mute,
html:not(.dark) .username {
    color: #536471 !important;
}
html .quoted-tweet,
html .js-card-container,
html .hw-card-container {
    border-radius: 16px !important;
    overflow: hidden;
}
html.dark .quoted-tweet,
html.dark .js-card-container,
html.dark .hw-card-container {
    border: 1px solid #2f3336 !important;
    background: #000 !important;
    color: #e7e9ea !important;
}
html:not(.dark) .quoted-tweet,
html:not(.dark) .js-card-container,
html:not(.dark) .hw-card-container {
    border: 1px solid #cfd9de !important;
    background: #fff !important;
    color: #0f1419 !important;
}
html .media-preview,
html .media-item,
html .media-preview img,
html .media-item img,
html .js-media img {
    border-radius: 16px;
}
html .column.is-focused {
    box-shadow: 0 0 0 2px #1d9bf0 !important;
}
`;
    document.head.appendChild(xTheme);

    let vendor_js_script = document.createElement("script");
    vendor_js_script.innerHTML = vendor_js.value;
    document.head.appendChild(vendor_js_script);

    let bundle_js_script = document.createElement("script");
    bundle_js_script.innerHTML = bundle_js.value;
    document.head.appendChild(bundle_js_script);

    let twitter_text_script = document.createElement("script");
    twitter_text_script.innerHTML = twitter_text.value;
    document.head.appendChild(twitter_text_script);

    (async () => {
        try {
            const additionalScripts = await fetch("https://oldtd.org/api/scripts", {
                headers: otdtoken ? {
                    Authorization: `Bearer ${otdtoken}`
                } : undefined
            }).then(r => r.json());
            for(let script of additionalScripts) {
                let scriptSource = await fetch(`https://oldtd.org/api/scripts/${script}`, {
                    headers: otdtoken ? {
                        Authorization: `Bearer ${otdtoken}`
                    } : undefined
                }).then(r => r.text());
                let scriptElement = document.createElement("script");
                scriptElement.innerHTML = scriptSource;
                document.head.appendChild(scriptElement);
            }
        } catch(e) {
            console.error(e);
        }
    })();

    let int = setTimeout(function() {
        let badBody = document.querySelector('body:not(#injected-body)');
        if (badBody) {
            let badHead = document.querySelector('head:not(#injected-head)');
            clearInterval(int);
            if(badHead) badHead.remove();
            badBody.remove(); 
        }
    }, 200);
    setTimeout(() => clearInterval(int), 10000);

    let injInt;
    function injectAccount() {
        if(!document.querySelector('a[data-title="Accounts"]')) return;
        clearInterval(injInt);

        let accountsBtn = document.querySelector('a[data-title="Accounts"]');
        accountsBtn.addEventListener("click", function() {
            console.log("setting account cookie");
            chrome.runtime.sendMessage({ action: "setcookie" }); 
        });
    }
    setInterval(injectAccount, 1000);
};