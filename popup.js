const text = document.getElementById( 'id-text' );
const button = document.getElementById( 'id-button' );

//On button click we send a notification/message to our extension to recreate the menus
button.addEventListener( 'click', () => {
    chrome.runtime.sendMessage( '', {
        type: 'notification',
        message: text.value
    });
});

// On load, we fetch from the synced storage and update the UI
chrome.storage.sync.get(['identities'], (identities) => {
    if (identities != undefined && identities["identities"] != undefined)
        text.value = identities["identities"];
});
